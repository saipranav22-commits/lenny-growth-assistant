# Lenny Growth Assistant

The Lenny Growth Assistant is a full-stack, RAG-powered application designed to provide startup founders, engineers, and growth/product operators with actionable, transcript-grounded insights from Lenny's Podcast. The customer problem is that research answers are difficult to verify and frequently do not translate directly into measurable next actions. This product solves that with a differentiating workflow: **Ask â†’ Retrieve â†’ Verify Evidence â†’ Generate Action Brief â†’ Save and Revisit.**

## Product Overview & Features
- **Authentic RAG Conversations**: Ask questions and get answers explicitly grounded in actual podcast transcripts. *Note: For this evaluation, the corpus is strictly limited to two transcripts (Molly Graham and Peter Sellis).*
- **Source Explorer**: Click any citation to instantly inspect the genuine source passage, episode, and metadata. No hallucinations.
- **Action Brief & Founder Fit Check**: Instantly translate a chat into a structured Action Brief. Founders can input their company stage, team size, and constraints to generate a tailored 7-day experiment and measurable success metric, rather than generic advice.
- **Ship 30 Essay Generator**: A dedicated skill that acts autonomously to generate a ~1,250 word, 5-section essay structured in the "Ship 30" methodology.
- **Model Provider Trade-off**: Swap between local inference (`ollama`) and cloud-based models (`groq`). *Trade-off*: Groq provides lightning-fast sub-second latency but requires cloud data transfer, while Ollama guarantees 100% data privacy at the cost of significantly slower inference.

## Product Success Metrics
- **Successful grounded answer rate**: High pass rate on focused 5-case evaluation set.
- **Correct citation-to-source mappings**: Verified against original transcript lengths and IDs without runtime corruption (Note: local Postgres runs on WIN1252 encoding, which limits full UTF-8 Unicode compatibility).
- **Successful Action Brief completion**: Generates correctly with measurable metrics intact.
- **Artifact persistence and reload success**: Completely retrieved upon application reload from Postgres.
- **Workflow latency**: Tested as fast on Groq cloud; considerably slower on local LLM.

## Architecture Summary
- **Frontend**: React (Vite, TypeScript). Handles local state, responsive artifact viewing, and Markdown rendering.
- **Backend**: FastAPI (Python). Exposes REST endpoints for sessions, chats, and background skills.
- **Agent Bridge**: Node.js Pi SDK Bridge. Interacts directly with the foundational models and tool-calling orchestrator.
- **Database**: Native PostgreSQL (port `5432`). Uses `tsvector` full-text search for chunk retrieval and standard ORM (SQLAlchemy) for message history.

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Native PostgreSQL (v14+) running locally
- Groq API Key (Free tier supported)
- Ollama (installed locally with `qwen3:1.7b` for local generation)

## Safe Environment Configuration
1. Copy `.env.example` to `backend/.env` and `agent-bridge/.env`.
2. Fill in the required API keys (e.g., `GROQ_API_KEY`).
3. Ensure `DATABASE_URL` is set to point to your PostgreSQL instance.

## Portable Fresh-Install Workflow (Database)
*(Unverified: These steps provide the conceptual clean-clone workflow but have not been exhaustively tested on a completely fresh environment.)*

Do NOT assume the database is already seeded or configured at `D:\AI-Development\pgdata`. 
To fresh install on your system:
1. Ensure your local PostgreSQL uses `UTF-8` encoding. Create a new database:
   ```sql
   CREATE DATABASE lenny_db ENCODING 'UTF8';
   ```
2. Update your `.env` connection string to your local port (e.g., `5432`):
   ```env
   DATABASE_URL=postgresql+psycopg2://user:password@127.0.0.1:5432/lenny_db?client_encoding=utf8
   ```
3. Run Alembic migrations to build the schema:
   ```powershell
   cd backend
   alembic upgrade head
   ```

## Ingesting Authentic Podcast Transcripts
To ingest the two authentic, permitted podcast transcripts into the vector database:
```powershell
cd backend
python ingest.py
```
This script will read `molly-graham-2.md` and `peter-sellis.md` from `backend/data/podcasts`, chunk them, and store exactly 502 chunks into PostgreSQL.

## Commands to Start Services
### 1. Pi Bridge (Node.js)
```powershell
cd agent-bridge
npm install
npm run setup
npm run build
npm start
```
*Note*: The Pi SDK relies on local runtime configuration templates (`templates/models.json.example` and `templates/auth.json.example`). Running `npm run setup` safely provisions `.pi/models.json` and `.pi/auth.json` if missing, without overwriting existing configurations or exposing credentials. For cloud Groq models, configure `GROQ_API_KEY` via `.env` or environment variables.

### 2. Backend (FastAPI)
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend (React)
```powershell
cd frontend
npm install
npm run dev
```
