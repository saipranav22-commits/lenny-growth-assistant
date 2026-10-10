from database import SessionLocal
from models import Document, Chunk

db = SessionLocal()
docs = db.query(Document).all()
for d in docs:
    if d.source_file in ["molly-graham-2.md", "peter-sellis.md", "content.md"]:
        print(f"Deleting doc {d.id} because it has incorrect source_file: {d.source_file}")
        db.delete(d)
        
db.commit()
print("Done cleaning old docs.")
