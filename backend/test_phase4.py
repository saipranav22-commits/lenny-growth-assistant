import requests
import time

BASE_URL = "http://localhost:8000"

def test_phase4():
    print("--- 1. Create Session ---")
    s = requests.post(f"{BASE_URL}/api/sessions", json={"title": "Phase 4 Test"}).json()
    sess_id = s["id"]
    print("Session created:", sess_id)

    print("\n--- 2. Generate Ship 30 Essay (This takes time for staged generation...) ---")
    start = time.time()
    res = requests.post(f"{BASE_URL}/api/skills/ship30", json={
        "session_id": sess_id,
        "topic": "giving away your legos molly graham burnout"
    })
    elapsed = time.time() - start
    
    if res.status_code != 200:
        print("Error:", res.status_code, res.text)
    else:
        data = res.json()
        print(f"Essay Generation SUCCESS ({elapsed:.2f}s)")
        print(f"Artifact Type: {data.get('artifact_type')}")
        content = data.get('artifact_content', '')
        word_count = len(content.split())
        print(f"Word count check: {word_count} words")
        print("Snippet:", content[:200].replace('\n', ' '))
        print("Citations included:", [c["title"] for c in data.get('citations', [])])

    print("\n--- 3. Generate Markdown Artifact ---")
    res_md = requests.post(f"{BASE_URL}/api/artifacts", json={
        "session_id": sess_id,
        "topic": "Summary of giving away legos",
        "format": "markdown"
    })
    if res_md.status_code != 200:
        print("Error MD:", res_md.status_code, res_md.text)
    else:
        print("Markdown artifact created. Snippet:", res_md.json().get('artifact_content', '')[:100].replace('\n', ' '))

    print("\n--- 4. List Session Artifacts ---")
    list_res = requests.get(f"{BASE_URL}/api/sessions/{sess_id}/artifacts").json()
    print(f"Found {len(list_res)} artifacts:")
    for a in list_res:
        print(f"- {a.get('artifact_type')}: {a.get('id')}")

if __name__ == "__main__":
    test_phase4()
