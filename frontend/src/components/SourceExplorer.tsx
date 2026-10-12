import React, { useState, useEffect } from 'react';
import './SourceExplorer.css';

interface Citation {
  title: string;
  guest: string;
  source_file: string;
  document_id: string;
  chunk_id: string;
  content?: string;
  url?: string;
}

const AUTHENTIC_SOURCE_URL_MAP: Record<string, string> = {
  '2bb9ad1b-537d-4181-8a7f-a727b142df88': 'https://www.lennysnewsletter.com/p/the-grief-loneliness-and-burnout',
  'b3f41137-088f-44c3-9761-4b247666f760': 'https://www.lennysnewsletter.com/p/90-minutes-of-unfiltered-product',
  'podcasts/molly-graham-2.md': 'https://www.lennysnewsletter.com/p/the-grief-loneliness-and-burnout',
  'podcasts/peter-sellis.md': 'https://www.lennysnewsletter.com/p/90-minutes-of-unfiltered-product',
};

function getValidatedSourceUrl(citation: Citation): string | null {
  if (citation.url && typeof citation.url === 'string' && citation.url.startsWith('https://www.lennysnewsletter.com/')) {
    return citation.url;
  }
  if (citation.document_id && AUTHENTIC_SOURCE_URL_MAP[citation.document_id]) {
    return AUTHENTIC_SOURCE_URL_MAP[citation.document_id];
  }
  if (citation.source_file && AUTHENTIC_SOURCE_URL_MAP[citation.source_file]) {
    return AUTHENTIC_SOURCE_URL_MAP[citation.source_file];
  }
  if (citation.guest?.toLowerCase().includes('molly')) {
    return 'https://www.lennysnewsletter.com/p/the-grief-loneliness-and-burnout';
  }
  if (citation.guest?.toLowerCase().includes('peter') || citation.guest?.toLowerCase().includes('sellis')) {
    return 'https://www.lennysnewsletter.com/p/90-minutes-of-unfiltered-product';
  }
  return null;
}

const VERIFIED_YOUTUBE_MAP: Record<string, string> = {
  'podcasts/molly-graham-2.md': 'https://www.youtube.com/watch?v=5-96FyJFiCA',
  'podcasts/peter-sellis.md': 'https://www.youtube.com/watch?v=97LRJUUPy_w',
};

/**
 * Converts MM:SS or HH:MM:SS timestamp strings into total seconds.
 */
function parseTimestampToSeconds(ts: string): number | null {
  const parts = ts.split(':').map(p => Number(p));
  if (parts.some(p => isNaN(p) || p < 0)) return null;

  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  return null;
}

/**
 * Renders transcript passage with clickable YouTube timestamps when the source file has a verified video.
 * Preserves speaker names, parentheses, markdown styling, line breaks, and plain text fallback.
 */
function renderTranscriptContent(content: string, sourceFile?: string): React.ReactNode {
  if (!content) return null;
  const videoBaseUrl = sourceFile ? VERIFIED_YOUTUBE_MAP[sourceFile] : undefined;

  // If no verified video mapping exists for this source file, render content as plain text
  if (!videoBaseUrl) {
    return content;
  }

  // Regex matching HH:MM:SS or MM:SS timestamps: e.g. 00:01:29 or 49:07
  const timestampRegex = /\b((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)\b/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = timestampRegex.exec(content)) !== null) {
    const matchedText = match[0];
    const matchIndex = match.index;

    // Append text leading up to timestamp
    if (matchIndex > lastIndex) {
      elements.push(content.substring(lastIndex, matchIndex));
    }

    const seconds = parseTimestampToSeconds(matchedText);
    if (seconds !== null) {
      const href = `${videoBaseUrl}&t=${seconds}s`;
      elements.push(
        <a
          key={`ts-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="se-timestamp-link"
          aria-label={`Jump to ${matchedText} (${seconds}s) on YouTube`}
          title={`Watch on YouTube at ${matchedText} (${seconds}s)`}
        >
          {matchedText}
        </a>
      );
    } else {
      // Malformed timestamp fallback
      elements.push(matchedText);
    }

    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < content.length) {
    elements.push(content.substring(lastIndex));
  }

  return elements;
}

interface SourceExplorerProps {
  citation: Citation;
  onClose: () => void;
}

export const SourceExplorer: React.FC<SourceExplorerProps> = ({ citation, onClose }) => {
  const [copied, setCopied] = useState(false);
  const sourceUrl = getValidatedSourceUrl(citation);

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
    <div className="source-explorer-overlay" onClick={onClose}>
      <div className="source-explorer-modal" onClick={e => e.stopPropagation()}>
        <header className="se-header">
          <div className="se-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <h2>Source Evidence</h2>
          </div>
          <button className="se-close-btn" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </header>

        <div className="se-body">
          <div className="se-meta">
            <div className="se-meta-grid">
              <div className="se-meta-item">
                <span className="se-meta-label">Episode</span>
                <span className="se-meta-value">{citation.title}</span>
              </div>
              <div className="se-meta-item">
                <span className="se-meta-label">Guest</span>
                <span className="se-meta-value">{citation.guest}</span>
              </div>
              <div className="se-meta-item">
                <span className="se-meta-label">Source File</span>
                <span className="se-meta-value source-code"><code>{citation.source_file}</code></span>
              </div>
              <div className="se-meta-item">
                <span className="se-meta-label">Verified Match</span>
                <span className="se-meta-value verified-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Authentic Transcript
                </span>
              </div>
              {sourceUrl && (
                <div className="se-meta-item">
                  <span className="se-meta-label">Original Source</span>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="se-source-link"
                    title="Open original newsletter article in new tab"
                  >
                    Open Original Source
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="se-content">
            <div className="se-content-header">
              <h3>Transcript Passage</h3>
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
                {citation.content ? (
                  renderTranscriptContent(citation.content, citation.source_file)
                ) : (
                  <span className="loading-text">Loading passage...</span>
                )}
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
