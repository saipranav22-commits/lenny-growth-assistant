# Architecture Document

## System Diagram
`React (Frontend)` <-> `FastAPI (Backend)` <-> `Node.js Pi Bridge` <-> `Groq / Ollama (LLM)`
                          |
                          v
                    `PostgreSQL`

## Core Components
1. **Frontend (React)**: Maintains application state. Connects to the backend via polling and standard REST API calls.
2. **Backend (FastAPI)**: Central coordinator. Handles database transactions (SQLAlchemy) and semantic RAG search via `pgvector`.
3. **Bridge (Node.js)**: Runs the official Pi Agent SDK. It handles tool registration (Ship 30 skill, database search) and provider execution.

## Data Flow: RAG
- The backend executes a `pgvector` similarity search combining full-text and semantic embedding lookups.
- Matches are compiled into context blocks and sent alongside the user prompt to the Pi Bridge.
- The bridge delegates to the Groq/Ollama model, maintaining context window boundaries.

## Security Boundaries
- **HTML Artifacts**: Dynamically generated HTML is sanitized and rendered inside an `iframe` with rigid CSP sandboxing to prevent XSS.
- **API Keys**: Only ever exposed in the isolated `.env` configuration file. No client-side exposure.

## Error Handling
- Rate Limits (HTTP 429) from Groq trigger deterministic, exponent backoff inside the Bridge execution loop.
- `UntranslatableCharacter` exceptions from PostgreSQL are mitigated via standard application-level UTF8 to WIN1252 replacements before commit flushes.\n