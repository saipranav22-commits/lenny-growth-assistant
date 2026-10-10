import requests
import time

BASE_URL = "http://localhost:8000"

def test_api():
    print("--- Test 1: Supported question with real transcript ---")
    s1 = requests.post(f"{BASE_URL}/api/sessions", json={"title": "Test 1"}).json()
    sess_id_1 = s1["id"]
    
    res1 = requests.post(f"{BASE_URL}/api/chat", json={
        "session_id": sess_id_1,
        "message": "What does Molly Graham say about giving away your legos?"
    }).json()
    
    print("User:", res1["user_message"]["content"])
    print("Assistant:", res1["assistant_message"]["content"])
    print("Citations:", [c["title"] for c in res1["assistant_message"].get("citations", [])])
    print()
    
    print("--- Test 2: Follow-up question ---")
    res2 = requests.post(f"{BASE_URL}/api/chat", json={
        "session_id": sess_id_1,
        "message": "Can you elaborate on that?"
    }).json()
    
    print("User:", res2["user_message"]["content"])
    print("Assistant:", res2["assistant_message"]["content"])
    print()
    
    print("--- Test 3: Unsupported question ---")
    res3 = requests.post(f"{BASE_URL}/api/chat", json={
        "session_id": sess_id_1,
        "message": "What is the secret formula for Coca Cola?"
    }).json()
    
    print("User:", res3["user_message"]["content"])
    print("Assistant:", res3["assistant_message"]["content"])
    print()
    
    print("--- Test 4: Second session ---")
    s2 = requests.post(f"{BASE_URL}/api/sessions", json={"title": "Test 2"}).json()
    sess_id_2 = s2["id"]
    
    res4 = requests.post(f"{BASE_URL}/api/chat", json={
        "session_id": sess_id_2,
        "message": "What is Peter Sellis's advice?"
    }).json()
    
    print("User:", res4["user_message"]["content"])
    print("Assistant:", res4["assistant_message"]["content"])
    print("Citations:", [c["title"] for c in res4["assistant_message"].get("citations", [])])
    print()
    
if __name__ == "__main__":
    test_api()
