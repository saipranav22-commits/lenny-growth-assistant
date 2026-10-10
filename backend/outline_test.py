import asyncio
import uuid
import time
import json
import logging
from bridge_client import call_bridge

# Set up logging to console
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_outline_test():
    session_id = str(uuid.uuid4())
    print(f"Test Session ID: {session_id}")
    
    context_str = """Source: Molly Graham on Scaling (Guest: Molly Graham)
When a startup grows, you have to give away your legos. Your job changes every 6 months. You need to hire people to take over the responsibilities you used to have, which can be emotionally difficult but is necessary for scaling."""

    topic = "giving away your responsibilities as a startup grows molly graham"
    
    outline_prompt = (
        "You are an expert essay writer using the Ship 30 for 30 methodology. "
        "Based ONLY on the following transcripts, create an outline for an essay about: " + topic + ".\n"
        "Choose an angle (Actionable, Analytical, Aspirational, Anthropological). "
        "Define 4 specific sections for the essay body. Provide just the outline text with a strong headline.\n\n"
        f"=== EVIDENCE ===\n{context_str}\n=== END EVIDENCE ===\n"
    )

    print("--- START STAGE 2: Outline Generation ---")
    start = time.time()
    try:
        result = await call_bridge(session_id, outline_prompt, [])
        elapsed = time.time() - start
        
        print(f"Elapsed Time: {elapsed:.2f}s")
        print("Result keys:", list(result.keys()))
        
        answer = result.get("answer", "")
        print(f"Answer length: {len(answer)}")
        if not answer.strip():
            print("ERROR: Answer is empty or whitespace-only!")
            print("Raw Result:", json.dumps(result, indent=2))
        else:
            print("Answer Preview:\n", answer[:300])
            
    except Exception as e:
        print(f"Exception during call_bridge: {e}")

if __name__ == "__main__":
    asyncio.run(run_outline_test())
