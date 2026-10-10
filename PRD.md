# Product Requirements Document (PRD)

## Target Customer
Founders, product managers, and software engineers navigating hyper-growth transitions, looking for specific, actionable insights abstracted directly from industry experts via the Lenny's Podcast repository.

## User Problems
- Parsing hours of podcasts to find specific answers (e.g. "how do I give away my Legos?") is time-consuming.
- Generic LLM advice hallucinates facts or outputs generic platitudes instead of domain-expert insights.
- Generating long-form cohesive material based exclusively on factual transcripts is difficult and requires extensive prompt engineering.

## Primary Workflows
1. **Chat & Retrieval**: The user asks a question. The system searches the semantic database for relevant chunks, citations are extracted, and a factual answer is streamed to the UI.
2. **Essay Generation (Ship 30)**: The user requests a Ship 30 essay on a specific topic. The system uses a multi-agent orchestrated pipeline to sequentially draft an extended (1,200+ word) essay across multiple sections, persisting it safely for UI display.
3. **Artifact Review**: The user opens generated content within an interactive pane, separating complex outputs from the main chat feed.

## Product Requirements
- Must securely interface with Groq (Cloud) and Ollama (Local) for AI inference.
- Must persist conversational history securely in a PostgreSQL database without loss of character encodings.
- Must execute the "Ship 30" essay generation as a background task, reaching an arbitrary word constraint (>1,200 words).
- Must cite podcast sources appropriately alongside user queries.

## Success Metrics
- **Performance**: Groq chat responses return TTFB in < 2 seconds.
- **Accuracy**: 100% of generated Ship 30 essays cite transcript chunk origins safely.
- **Reliability**: No database crashes from malformed characters or rate limit panics.

## Assumptions and Trade-offs
- The database is locked to `WIN1252` encoding by default. We trade off emoji compatibility to favor application-level string normalization without forcing destructive database migrations.
- The Pi bridge orchestration relies exclusively on Node.js to bridge the SDK logic, so two separate backends (FastAPI + Node.js) run simultaneously.\n