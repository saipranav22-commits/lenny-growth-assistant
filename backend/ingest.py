import os
import uuid
import json
from database import SessionLocal
from models import Document, Chunk

TRANSCRIPTS_DIR = "../data/lennys-podcast-data"

def parse_frontmatter(content):
    metadata = {}
    text_content = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            text_content = parts[2].strip()
            
            for line in frontmatter.split('\n'):
                line = line.strip()
                if ':' in line:
                    key, val = line.split(":", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    metadata[key] = val
                    
    return metadata, text_content

def ingest_transcripts():
    db = SessionLocal()
    try:
        index_path = os.path.join(TRANSCRIPTS_DIR, "index.json")
        if not os.path.exists(index_path):
            print(f"Error: index.json not found in {TRANSCRIPTS_DIR}")
            return
            
        with open(index_path, "r", encoding="utf-8") as f:
            index_data = json.load(f)
            
        podcasts = index_data.get("podcasts", [])
        
        for p in podcasts:
            filename = p.get("filename")
            if not filename or not filename.endswith(".md"):
                continue
                
            file_path = os.path.join(TRANSCRIPTS_DIR, filename)
            if not os.path.exists(file_path):
                print(f"Error: Missing file {filename}")
                continue
                
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Idempotency check
            existing_doc = db.query(Document).filter(Document.source_file == filename).first()
            if existing_doc:
                print(f"Skipping {filename}, already ingested.")
                continue

            metadata, text_content = parse_frontmatter(content)
            
            if not text_content.strip():
                print(f"Error: Empty text content in {filename}")
                continue
                
            title = metadata.get("title") or p.get("title", "Unknown")
            guest = metadata.get("guest") or p.get("guest", "Unknown")
            date = metadata.get("date") or p.get("date", "Unknown")
            url = metadata.get("post_url") or p.get("post_url", "Unknown")

            doc_id = str(uuid.uuid4())
            document = Document(
                id=doc_id,
                title=title,
                guest=guest,
                date=date,
                url=url,
                source_file=filename
            )
            db.add(document)

            # Basic chunking by double newline
            paragraphs = text_content.split('\n\n')
            chunk_count = 0
            for para in paragraphs:
                para = para.strip()
                if len(para) > 20: # ignore very short chunks
                    chunk_id = str(uuid.uuid4())
                    chunk = Chunk(
                        id=chunk_id,
                        document_id=doc_id,
                        content=para
                    )
                    db.add(chunk)
                    chunk_count += 1
            
            print(f"Ingested {filename}: {title} with {chunk_count} chunks.")
            
        db.commit()
        print("Ingestion completed successfully.")
        
        # Report
        doc_count = db.query(Document).count()
        chunk_count = db.query(Chunk).count()
        print(f"Total documents: {doc_count}")
        print(f"Total chunks: {chunk_count}")
        
    except Exception as e:
        print(f"Error during ingestion: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    ingest_transcripts()
