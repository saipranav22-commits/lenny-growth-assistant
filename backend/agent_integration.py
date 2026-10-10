import os
import requests
from anthropic import Anthropic

# Goal: Demonstrate technical integration path for Agent SDK and Ollama

def test_ollama_local():
    """Test local Ollama integration via its REST API (or python client)"""
    url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/generate"
    payload = {
        "model": "llama3",
        "prompt": "Say hello world",
        "stream": False
    }
    try:
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        print("Ollama Local Test: SUCCESS")
        print("Response:", response.json().get("response"))
    except Exception as e:
        print(f"Ollama Local Test: FAILED - {e}")

def test_anthropic_cloud():
    """Test cloud Anthropic integration via Claude SDK"""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or api_key == "your_anthropic_api_key_here":
        print("Anthropic Cloud Test: SKIPPED (No API Key)")
        return
        
    try:
        client = Anthropic(api_key=api_key)
        message = client.messages.create(
            max_tokens=1024,
            messages=[{"role": "user", "content": "Hello, Claude"}],
            model="claude-3-opus-20240229",
        )
        print("Anthropic Cloud Test: SUCCESS")
        print("Response:", message.content)
    except Exception as e:
        print(f"Anthropic Cloud Test: FAILED - {e}")

if __name__ == "__main__":
    print("--- Testing Agent SDK & Local LLM Integration Path ---")
    test_ollama_local()
    test_anthropic_cloud()
    print("------------------------------------------------------")
    print("Limitations & Notes:")
    print("1. Anthropic SDK is strictly for Anthropic's Cloud API.")
    print("2. For local models with Ollama, direct REST/Ollama Client is used.")
    print("3. To unify these under a single Agent interface, a framework like LangChain or Phidata is recommended.")
