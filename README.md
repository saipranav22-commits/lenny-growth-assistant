<p align="center">
  <img src="frontend/public/favicon.svg" alt="Lenny Growth Assistant Logo" width="72" />
</p>

<h1 align="center">Lenny Growth Assistant</h1>

<p align="center">
  AI-powered growth strategy assistant grounded in Lenny's Podcast
</p>

# Lenny Growth Assistant

**An evidence-to-action AI workspace for startup founders, product managers, and growth teams.**

Built for the **Oogway Labs — Forward Deployed Engineer Take-Home Assignment**.

Lenny Growth Assistant helps founders turn expert podcast knowledge into **verifiable insights, personalized recommendations, and measurable growth experiments**.

Instead of depending solely on general LLM knowledge, the system retrieves relevant passages from Lenny's Podcast transcripts and allows users to inspect the supporting evidence.

**Product workflow:** Ask → Retrieve → Verify Evidence → Founder Fit → Action Brief → Save and Revisit

---

## Key Features

### 1. Transcript-Grounded AI Conversations
- Answers product and growth questions using retrieval-augmented generation (RAG).
- Uses PostgreSQL full-text search to retrieve relevant podcast passages.
- Displays source-linked citations with document and chunk identifiers.
- Handles multiple saved conversation sessions.

**Current evaluation corpus:** Two curated transcripts featuring Molly Graham and Peter Sellis, containing 502 indexed chunks in the tested local database.

### 2. Source Explorer
- Click a citation to inspect the underlying podcast transcript passage.
- View source metadata, guest name, and document reference.
- Helps users evaluate the evidence supporting an AI-generated answer.

### 3. Founder Fit Context — Custom Feature
Users can provide:
- Company stage
- Team size
- Current business challenge
- Primary constraint

This context helps adapt recommendations to the founder's actual business situation rather than producing only generic growth advice.

### 4. Strategy Action Brief — Custom Feature
Transforms podcast evidence and founder context into a structured decision-support document containing:

- Business situation
- Relevant podcast-backed insight
- Applicability analysis
- Assistant recommendation
- Specific seven-day experiment
- Measurable success metric
- Risks, limitations, and supporting citations

### 5. Dedicated Ship 30 Essay Generator
Implements a multistage backend workflow:

1. Retrieve supporting transcript evidence.
2. Generate an essay outline.
3. Generate five sections through the Pi SDK model bridge.
4. Calculate the output word count.
5. Save the resulting essay and citations.

The target is approximately 1,250 words. Generation time and final length depend on the selected model and available evidence.

### 6. In-App Artifact Viewer
- Render formatted Markdown documents and essays beside the conversation.
- Switch between **Preview** and **Source** views.
- Support sandboxed HTML/CSS preview rendering.
- Reopen previously saved artifacts from conversation history.

### 7. Flexible AI Model Configuration
The application supports:

- **Local:** Ollama with `qwen3:1.7b`
- **Cloud:** Groq through the Pi SDK bridge

Provider selection is controlled through configuration, without editing application source code. The active provider and model are displayed with assistant responses.

---

## System Architecture

```mermaid
flowchart TD
    U["Founder / Product Team"] --> R["React + TypeScript Frontend"]
    R -->|"HTTP API requests"| F["FastAPI Backend"]

    T["Lenny's Podcast Transcripts"] --> I["Transcript Ingestion and Chunking"]
    I --> DB[("PostgreSQL Knowledge and Session Database")]

    F <-->|"tsvector Retrieval and Persistence"| DB
    F -->|"Grounded Prompt + Retrieved Context"| P["Node.js Pi Coding Agent SDK Bridge"]

    P --> O["Ollama - Local Qwen3"]
    P --> G["Groq - Cloud LLM"]

    O --> P
    G --> P
    P -->|"Generated Response"| F
    F -->|"Answer, Citations, Artifacts"| R

    R --> S["Source Explorer"]
    R --> A["Founder Fit + Strategy Brief"]
    R --> E["Ship 30 Essay + Artifact Viewer"]
```

### How the Application Works

**Step 1 — Ask:** A user submits a growth or product question through the React interface.

