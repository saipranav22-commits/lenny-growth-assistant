from sqlalchemy import text
from database import SessionLocal

db = SessionLocal()

query_text = "give away your legos responsibilities company grows molly graham"

query = text("""
SELECT 
    c.id as chunk_id, 
    c.content as chunk_content, 
    ts_rank(c.search_vector, websearch_to_tsquery('english', :q)) as rank,
    d.id as doc_id,
    d.title as doc_title
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE c.search_vector @@ websearch_to_tsquery('english', :q)
ORDER BY rank DESC
LIMIT 1;
""")

result = db.execute(query, {"q": query_text}).fetchone()

if result:
    print(f"Query: {query_text}")
    print(f"Retrieved document ID: {result.doc_id}")
    print(f"Retrieved chunk ID: {result.chunk_id}")
    print(f"Episode title: {result.doc_title}")
    print(f"Search ranking: {result.rank}")
    print(f"Short supporting excerpt: {result.chunk_content[:150]}...")
else:
    print("No results found.")
