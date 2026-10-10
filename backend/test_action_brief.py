from fastapi.testclient import TestClient
from main import app
from schemas import ArtifactRequest

client = TestClient(app)

def test_action_brief():
    # Create session
    resp = client.post("/api/sessions", json={"title": "Action Brief Test Session"})
    session_id = resp.json()["id"]
    
    # Request Action Brief artifact
    req = {
        "session_id": session_id,
        "format": "action_brief",
        "topic": "Summarize user growth"
    }
    
    print("Requesting Action Brief...")
    resp = client.post("/api/artifacts", json=req)
    
    if resp.status_code != 200:
        print("Failed:", resp.text)
        return
    
    data = resp.json()
    print("Action Brief Response:", data)
    print("Artifact Type:", data.get("artifact_type"))
    print("Citations length:", len(data.get("citations", [])))
    
    if "Measurable Success Metric" in data.get("artifact_content", ""):
        print("Success! Artifact content includes Measurable Success Metric.")
    else:
        print("Warning: Did not find required sections in artifact.")

if __name__ == "__main__":
    test_action_brief()