**Step 2 — Retrieve:** FastAPI searches PostgreSQL for relevant podcast transcript chunks using `tsvector`, full-text query functions, and relevance ranking.

**Step 3 — Ground:** Retrieved passages are included in the model prompt as supporting context.

**Step 4 — Generate:** FastAPI sends the grounded request to a Node.js bridge using the Pi Coding Agent SDK. The bridge invokes the configured Ollama or Groq model.

**Step 5 — Verify:** The response returns with source references that users can inspect through Source Explorer.

**Step 6 — Act:** Users can supply founder context and generate a Strategy Brief or initiate the Ship 30 essay workflow.

**Step 7 — Persist:** Conversation history, citations, generated artifacts, and session metadata are stored in PostgreSQL.

### Why This Architecture?

The system separates the user interface, API orchestration, database retrieval, agent execution, and model provider configuration.

This improves maintainability, testing, troubleshooting, and the ability to replace individual components.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React, TypeScript, Vite | Chat interface and artifact presentation |
| Backend | FastAPI, Python | API routing, retrieval, persistence, and skill orchestration |
| Agent execution | Pi Coding Agent SDK, Node.js | Model execution and agent sessions |
| Database | PostgreSQL, SQLAlchemy | Transcript storage, sessions, messages, artifacts |
| Retrieval | PostgreSQL `tsvector`, GIN indexing | Full-text retrieval of transcript chunks |
| Local AI | Ollama, `qwen3:1.7b` | Local model inference |
| Cloud AI | Groq | Optional hosted model inference |
| Migrations | Alembic | Database schema management |
| UI rendering | React Markdown, sandboxed iframe | Safe document and artifact previews |

**Retrieval note:** This implementation uses PostgreSQL full-text search, not pgvector embeddings.

---

## Local Setup

### Prerequisites

- Node.js and npm
- Python 3.10+
- PostgreSQL 14+
- Ollama with `qwen3:1.7b`
- A Groq API key only when using the optional cloud provider

### 1. Clone the Repository

```powershell
git clone https://github.com/saipranav22-commits/lenny-growth-assistant.git
cd lenny-growth-assistant
```

### 2. Configure the Environment

Create `backend/.env` from `.env.example` and update its database URL, model settings, and other environment variables.

For local Ollama:

```env
DATABASE_URL=postgresql+psycopg2://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/lenny_db?client_encoding=utf8
PI_BRIDGE_URL=http://127.0.0.1:3001
LLM_PROVIDER=ollama
LLM_MODEL=qwen3:1.7b
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b
```

Do not commit real credentials or `.env` files.

For optional Groq inference, configure `LLM_PROVIDER=groq`, an available Groq model ID in `LLM_MODEL`, and `GROQ_API_KEY`. Restart the affected services after changing model configuration.

### 3. Prepare PostgreSQL

Create a PostgreSQL role and an empty `lenny_db` database. UTF-8 is recommended for a new installation.

From the `backend` directory, install dependencies and run the existing database migrations:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m alembic upgrade head
```

Ensure the connection string in `backend/.env` matches the actual database, credentials, and port.

### 4. Prepare Podcast Transcripts

The ingestion script expects a prepared dataset layout under:

```text
data/
  lennys-podcast-data/
    index.json
    molly-graham-2.md
    peter-sellis.md
```

The `index.json` file must contain a `podcasts` array with metadata and filenames corresponding to the Markdown files.

The repository includes `backend/download_dataset.py` as a dataset download utility, but source download and preparation of the required index layout have not been validated as a completely automated fresh-install process.

Once the required files are prepared, run from `backend`:

```powershell
.\venv\Scripts\python.exe ingest.py
```

The local evaluation database was verified with two documents and 502 chunks. A fresh database needs its own successful ingestion before grounded answers can be demonstrated.

### 5. Start Ollama

```powershell
ollama pull qwen3:1.7b
ollama list
```

Make sure the Ollama service is running on port `11434`.

### 6. Start the Pi SDK Bridge

Open a new terminal:

```powershell
cd agent-bridge
npm install
npm run setup
npm run build
npm start
```

The setup command creates the required `.pi/models.json` and `.pi/auth.json` from safe templates if they are missing, without overwriting existing files.

Bridge endpoint: `http://127.0.0.1:3001`

