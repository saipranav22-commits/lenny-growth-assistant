from database import SessionLocal
from models import Document, Chunk

db = SessionLocal()
docs = db.query(Document).all()
for d in docs:
    c_count = db.query(Chunk).filter(Chunk.document_id == d.id).count()
    print(f"Doc: {d.title} (File: {d.source_file}) - Chunks: {c_count}")
    
    if c_count == 0:
        print(f"Deleting doc {d.id} because it has 0 chunks")
        db.delete(d)
        
db.commit()
print("Done checking docs.")
