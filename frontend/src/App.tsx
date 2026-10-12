import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { SourceExplorer } from './components/SourceExplorer';
import ArtifactViewer from './components/ArtifactViewer';
import { BrandLogo } from './components/BrandLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types ───────────────────────────────────────────────────────────────────
interface Session {
  id: string
  title: string
  created_at: string
}

interface Citation {
  title: string
  guest: string
  source_file: string
  document_id: string
  chunk_id: string
  content?: string
}

interface MessageOut {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  provider: string | null
  model: string | null
  citations?: Citation[] | null
  created_at: string
  artifact_type?: string
  artifact_content?: string
}

// ── API helpers ───────────────────────────────────────────────────────────────
const API_BASE = '/api';

async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

async function createSession(): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

async function fetchChatHistory(sessionId: string): Promise<MessageOut[]> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

// ── Date & Timestamp Helpers ──────────────────────────────────────────────────
/**
 * Safely parses backend timestamps into a Date object.
 * Interprets timezone-naive timestamps (such as FastAPI/SQLAlchemy UTC datetimes)
 * as UTC by appending 'Z'. Preserves timestamps that already contain 'Z' or a timezone offset.
 */
export function parseUtcDate(timestamp: string | undefined | null): Date {
  if (!timestamp) return new Date(NaN);
  const trimmed = String(timestamp).trim();
  if (!trimmed) return new Date(NaN);

  // Check if timestamp already has a timezone indicator:
  // - Ends with 'Z' or 'z'
  // - Has a timezone offset after the time component (e.g. +05:30, -04:00, +0000)
  const hasTimezone = /[zZ]$/.test(trimmed) || /[T\s]\d{2}:\d{2}.*[+-]\d{2}(?::?\d{2})?$/.test(trimmed);
  if (hasTimezone) {
    return new Date(trimmed);
  }

  // Interpret timezone-naive backend datetime with time component as UTC
  if (trimmed.includes('T')) {
    return new Date(`${trimmed}Z`);
  }
  if (trimmed.includes(' ') && /\d{2}:\d{2}/.test(trimmed)) {
    return new Date(`${trimmed.replace(' ', 'T')}Z`);
  }

  return new Date(trimmed);
}