### 7. Start FastAPI

From the `backend` directory:

```powershell
.\venv\Scripts\python.exe run.py
```

API: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

**Important:** Run the backend from its own directory so `backend/.env` is loaded correctly.

### 8. Start React

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Application: **http://localhost:5173**

The Vite development server proxies API requests to FastAPI.

---

## Verification and Testing

### Health Endpoints

```text
GET http://localhost:8000/health/live
GET http://localhost:8000/health/ready
GET http://localhost:3001/health
GET http://localhost:11434/api/tags
```

A ready backend should return a successful database status.

### Production Build Checks

```powershell
cd frontend
npm run build
```

```powershell
cd agent-bridge
npm run build
```

### Validation Performed

Local automated and manual testing covered:

- Service availability and database connectivity
- Transcript-grounded RAG responses
- Citation-to-source consistency
- Source Explorer interactions
- Session persistence and isolation
- Founder Fit and Strategy Brief request handling
- Markdown Preview/Source rendering
- Mobile responsiveness
- Frontend and bridge builds

These checks validate the tested local environment, not every possible fresh deployment.

---

## Engineering Trade-offs

| Decision | Benefit | Limitation |
|---|---|---|
| RAG instead of ungrounded answers | Verifiable, transcript-backed context | Retrieval quality affects answer quality |
| PostgreSQL full-text search | Simple indexing without embedding infrastructure | Less semantic flexibility than a vector-based retriever |
| Local Ollama | Local model execution and greater control over data | Slower on resource-constrained hardware |
| Groq Cloud | Faster hosted inference in many cases | Requires network connectivity and external API access |
| Separate Pi SDK bridge | Modular model integration | Additional service to operate |
| Sandboxed artifact preview | Restricts untrusted HTML behavior | Some active HTML features are intentionally blocked |

The system avoids silently switching to another LLM provider when the selected model fails. This keeps failures visible and model behavior predictable.

---

## Deployment Status and Known Limitations

- **Verified environment:** Native local execution of React, FastAPI, Pi SDK bridge, PostgreSQL, and Ollama.
- **Docker:** Preliminary Dockerfiles and Compose configuration are included, but the complete Compose stack has not been validated. The existing Compose file does not fully orchestrate the Pi bridge and corpus initialization.
- **Knowledge base:** Current evaluated corpus is limited to two curated episodes, rather than the entire Lenny's Podcast archive.
- **Fresh setup:** Full database and transcript preparation requires additional setup; a completely fresh-machine installation has not been exhaustively tested.
- **Source grounding:** Citations support verification but do not guarantee every model-generated interpretation is correct.
- **Encoding:** The tested local PostgreSQL installation has legacy WIN1252 considerations. UTF-8 is recommended for new deployments.

---

## Project Documentation

- `PRD.md` — Product requirements and customer/problem framing
- `architecture.md` — Detailed architecture and implementation notes
- `design.md` — UI/UX design decisions
- `AGENT_EXECUTION_LOGS.md` — Agent-assisted development notes
- `DEMO_SCRIPT.md` — Demo walkthrough
- `tests/` and `backend/test_*.py` — Test assets and scripts

**Note:** Some detailed documentation reflects earlier architectural plans. The implementation description and architecture diagram in this README describe the current runtime design.

---

## Product Success Criteria

The system aims to provide:

- Answers with inspectable transcript references
- Reliable retrieval of saved sessions and generated artifacts
- Context-aware founder recommendations
- Action Briefs with seven-day experiments and measurable metrics
- Clear model provider visibility and actionable failure messages

---

## Demo

The demonstration showcases local Ollama inference, source-grounded answers, Source Explorer, Founder Fit, Strategy Brief, Ship 30 essays, and the application architecture.

**Video:** Add the YouTube demo link after recording and uploading.

---

*Built as a Forward Deployed Engineer take-home project, with an emphasis on grounded AI, product usefulness, and practical operational handoff.*
