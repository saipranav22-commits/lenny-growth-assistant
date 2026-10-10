"""FastAPI application — Lenny Growth Assistant."""
from __future__ import annotations
from pydantic import BaseModel
import logging
import uuid
from datetime import datetime
import re

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import text

from bridge_client import BridgeError, call_bridge
from config import settings
from database import get_db
from models import Message, Session
from schemas import (
    Ship30Request, ArtifactRequest,
    ChatRequest,
    ChatResponse,
    MessageOut,
    SessionCreate,
    SessionOut,
)

def sanitize_for_db(obj):
    if isinstance(obj, str):
        obj = obj.replace('\x00', '')
        return obj.encode('cp1252', errors='ignore').decode('cp1252')
    elif isinstance(obj, list):
        return [sanitize_for_db(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: sanitize_for_db(v) for k, v in obj.items()}
    return obj

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lenny Growth Assistant API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health/live", tags=["health"])
def health_live():
    return {"status": "ok"}

@app.get("/health/ready", tags=["health"])
def health_ready(db: DBSession = Depends(get_db)):
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}")
    return {"status": "ready", "db": "ok"}

@app.post("/api/sessions", response_model=SessionOut, status_code=201, tags=["sessions"])
def create_session(body: SessionCreate, db: DBSession = Depends(get_db)):
    session = Session(title=body.title, user_metadata=body.user_metadata)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@app.get("/api/sessions", response_model=list[SessionOut], tags=["sessions"])
def list_sessions(db: DBSession = Depends(get_db)):
    return (
        db.query(Session)
        .order_by(Session.updated_at.desc())
        .limit(50)
        .all()
    )

