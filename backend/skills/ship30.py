import asyncio
import logging
from sqlalchemy import text
from datetime import datetime
import uuid
import re
import sys
import time
from fastapi import HTTPException

from database import DBSession
from models import Message, Session
from bridge_client import call_bridge, BridgeError
from config import settings

logger = logging.getLogger(__name__)

def log_progress(msg: str):
    import sys
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    safe_msg = msg.encode('ascii', 'ignore').decode('ascii')
    print(f"[{timestamp}] [ship30] {safe_msg}", flush=True)

async def generate_ship30_essay(topic: str, session_id: uuid.UUID, db: DBSession) -> dict:
    log_progress(f"Starting Ship30 essay generation for session {session_id}")
    
    # Validate session
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        log_progress("Session validation failed: Session not found.")
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Stage 1: Retrieve supporting evidence
    log_progress("Stage 1: Retrieving supporting evidence...")
    words = re.findall(r'\b\w+\b', topic)
    or_query_str = " | ".join(words) if words else ""
    
    query = text("""
        SELECT c.id as chunk_id, c.content, d.id as doc_id, d.title, d.guest, d.source_file,
               ts_rank(c.search_vector, to_tsquery('english', :or_q)) as rank
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE (:or_q != '' AND c.search_vector @@ to_tsquery('english', :or_q))
           OR c.search_vector @@ websearch_to_tsquery('english', :q)
        ORDER BY rank DESC
        LIMIT 2
    """)
    results = db.execute(query, {"q": topic, "or_q": or_query_str}).fetchall()
    
    if not results:
        log_progress("Stage 1 Failed: Insufficient evidence found.")
        return {"error": "Insufficient evidence", "status_code": 400}
        
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
            "chunk_id": str(chunk_id)
        })
        
    context_str = "\n\n".join(context_blocks)
    log_progress(f"Stage 1 Complete: Found {len(citations)} sources. Evidence block size: {len(context_str)} chars.")
    
    # Stage 2: Prepare outline
    log_progress("Stage 2 START: Preparing essay outline via Pi Bridge...")
    outline_prompt = (
        "You are an expert essay writer using the Ship 30 for 30 methodology. "
        "Based ONLY on the following transcripts, create an outline for an essay about: " + topic + ".\n"
        "Choose an angle (Actionable, Analytical, Aspirational, Anthropological). "
        "Define 5 specific sections for the essay body. Provide just the outline text with a strong headline.\n\n"
        f"=== EVIDENCE ===\n{context_str}\n=== END EVIDENCE ===\n"
    )
    
    start_time = time.time()
    try:
        outline_result = await call_bridge(str(session_id), outline_prompt, [], disable_tools=True, provider=settings.llm_provider, model=settings.llm_model)
        elapsed = time.time() - start_time
        
        req_id = outline_result.get("requestId", "unknown")
        model = outline_result.get("model", "unknown")
        provider = outline_result.get("provider", "unknown")
        answer_text = outline_result.get("answer", "")
        
        log_progress(f"Stage 2 Pi bridge success. RequestID: {req_id}, Model: {provider}/{model}, "
                     f"Input length: {len(outline_prompt)} chars, Elapsed: {elapsed:.1f}s")
                     
        if not answer_text.strip():
            log_progress(f"Stage 2 FAILED: Validation Error - Pi response was empty. Falling back to deterministic outline.")
            outline = f"**Headline:** {topic.title()}\n\n1. **Core Concept:** The foundational aspects of the topic.\n2. **Analysis & Evidence:** The practical realities and evidence.\n3. **Challenges & Trade-offs:** Common pitfalls and difficulties.\n4. **Conclusion & Takeaways:** Actionable next steps."
        else:
            outline = answer_text.strip()
            log_progress(f"Stage 2 COMPLETE: Outline generated successfully. Length of returned text: {len(outline)} chars.")
        
    except Exception as e:
        elapsed = time.time() - start_time
        log_progress(f"Stage 2 FAILED: Exception during call_bridge after {elapsed:.1f}s - {type(e).__name__}: {str(e)}")
        logger.error(f"Bridge exception details: {e}", exc_info=True)
        return {"error": f"Failed to generate outline: Bridge exception {type(e).__name__}", "status_code": 500}
    
    # Stage 3: Generate sections sequentially
    log_progress("Stage 3: Generating sections sequentially...")
    essay_sections = []
    
    for i in range(1, 6):
        log_progress(f"Writing section {i} of 5...")
        hook_instruction = "Start with a compelling, punchy hook. " if i == 1 else ""
        section_prompt = (
            f"Write section {i} of 5 for the following essay outline. {hook_instruction}"
            "Write exactly 180-250 words. Use clear headings, short paragraphs, bold emphasis. "
            "Ensure everything is grounded in the transcript evidence. Do NOT invent facts or stats. "
            "CRITICAL: Do NOT mention 'Ship 30 for 30' in the essay. That is just your writing style, not the topic.\n\n"
            f"=== OUTLINE ===\n{outline}\n=== END OUTLINE ===\n\n"
            f"=== EVIDENCE ===\n{context_str}\n=== END EVIDENCE ===\n\n"
            f"Write section {i} now:"
        )
        
        for attempt in range(3):
            start_time = time.time()
            try:
                sec_result = await call_bridge(str(session_id), section_prompt, [], disable_tools=True, provider=settings.llm_provider, model=settings.llm_model)
                elapsed = time.time() - start_time
                sec_content = sec_result.get("answer", "").strip()
                
                # Update metadata explicitly
                provider = sec_result.get("provider", provider)
                model = sec_result.get("model", model)
                
                log_progress(f"Section {i} attempt {attempt+1} Pi bridge success. Elapsed: {elapsed:.1f}s. Length: {len(sec_content)} chars.")
                if not sec_content:
                    log_progress(f"Section {i} attempt {attempt+1} empty response. Retrying...")
                    await asyncio.sleep(1)
                    continue
                    
                essay_sections.append(sec_content)
                # Update UI message to show progress
                msg = db.query(Message).filter(Message.session_id == session_id, Message.artifact_content == "GENERATING...").first()
                if msg:
                    msg.content = f"Generating Ship 30 essay... (Writing section {i} of 5)"
                    db.commit()
                break
            except BridgeError as e:
                elapsed = time.time() - start_time
                log_progress(f"Section {i} FAILED: BridgeError after {elapsed:.1f}s - Status: {e.status_code}, Msg: {str(e)}")
                if attempt == 2:
                    return {"error": f"Failed to generate section {i}: {str(e)}", "status_code": e.status_code}
                
                wait_time = e.retry_after if getattr(e, 'retry_after', 0) > 0 else (2 ** attempt)
                if e.status_code == 429:
                    log_progress(f"Rate limited. Waiting {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                elif e.status_code in [500, 502, 503, 504]:
                    await asyncio.sleep(wait_time)
                else:
                    return {"error": f"Failed to generate section {i}: {str(e)}", "status_code": e.status_code}
            except Exception as e:
                elapsed = time.time() - start_time
                log_progress(f"Section {i} FAILED: Exception during call_bridge after {elapsed:.1f}s - {type(e).__name__}: {str(e)}")
                return {"error": f"Failed to generate section {i}: {type(e).__name__}", "status_code": 500}
        else:
            return {"error": f"Failed to generate section {i}: Model returned empty text after 3 attempts.", "status_code": 500}
    
    # Do not include the outline in the final prose
    essay = "\n\n".join(essay_sections)
    
    # Sanitize for WIN1252 database
    essay = essay.replace('\u202f', ' ').replace('\u2011', '-')
    essay = essay.encode('windows-1252', 'replace').decode('windows-1252')
    log_progress(f"Stage 3 Complete (total length: {len(essay)} chars).")
    
    # Stage 4: Validate word count
    log_progress("Stage 4: Validating essay length...")
    word_count = len(re.findall(r'\b\w+\b', essay))
    log_progress(f"Final word count: {word_count}")
    
    return {
        "essay": essay,
        "word_count": word_count,
        "citations": citations,
        "provider": provider,
        "model": model
    }
