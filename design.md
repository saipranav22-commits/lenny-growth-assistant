# Design Document

## UX Decisions
- **Split Pane Interface**: The primary view is split horizontally on desktop. Chat history dominates the left pane, while complex Artifacts (like the Ship 30 essay or code snippets) slide open on the right pane.
- **Provider Switching**: A dedicated dropdown explicitly dictates model usage to reassure users of data privacy when selecting Ollama vs Groq.
- **Non-blocking Workflows**: Expensive tasks (like the multi-stage Ship 30 essay) yield an immediate "GENERATING..." message and update polling ensures the user isn't stuck behind a frozen browser.

## Layout Components
- **Sidebar**: Manages session history. Sorted chronologically.
- **Chat Feed**: Displays user messages and system responses. Integrates a 'Citations' block directly below assistant messages.
- **ArtifactViewer.tsx**: A custom sandboxed environment supporting Markdown (`ReactMarkdown`) and HTML/CSS (`iframe`) rendering. Features one-click source copy.

## Responsive Behavior
- Desktop: Flexbox split (Chat 60% / Artifact 40%).
- Mobile: Artifact Viewer takes over the full viewport when active, functioning as an overlay with a prominent "X" close button to return to the chat stream.\n