import requests, time, sys

BASE_URL = 'http://localhost:8000'

print("Creating session...")
s = requests.post(f'{BASE_URL}/api/sessions', json={'title': 'Ship30 Test'}).json()
if 'id' not in s:
    print('Failed to create session:', s)
    sys.exit(1)

sess_id = s['id']
print(f'Session: {sess_id}')

start = time.time()
print('Starting generation (Async Workflow)...')
try:
    res = requests.post(f'{BASE_URL}/api/skills/ship30', json={
        'session_id': sess_id,
        'topic': 'giving away your responsibilities as a startup grows molly graham'
    }, timeout=15)
except requests.exceptions.Timeout:
    print('Initial POST request timed out after 15 seconds.')
    sys.exit(1)
except requests.exceptions.RequestException as e:
    print(f'Request failed: {e}')
    sys.exit(1)

if res.status_code != 200:
    print('Failed POST:', res.text)
    sys.exit(1)

data = res.json()
artifact_id = data.get('id')

print("Initial response received. Polling for completion...")

while True:
    time.sleep(3)
    try:
        msgs_res = requests.get(f'{BASE_URL}/api/sessions/{sess_id}/messages', timeout=5)
    except requests.exceptions.RequestException:
        continue
        
    msgs = msgs_res.json()
    msg = next((m for m in msgs if m['id'] == artifact_id), None)
    
    if msg:
        if msg.get('artifact_content') != 'GENERATING...':
            data = msg
            break
    else:
        print("Message not found in session!")
        sys.exit(1)

elapsed = time.time() - start
print(f'Done in {elapsed:.1f}s')

essay = data.get('artifact_content', '')
word_count = len(essay.split()) if essay else 0
citations = data.get('citations')

print('Response keys:', list(data.keys()))
print('Actual Words:', word_count)
if citations:
    print(f"Verified Citations: {len(citations)}")
else:
    print("Verified Citations: None or 0")

print('Message ID (Artifact):', artifact_id)

print('\nSnippet:')
print(essay[:300].replace('\n', ' '))
if essay.startswith('FAILED:'):
    print('\nTest FAIL (Error in generation)')
    sys.exit(1)
else:
    print('\nTest PASS' if word_count > 0 else '\nTest FAIL (No words generated)')
