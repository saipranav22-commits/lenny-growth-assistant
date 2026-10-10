# Demo Script (2-3 Minutes)

**[SCENE 1: Introduction (Camera On)]**
"Hi, I'm presenting the Lenny Growth Assistant for the Oogway Labs assignment. The problem founders face is that research answers from podcasts are difficult to verify and frequently do not translate directly into measurable next actions."

**[SCENE 2: The UI and Chat]**
*Action: Open `http://localhost:5173`. Create a new session.*
"This is a full-stack, RAG-enabled conversational assistant built with React, FastAPI, the Pi Agent SDK, and a PostgreSQL tsvector full-text database. Let's ask: 'What does Molly Graham say about delegation?'"
*Action: Type and submit.*
"The agent pulls exact transcripts from our curated corpus and cites its sources. Notice the speed—we're using Groq cloud inference right now, but you can also seamlessly swap to a local Ollama model for maximum privacy. This is an engineering trade-off: Groq provides latency under 1 second but requires sending data to the cloud, whereas local Ollama gives privacy at the cost of inference speed."

**[SCENE 3: Source Explorer]**
*Action: Click on a citation link in the chat.*
"To build trust, we have the Source Explorer. By clicking any citation, users can see the exact, genuine transcript passage the model used to build its answer, along with metadata like the Episode and Guest. No hallucinated quotes."

**[SCENE 4: Founder Fit Check & Action Brief]**
*Action: Expand the "Founder Fit Context" panel, enter Pre-seed and 8-person team. Click the 'Action Brief' tool button.*
"Generic advice often fails in specific contexts. We built the Founder Fit Check: a lightweight panel to provide company context. When I generate an Action Brief, Lenny creates a highly structured plan."
*Action: Open the generated Action Brief artifact.*
"It structures the advice to evaluate why the insight applies to an 8-person pre-seed startup, and always includes a 'Measurable Success Metric' and practical experiments so founders know exactly what to test."

**[SCENE 5: Ship 30 Essay]**
*Action: Open an older session from the sidebar.*
"For deeper thought leadership, the background agent orchestrates the writing of a full >1,250-word Ship 30 essay. Because we store artifacts and histories in PostgreSQL natively, we can instantly retrieve this essay from an earlier session without regenerating it."
*Action: Show the essay in the Artifact Viewer.*
"Everything is fully sandboxed, scalable, and built for production. Thanks for watching."