@app.get("/api/sessions/{session_id}", response_model=SessionOut, tags=["sessions"])
def get_session(session_id: uuid.UUID, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.get(
    "/api/sessions/{session_id}/messages",
    response_model=list[MessageOut],
    tags=["sessions"],
)
def get_messages(session_id: uuid.UUID, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.messages

@app.post("/api/chat", response_model=ChatResponse, tags=["chat"])
async def chat(body: ChatRequest, db: DBSession = Depends(get_db)):
    # 1. Validate session exists
    session = db.query(Session).filter(Session.id == body.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. Load existing messages for history (bounded to last 10 messages)
    existing: list[Message] = (
        db.query(Message)
        .filter(Message.session_id == body.session_id)
        .order_by(Message.created_at.desc())
        .limit(10)
        .all()
    )
    # Reverse to keep chronological order
    existing.reverse()
    history = [{"role": m.role, "content": m.content} for m in existing]

    # 3. Persist user message first (before calling the bridge)
    user_content = body.message.replace('\u202f', ' ')
    user_msg = Message(
        session_id=body.session_id,
        role="user",
        content=user_content,
        provider=None,
        model=None,
        created_at=datetime.utcnow(),
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 4. Retrieval (RAG)
    from sqlalchemy import text
    import re
    try:
        search_text = body.message
            
        words = re.findall(r'\b\w+\b', search_text)
        or_query_str = " | ".join(words) if words else ""
        query = text("""
            SELECT c.id as chunk_id, c.content, d.id as doc_id, d.title, d.guest, d.source_file,
                   ts_rank(c.search_vector, to_tsquery('english', :or_q)) as rank
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE (:or_q != '' AND c.search_vector @@ to_tsquery('english', :or_q))
               OR c.search_vector @@ websearch_to_tsquery('english', :q)
            ORDER BY rank DESC
            LIMIT 3
        """)
        results = db.execute(query, {"q": search_text, "or_q": or_query_str}).fetchall()
        
        context_blocks = []
        citations = []
        for row in results:
            chunk_id, content, doc_id, title, guest, source_file, rank = row
            context_blocks.append(f"Source: {title} (Guest: {guest})\n{content}")
            citations.append({
                "title": title, 
                "guest": guest, 
                "source_file": source_file,
                "document_id": str(doc_id),
                "chunk_id": str(chunk_id),
                "content": content
            })
            
        if context_blocks:
            context_str = "\n\n".join(context_blocks)
            augmented_message = (
                "You are an assistant for answering questions based ONLY on the provided transcripts. "
                "Do NOT use your general knowledge to answer unsupported product questions. "
                "If the context does not provide sufficient evidence to answer the question, say exactly: 'I have insufficient evidence to answer that based on the podcast transcripts.'\n\n"
                f"=== CONTEXT ===\n{context_str}\n=== END CONTEXT ===\n\n"
                f"Question: {body.message}"
            )
        else:
            augmented_message = (
                "You are an assistant for answering questions based ONLY on the provided transcripts. "
                "I did not find any relevant transcripts for the following question. "
                "Say exactly: 'I have insufficient evidence to answer that based on the podcast transcripts.'\n\n"
                f"Question: {body.message}"
            )
            
    except Exception as exc:
        logger.error(f"Retrieval error: {exc}")
        augmented_message = body.message
        citations = []

    # 5. Call Pi bridge
    try:
        result = await call_bridge(
            session_id=str(body.session_id),
            message=augmented_message,
            history=history,
            provider=settings.llm_provider,
            model=settings.llm_model
        )
    except BridgeError as exc:
        logger.error("Bridge error: %s (status=%s)", exc, exc.status_code)
        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    answer = result.get("answer", "").strip()
    if not answer:
        raise HTTPException(status_code=500, detail="Empty response from AI model")

    artifact_match = re.search(r'<artifact\s+type=[\'"]([^\'"]+)[\'"]>(.*?)</artifact>', answer, re.DOTALL)
    artifact_type = None
    artifact_content = None
    if artifact_match:
        artifact_type = artifact_match.group(1)
        artifact_content = artifact_match.group(2).strip()
        answer = re.sub(r'<artifact\s+type=[\'"][^\'"]+[\'"]>.*?</artifact>', '', answer, flags=re.DOTALL).strip()

    # 6. Persist assistant message
    assistant_msg = Message(
        session_id=body.session_id,
        role="assistant",
        content=sanitize_for_db(answer),
        provider=result.get("provider", settings.llm_provider),
        model=result.get("model", settings.llm_model),
        citations=sanitize_for_db(citations),
        artifact_type=artifact_type,
        artifact_content=sanitize_for_db(artifact_content),
        created_at=datetime.utcnow(),
    )
    db.add(assistant_msg)

    # 6. Update session title from first user message
    if len(existing) == 0:
        title = body.message[:80] + ("..." if len(body.message) > 80 else "")
        session.title = title

    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_msg)

    return ChatResponse(
        session_id=session.id,
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
        provider=assistant_msg.provider or settings.llm_provider,
        model=assistant_msg.model or settings.llm_model,
        request_id=str(uuid.uuid4())
    )
from fastapi import BackgroundTasks
from database import SessionLocal
import traceback

from skills.ship30 import generate_ship30_essay

async def run_ship30_background(message_id: uuid.UUID, topic: str, session_id: uuid.UUID):
    db = SessionLocal()
    try:
        result = await generate_ship30_essay(topic, session_id, db)
        msg = db.query(Message).filter(Message.id == message_id).first()
        if not msg:
            return
            
        if isinstance(result, dict) and "error" in result:
            msg.artifact_type = "error"
            msg.artifact_content = f"FAILED: {result['error']}"
            msg.content = "I encountered an error while generating the essay."
        else:
            word_count = result.get("word_count", 0)
            status = "COMPLETE" if word_count >= 1200 else "INCOMPLETE"
            
            msg.artifact_type = "essay" if status == "COMPLETE" else "incomplete_essay"
            msg.artifact_content = result["essay"]
            msg.content = f"[{status}] I have generated a Ship 30 for 30 essay for you. (Word count: {word_count})"
            msg.citations = result["citations"]
            msg.provider = result.get("provider", settings.llm_provider)
            msg.model = result.get("model", settings.llm_model)
            
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.updated_at = datetime.utcnow()
            
        db.commit()
    except Exception as e:
        msg = db.query(Message).filter(Message.id == message_id).first()
        if msg:
            msg.content = f"Generation failed: {str(e)}"
            msg.artifact_content = f"FAILED: {str(e)}"
            db.commit()
    finally:
        db.close()

@app.post("/api/skills/ship30", response_model=MessageOut, tags=["skills"])
async def ship30_endpoint(body: Ship30Request, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    msg = Message(
        session_id=body.session_id,
        role="assistant",
        content="Generating Ship 30 essay... (This may take a few minutes)",
        provider=settings.llm_provider,
        model=settings.llm_model,
        citations=[],
        artifact_type="essay",
        artifact_content="GENERATING...",
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    
    session = db.query(Session).filter(Session.id == body.session_id).first()
    if session:
        session.updated_at = datetime.utcnow()
        
    db.commit()
    db.refresh(msg)
    
    background_tasks.add_task(run_ship30_background, msg.id, body.topic, body.session_id)
    return msg
from typing import Optional

class ArtifactRequest(BaseModel):
    session_id: str
    topic: str
    format: str
    company_stage: Optional[str] = None
    team_size: Optional[str] = None
    current_challenge: Optional[str] = None
    primary_constraint: Optional[str] = None

@app.post("/api/artifacts", response_model=MessageOut, tags=["artifacts"])
async def create_artifact(body: ArtifactRequest, db: DBSession = Depends(get_db)):
    context_str = ""
    citations_data = []
    
    if body.format == "action_brief":
        # Fetch RAG context directly
        topic = body.topic
        or_query_str = " | ".join([w for w in re.findall(r'\w+', topic) if len(w) > 3])
        query = text("""
            SELECT c.id as chunk_id, c.content, d.id as doc_id, d.title, d.guest, d.source_file,
                   ts_rank(c.search_vector, to_tsquery('english', :or_q)) as rank
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE (:or_q != '' AND c.search_vector @@ to_tsquery('english', :or_q))
               OR c.search_vector @@ websearch_to_tsquery('english', :q)
            ORDER BY rank DESC
            LIMIT 3
        """)
        try:
            results = db.execute(query, {"q": topic, "or_q": or_query_str}).fetchall()
            context_blocks = []
            for row in results:
                chunk_id, content, doc_id, title, guest, source_file, rank = row
                context_blocks.append(f"Source: {title}\n{content}")
                citations_data.append({
                    "title": title, 
                    "guest": guest, 
                    "source_file": source_file,
                    "document_id": str(doc_id),
                    "chunk_id": str(chunk_id),
                    "content": content
                })
            context_str = "\n\n".join(context_blocks)
        except Exception as e:
            pass

        founder_context = ""
        if body.company_stage or body.team_size or body.current_challenge or body.primary_constraint:
            founder_context = f"""
=== FOUNDER CONTEXT ===
Company Stage: {body.company_stage or 'Not specified'}
Team Size: {body.team_size or 'Not specified'}
Current Challenge: {body.current_challenge or 'Not specified'}
Primary Constraint: {body.primary_constraint or 'Not specified'}
=== END FOUNDER CONTEXT ===
"""
        prompt = f"""Create an Action Brief based on the following topic: {body.topic}.
{founder_context}
Based ONLY on the following transcripts and the founder's context, generate the brief.
Format the output in Markdown with the following STRICT sections:
1. User's Business Situation (Summary of founder context).
2. Relevant Podcast-backed Insight (source-derived claims ONLY).
3. Why the insight may or may not apply to this company.
4. One clearly labelled assistant recommendation.
5. One specific seven-day experiment.
6. One measurable success metric.
7. Potential risk or limitation.
8. Genuine supporting citations.

Clearly distinguish User-provided information, Verified podcast evidence, and Model-generated interpretation and suggestions. Do not invent company facts, historical outcomes, podcast quotes or source references. If evidence is insufficient, explain the limitation instead of manufacturing personalized authority.

=== EVIDENCE ===
{context_str}
=== END EVIDENCE ===
"""
    else:
        prompt = f"Create a {body.format} artifact about {body.topic}. Make it highly structured, actionable, and visually clear."

    
    # Simple call to the LLM
    try:
        res = await call_bridge(
            session_id=str(body.session_id),
            message=prompt,
            history=[],
            disable_tools=True,
            provider=settings.llm_provider,
            model=settings.llm_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    answer = sanitize_for_db(res.get("answer", "Could not generate artifact."))
    citations = sanitize_for_db(res.get("citations", []))
    if not citations and citations_data:
        citations = sanitize_for_db(citations_data)
    
    msg = Message(
        session_id=body.session_id,
        role='assistant',
        content=f"I have generated the {body.format} artifact.",
        provider=settings.llm_provider,
        model=settings.llm_model,
        citations=citations,
        artifact_type=body.format,
        artifact_content=answer
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    
    return MessageOut.model_validate(msg)

@app.get("/api/sessions/{session_id}/artifacts", response_model=list[MessageOut], tags=["artifacts"])
def get_artifacts(session_id: str, db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(Message.session_id == session_id, Message.artifact_type != None).order_by(Message.created_at.asc()).all()
    return msgs
