import ArtifactViewer from './components/ArtifactViewer';
import { SourceExplorer } from './components/SourceExplorer';
import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface SessionOut {
  id: string
  title: string
  created_at: string
  artifact_type?: string
  artifact_content?: string
  updated_at: string
}

interface MessageOut {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  provider: string | null
  model: string | null
  citations?: { title: string, guest: string, source_file: string }[] | null
  created_at: string
  artifact_type?: string
  artifact_content?: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [sessions, setSessions] = useState<SessionOut[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageOut[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeArtifact, setActiveArtifact] = useState<any>(null)
  const [activeCitation, setActiveCitation] = useState<any>(null)
  
  const [founderContext, setFounderContext] = useState({
    companyStage: '',
    teamSize: '',
    currentChallenge: '',
    primaryConstraint: ''
  })
  const [showFounderContext, setShowFounderContext] = useState(false)
  
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load session list
  const loadSessions = useCallback(async () => {
    try {
      const data = await apiFetch<SessionOut[]>('/api/sessions')
      setSessions(data)
    } catch (e) {
      console.error('Failed to load sessions:', e)
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Load messages for active session
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    apiFetch<MessageOut[]>(`/api/sessions/${activeId}/messages`)
      .then(setMessages)
      .catch(e => setError(String(e)))
  }, [activeId])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Create new session
  const newChat = async () => {
    setError(null)
    try {
      const s = await apiFetch<SessionOut>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Chat' }),
      })
      setSessions(prev => [s, ...prev])
      setActiveId(s.id)
      setMessages([])
      setInput('')
    } catch (e) {
      setError(String(e))
    }
  }

  // Send message
  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    if (!activeId) {
      setError('Please create or select a conversation first.')
      return
    }

    setInput('')
    setLoading(true)
    setError(null)

