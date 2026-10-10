from sqlalchemy import text
from database import SessionLocal
import json

db = SessionLocal()

# Test 1: Full-Text Search
print("--- Testing FTS ---")
query = text("""
SELECT c.id, c.content, ts_rank(c.search_vector, websearch_to_tsquery('english', :q)) as rank
FROM chunks c
WHERE c.search_vector @@ websearch_to_tsquery('english', :q)
ORDER BY rank DESC
LIMIT 1;
""")
result = db.execute(query, {"q": "giving away responsibilities"}).fetchone()
if result:
    print(f"FTS Rank: {result.rank}")
    print(f"Chunk ID: {result.id}")
    print(f"Excerpt: {result.content[:100]}...")
else:
    print("No FTS results found.")

print("\n--- Testing Vector ---")
# The previous Phase 1/2 instructions implied `search_vector` might be a pgvector column? Wait, the prompt says: "Confirm search_vector and the full-text-search index work."
# The `search_vector` column is usually of type `tsvector` for full-text search. Let's just check the column type.
info_query = text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chunks' AND column_name = 'search_vector'")
info = db.execute(info_query).fetchone()
print(f"Column type: {info.data_type if info else 'Not found'}")
