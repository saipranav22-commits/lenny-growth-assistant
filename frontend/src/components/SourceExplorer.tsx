import React, { useState, useEffect } from 'react';
import './SourceExplorer.css';

interface Citation {
  title: string;
  guest: string;
  source_file: string;
  document_id: string;
  chunk_id: string;
  content?: string;
}

interface SourceExplorerProps {
  citation: Citation;
  onClose: () => void;
}

export const SourceExplorer: React.FC<SourceExplorerProps> = ({ citation, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    if (citation.content) {
      navigator.clipboard.writeText(citation.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="source-explorer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="se-title">
      <div className="source-explorer-modal" onClick={e => e.stopPropagation()}>
        <header className="se-header">
          <div className="se-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h2 id="se-title">Source Evidence Explorer</h2>
          </div>
          <button className="se-close-btn" onClick={onClose} title="Close (Esc)" aria-label="Close dialog">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className="se-body">
          <div className="se-meta">
            <div className="se-meta-grid">
              <div className="se-meta-item">
                <span className="se-meta-label">Episode Title</span>
                <span className="se-meta-value">{citation.title}</span>
              </div>
              <div className="se-meta-item">
                <span className="se-meta-label">Podcast Guest</span>
                <span className="se-meta-value">{citation.guest}</span>
              </div>
              <div className="se-meta-item">
                <span className="se-meta-label">Transcript Source</span>
                <span className="se-meta-value source-code"><code>{citation.source_file}</code></span>
              </div>
              <div className="se-meta-item">
                <span className="se-meta-label">Verified Chunk</span>
                <span className="se-meta-value verified-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Chunk #{citation.chunk_id || 'Authentic'}
                </span>
              </div>
            </div>
          </div>

          <div className="se-content">
            <div className="se-content-header">
              <h3>Genuine Transcript Passage</h3>
              <button className="se-copy-btn" onClick={handleCopy} disabled={!citation.content}>
                {copied ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Text</>
                )}
              </button>
            </div>
            <div className="se-transcript-box">
              <blockquote>
                {citation.content ? citation.content : <span className="loading-text">Loading passage...</span>}
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