// ── Main App ────────────────────────────────────────────────────────────────
function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showFounderContext, setShowFounderContext] = useState(false);
  const [founderContext, setFounderContext] = useState({
    companyStage: '',
    teamSize: '',
    currentChallenge: '',
    primaryConstraint: ''
  });

  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<{id: string, type: string, content: string, citations?: Citation[]} | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeId) {
      loadHistory(activeId);
      if (window.innerWidth <= 768) setSidebarOpen(false);
    }
  }, [activeId]);

  const generatingEssay = messages.find(
    m => m.artifact_type === 'essay' && m.artifact_content === 'GENERATING...'
  );
  const isEssayGenerating = !!generatingEssay;

  // Bounded polling for background Ship 30 essay generation
  useEffect(() => {
    if (!activeId || !generatingEssay) return;

    let attempts = 0;
    const maxAttempts = 40; // 40 * 2.5s = 100s bounded polling
    const targetMsgId = generatingEssay.id;

    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        return;
      }

      try {
        const latestMsgs = await fetchChatHistory(activeId);
        setMessages(latestMsgs);

        const currentTarget = latestMsgs.find(m => m.id === targetMsgId);
        if (currentTarget) {
          if (currentTarget.artifact_content !== 'GENERATING...') {
            clearInterval(timer);
            setActiveArtifact(prev => {
              if (prev && prev.id === targetMsgId) {
                return {
                  id: currentTarget.id,
                  type: currentTarget.artifact_type || prev.type,
                  content: currentTarget.artifact_content || prev.content,
                  citations: currentTarget.citations || prev.citations
                };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Ship 30 essay polling error:', err);
      }
    }, 2500);

    return () => {
      clearInterval(timer);
    };
  }, [activeId, generatingEssay?.id, generatingEssay?.artifact_content]);

  async function loadSessions() {
    try {
      const data = await fetchSessions();
      setSessions(data);
      if (data.length > 0 && !activeId) setActiveId(data[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadHistory(id: string) {
    setLoading(true);
    try {
      const data = await fetchChatHistory(id);
      setMessages(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewSession() {
    try {
      const s = await createSession();
      setSessions([s, ...sessions]);
      setActiveId(s.id);
      setMessages([]);
      setActiveArtifact(null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeId) return;
    const text = input.trim();
    setInput('');
    setError(null);

    const tempUserMsg: MessageOut = {
      id: Date.now().toString(),
      session_id: activeId,
      role: 'user',
      content: text,
      provider: null,
      model: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeId, message: text }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.detail || 'Failed to send message');
      }
      await loadHistory(activeId);
    } catch (err: any) {
      setError(err.message);
      setInput(text);
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  }

  async function generateArtifact(type: 'action_brief' | 'essay' | 'markdown' | 'html/css') {
    if (!activeId) return;

    // Use latest meaningful user growth question from the current session as the topic
    const latestUserMsg = [...messages].reverse().find(m => m.role === 'user' && m.content && m.content.trim().length > 0);
    const latestQuestion = latestUserMsg ? latestUserMsg.content.trim() : '';

    if (!latestQuestion) {
      setError('Please ask a growth strategy question first before generating a brief.');
      document.getElementById('message-input')?.focus();
      return;
    }

    if (type === 'essay' && isEssayGenerating) {
      setError('A Ship 30 essay is already generating for this conversation. Please wait for it to complete.');
      return;
    }

    setLoading(true);
    setError(null);

    let endpoint = `${API_BASE}/artifacts`;
    let payload: any = {
      session_id: activeId,
      format: type,
      topic: latestQuestion,
      company_stage: showFounderContext ? founderContext.companyStage || null : null,
      team_size: showFounderContext ? founderContext.teamSize || null : null,
      current_challenge: showFounderContext ? founderContext.currentChallenge || null : null,
      primary_constraint: showFounderContext ? founderContext.primaryConstraint || null : null
    };

    if (type === 'essay') {
      endpoint = `${API_BASE}/skills/ship30`;
      payload = {
        session_id: activeId,
        topic: latestQuestion
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.detail || 'Failed to generate artifact');
      }
      const newMsg: MessageOut = await res.json();
      await loadHistory(activeId);
      if (newMsg && newMsg.artifact_type && newMsg.artifact_content) {
        setActiveArtifact({
          id: newMsg.id,
          type: newMsg.artifact_type,
          content: newMsg.artifact_content,
          citations: newMsg.citations || undefined
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (ts: string) => {
    try {
      const d = parseUtcDate(ts);
      if (isNaN(d.getTime())) return '';
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return timeStr.replace(/\b(am|pm)\b/i, m => m.toUpperCase());
    } catch {
      return '';
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = parseUtcDate(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      {/* Mobile Overlay */}
      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <BrandLogo size={36} variant="sidebar" />
            <span className="logo-text">Lenny Growth Assistant</span>
          </div>
          <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewSession}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Strategy Session
        </button>

        <div className="session-list">
          {sessions.length === 0 ? (
            <div className="empty-hint">No sessions yet</div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                className={`session-item ${s.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(s.id)}
              >
                <span className="session-title">{s.title || 'Conversation'}</span>
                <span className="session-date">{formatDate(s.created_at)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-area">
        <header className="chat-header">
          <div className="chat-header-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h1>
              {activeId
                ? (sessions.find(s => s.id === activeId)?.title ?? 'Conversation')
                : 'The Lenny Growth Assistant'}
            </h1>
          </div>
          {(() => {
            const lastAssistantMsg = messages.filter(m => m.role === 'assistant').pop();
            if (lastAssistantMsg) {
              const providerName = lastAssistantMsg.provider === 'groq' ? 'Groq Cloud' :
                                   lastAssistantMsg.provider === 'ollama' ? 'Local Ollama' :
                                   (lastAssistantMsg.provider || 'Unknown Provider');
              return (
                <span className="provider-badge">
                  {providerName}{lastAssistantMsg.model ? `: ${lastAssistantMsg.model}` : ''}
                </span>
              );
            }
            return <span className="provider-badge provider-default">No Active Provider</span>;
          })()}
        </header>

        {/* Workflow Indicator */}
        <div className="workflow-navigator">
          <div className="workflow-step completed">
            <span className="step-num">1</span> Ask
          </div>
          <div className="workflow-arrow"></div>
          <div className="workflow-step active">
            <span className="step-num">2</span> Verify
          </div>
          <div className="workflow-arrow"></div>
          <div className="workflow-step">
            <span className="step-num">3</span> Founder Fit
          </div>
          <div className="workflow-arrow"></div>
          <div className="workflow-step">
            <span className="step-num">4</span> Act
          </div>
        </div>

        <div className="messages">
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <div className="welcome-hero-icon">
                <BrandLogo size={48} variant="welcome" />
              </div>
              <h2>Welcome to Lenny Growth Assistant.</h2>
              <p className="subtitle">
                Growth Intelligence Studio. Turn Lenny's podcast wisdom into actionable strategies. Ask questions, verify evidence against authentic transcripts, and generate tactical briefs tailored to your startup.
              </p>

              <div className="welcome-actions">
                <button className="welcome-action-btn" onClick={() => setInput("What are the most common early-stage growth mistakes?")}>
                  <span className="action-icon">🎙️</span>
                  <div>
                    <h3>Explore Podcast Insights</h3>
                    <p>Find evidence-backed answers.</p>
                  </div>
                </button>
                <button className="welcome-action-btn" onClick={() => setInput("How did successful founders find their first 1000 users?")}>
                  <span className="action-icon">🚀</span>
                  <div>
                    <h3>First 1000 Users</h3>
                    <p>Analyze acquisition strategies.</p>
                  </div>
                </button>
                <button className="welcome-action-btn" onClick={() => { setShowFounderContext(true); document.getElementById('message-input')?.focus(); }}>
                  <span className="action-icon">🎯</span>
                  <div>
                    <h3>Check Founder Fit</h3>
                    <p>Contextualize advice for your stage.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`message ${m.role}`}>
              <div className="bubble">
                {m.role === 'assistant' ? (
                  <div className="assistant-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="user-content">{m.content}</div>
                )}

                {m.citations && m.citations.length > 0 && (
                  <div className="citations-container">
                    <div className="citations-header">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Verified Evidence
                    </div>
                    <ul className="citations-list">
                      {m.citations.map((c, i) => (
                        <li key={i}>
                          <button
                            className="citation-link"
                            onClick={() => setActiveCitation(c)}
                            title={`${c.title} (Source: ${c.source_file}, Chunk #${c.chunk_id})`}
                            aria-label={`Evidence passage ${i + 1}: ${c.guest || c.title}, chunk ${c.chunk_id}`}
                          >
                            <span className="citation-num">#{i + 1}</span>
                            <span className="citation-guest">{c.guest || c.title}</span>
                            {c.chunk_id && <span className="citation-chunk-pill">Chunk {c.chunk_id}</span>}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="citation-check-icon">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {m.artifact_type && m.artifact_content && (
                <button className={`view-artifact-btn ${m.artifact_type.toLowerCase() === 'error' ? 'error-btn' : ''}`} onClick={() => setActiveArtifact({
                  id: m.id, type: m.artifact_type!, content: m.artifact_content!
                })}>
                  {m.artifact_type.toLowerCase() === 'error' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  )}
                  View {m.artifact_type.toUpperCase()} Artifact
                </button>
              )}

              <div className="meta">
                {m.role === 'assistant' && (
                  <span className="model-tag">
                    {m.provider === 'groq' ? 'Groq Cloud' : (m.provider === 'ollama' ? 'Local Ollama' : (m.provider || 'Unknown Provider'))}
                    {m.model ? `: ${m.model}` : ''}
                  </span>
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
            <div className="error-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Sticky Composer */}
        <div className="sticky-composer">
          <div className={`founder-context-panel ${showFounderContext ? 'expanded' : ''}`}>
            <button className="founder-context-header" onClick={() => setShowFounderContext(!showFounderContext)}>
              <div className="founder-context-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                Founder Fit Context
                <span className="optional-tag">Optional</span>
              </div>
              <div className="founder-context-toggle">
                {showFounderContext ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                )}
              </div>
            </button>

            {showFounderContext && (
              <div className="founder-context-body">
                <p className="founder-context-desc">Ground the assistant's recommendations in your specific startup reality.</p>
                <div className="founder-context-grid">
                  <div className="form-group">
                    <label>Company Stage</label>
                    <input type="text" className="founder-context-input" placeholder="e.g. Pre-seed, Series A" value={founderContext.companyStage} onChange={e => setFounderContext({...founderContext, companyStage: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Team Size</label>
                    <input type="text" className="founder-context-input" placeholder="e.g. 5, 20" value={founderContext.teamSize} onChange={e => setFounderContext({...founderContext, teamSize: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Current Challenge</label>
                    <input type="text" className="founder-context-input" placeholder="e.g. High churn rate" value={founderContext.currentChallenge} onChange={e => setFounderContext({...founderContext, currentChallenge: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Primary Constraint</label>
                    <input type="text" className="founder-context-input" placeholder="e.g. Zero marketing budget" value={founderContext.primaryConstraint} onChange={e => setFounderContext({...founderContext, primaryConstraint: e.target.value})} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="artifact-actions-bar">
            <button className="artifact-btn" disabled={loading || !activeId} onClick={() => generateArtifact('action_brief')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-experiment)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Strategy Brief
            </button>
            <button
              className="artifact-btn"
              disabled={loading || !activeId || isEssayGenerating}
              onClick={() => generateArtifact('essay')}
              title={isEssayGenerating ? 'Ship 30 Essay generation in progress...' : 'Generate Ship 30 Essay'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-evidence)" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              {isEssayGenerating ? 'Generating...' : 'Ship 30 Essay'}
            </button>
            <button className="artifact-btn" disabled={loading || !activeId} onClick={() => generateArtifact('markdown')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              Raw MD
            </button>
            <button className="artifact-btn" disabled={loading || !activeId} onClick={() => generateArtifact('html/css')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-focus, #3B82F6)" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              HTML/CSS
            </button>
          </div>

          <div className="input-area">
            <textarea
              id="message-input"
              className="message-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about growth strategy... (Enter to send)"
              disabled={loading || !activeId}
              rows={2}
            />
            <button
              id="send-btn"
              className="send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim() || !activeId}
            >
              {loading ? <div className="spinner"></div> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
            </button>
          </div>
        </div>
      </main>

      {/* Artifact Viewer Side Panel */}
      {activeArtifact && (
        <ArtifactViewer artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
      )}

      {/* Modals */}
      {activeCitation && <SourceExplorer citation={activeCitation} onClose={() => setActiveCitation(null)} />}
    </div>
  );
}

export default App;