    // Optimistic user message
    const tempUser: MessageOut = {
      id: crypto.randomUUID(),
      session_id: activeId,
      role: 'user',
      content: text,
      provider: null,
      model: null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUser])

    try {
      const res = await apiFetch<{
        user_message: MessageOut
        assistant_message: MessageOut
      }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ session_id: activeId, message: text }),
      })

      setMessages(prev => {
        // Replace optimistic user msg + append assistant
        const without = prev.filter(m => m.id !== tempUser.id)
        return [...without, res.user_message, res.assistant_message]
      })

      // Refresh session list for updated title
      loadSessions()
    } catch (e) {
      setError(String(e))
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUser.id))
    } finally {
      setLoading(false)
    }
  }

    const generateArtifact = async (type: string) => {
    if (!activeId || loading) return;
    setLoading(true);
    setError(null);
    try {
      let res;
      if (type === 'essay') {
        res = await apiFetch<MessageOut>('/api/skills/ship30', {
          method: 'POST',
          body: JSON.stringify({ session_id: activeId, topic: input || "Write about the main topic of our conversation" })
        });
      } else if (type === 'action_brief') {
        res = await apiFetch<MessageOut>('/api/artifacts', {
          method: 'POST',
          body: JSON.stringify({ 
            session_id: activeId, 
            format: type, 
            topic: input || "Summarize the conversation",
            company_stage: founderContext.companyStage,
            team_size: founderContext.teamSize,
            current_challenge: founderContext.currentChallenge,
            primary_constraint: founderContext.primaryConstraint
          })
        });
      } else {
        res = await apiFetch<MessageOut>('/api/artifacts', {
          method: 'POST',
          body: JSON.stringify({ session_id: activeId, format: type, topic: input || "Summarize the conversation" })
        });
      }
      setMessages(prev => [...prev, res]);
      setActiveArtifact({ id: res.id, type: res.artifact_type, content: res.artifact_content, citations: res.citations });
      setInput('');
      
      if (res.artifact_content === "GENERATING...") {
          const checkSessionId = activeId;
          const intervalId = setInterval(async () => {
              try {
                  const checkMsgs = await apiFetch<MessageOut[]>(`/api/sessions/${checkSessionId}/messages`);
                  const updatedRes = checkMsgs.find(m => m.id === res.id);
                  if (updatedRes) {
                      setMessages(prev => prev.map(m => m.id === res.id ? updatedRes : m));
                      if (updatedRes.artifact_content !== "GENERATING...") {
                          clearInterval(intervalId);
                          setActiveArtifact({ id: updatedRes.id, type: updatedRes.artifact_type, content: updatedRes.artifact_content, citations: updatedRes.citations });
                      }
                  }
              } catch (e) {
                  clearInterval(intervalId);
                  console.error(e);
              }
          }, 3000);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <span className="logo-text">🌱 Lenny</span>
          <button
            className="toggle-btn"
            onClick={() => setSidebarOpen(v => !v)}
            title="Toggle sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {sidebarOpen && (
          <>
            <button className="new-chat-btn" onClick={newChat} id="new-chat-btn">
              + New Chat
            </button>

            <nav className="session-list">
              {sessions.length === 0 && (
                <p className="empty-hint">No conversations yet</p>
              )}
              {sessions.map(s => (
                <button
                  key={s.id}
                  className={`session-item ${s.id === activeId ? 'active' : ''}`}
                  onClick={() => { setActiveId(s.id); setError(null) }}
                >
                  <span className="session-title">{s.title}</span>
                  <span className="session-date">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </nav>
          </>
        )}
      </aside>

      {/* Main chat area */}
      <main className="chat-area">
        {/* Header */}
        <header className="chat-header">
          <h1>
            {activeId
              ? (sessions.find(s => s.id === activeId)?.title ?? 'Chat')
              : 'Lenny Growth Assistant'}
          </h1>
          <span className="provider-badge">Local: qwen3:1.7b</span>
        </header>

        {/* Messages */}
        <div className="messages" id="message-list">
          {!activeId && (
            <div className="welcome">
              <h2>Welcome to Lenny 🌱</h2>
              <p>Your local AI growth strategy assistant.</p>
              <p>Click <strong>+ New Chat</strong> to start a conversation.</p>
            </div>
          )}

          {activeId && messages.length === 0 && !loading && (
            <div className="welcome">
              <p>Ask anything about product growth, retention, or go-to-market strategy.</p>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`message ${m.role}`}>
              <div className="bubble">
                <pre className="content">{m.content}</pre>
                {m.citations && m.citations.length > 0 && (
                  <div className="citations" style={{ marginTop: '10px', fontSize: '0.85em', color: 'var(--text-color, #666)', borderTop: '1px solid var(--border-color, #ccc)', paddingTop: '5px', opacity: 0.8 }}>
                    <strong>Sources:</strong>
                    <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                      {m.citations.map((c, i) => (
                        <li key={i}>
                          <a href="#" onClick={(e) => { e.preventDefault(); setActiveCitation(c); }} style={{ color: 'var(--accent-color, #2a9d8f)', textDecoration: 'none' }}>
                            {c.title} (Guest: {c.guest})
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                            </div>
              {m.artifact_type && (
                <button className="view-artifact-btn" onClick={() => setActiveArtifact({
                  id: m.id, type: m.artifact_type, content: m.artifact_content, citations: m.citations
                })} style={{marginTop: '10px', fontSize: '0.9em'}}>
                  " View {m.artifact_type.toUpperCase()} Artifact
                </button>
              )}
              <div className="meta">
                {m.role === 'assistant' && m.model && (
                  <span className="model-tag">Local: {m.model}</span>
                )}
                <span className="time">{formatTime(m.created_at)}</span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="bubble loading">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" id="error-banner">
              ⚠️ {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Founder Context Panel */}
        <div className="founder-context-panel" style={{ padding: '10px 15px', background: 'var(--panel-bg, #f8f9fa)', borderTop: '1px solid var(--border-color, #e0e0e0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9em', color: 'var(--text-color, #333)' }} onClick={() => setShowFounderContext(!showFounderContext)}>
            <span>Founder Fit Context (Optional - Enhances Action Brief)</span>
            <span>{showFounderContext ? '▼' : '▶'}</span>
          </div>
          {showFounderContext && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <input type="text" placeholder="Company Stage (e.g. Pre-seed)" style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} value={founderContext.companyStage} onChange={e => setFounderContext({...founderContext, companyStage: e.target.value})} />
              <input type="text" placeholder="Team Size (e.g. 8)" style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} value={founderContext.teamSize} onChange={e => setFounderContext({...founderContext, teamSize: e.target.value})} />
              <input type="text" placeholder="Current Challenge" style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} value={founderContext.currentChallenge} onChange={e => setFounderContext({...founderContext, currentChallenge: e.target.value})} />
              <input type="text" placeholder="Primary Constraint" style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} value={founderContext.primaryConstraint} onChange={e => setFounderContext({...founderContext, primaryConstraint: e.target.value})} />
            </div>
          )}
        </div>

        {/* Artifact Actions */}
        <div className="artifact-actions-bar">
          <button disabled={loading || !activeId} onClick={() => generateArtifact('action_brief')} title="Generate Action Brief">?" Action Brief</button>
          <button disabled={loading || !activeId} onClick={() => generateArtifact('essay')} title="Generate Ship 30 Essay">? Ship 30 Essay</button>
          <button disabled={loading || !activeId} onClick={() => generateArtifact('markdown')} title="Generate Markdown Artifact">?" Markdown</button>
        </div>
        {/* Input */}
        <div className="input-area">
          <textarea
            id="message-input"
            className="message-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about growth strategy… (Enter to send, Shift+Enter for newline)"
            disabled={loading || !activeId}
            rows={3}
          />
          <button
            id="send-btn"
            className="send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim() || !activeId}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </main>
      {activeArtifact && <ArtifactViewer artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />}
      {activeCitation && <SourceExplorer citation={activeCitation} onClose={() => setActiveCitation(null)} />}
    </div>
  )
}



