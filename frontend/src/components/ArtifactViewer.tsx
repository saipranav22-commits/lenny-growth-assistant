import { useState } from 'react';
import './ArtifactViewer.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Artifact {
  id: string;
  type: string; // 'essay', 'action_brief', 'markdown', 'html/css', 'error'
  content: string;
  title?: string;
  citations?: any[];
}

interface ArtifactViewerProps {
  artifact: Artifact | null;
  onClose: () => void;
}

/**
 * Strips outer enclosing Markdown code fences (e.g. ```markdown ... ``` or ``` ... ```)
 * so that ReactMarkdown renders actual headings, paragraphs, lists, and tables instead
 * of displaying the entire document inside a single code block.
 * Preserves internal code fences and leaves the original content untouched for Source view.
 */
export function stripOuterCodeFences(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);

  // Find first non-empty line
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) return text;

  const firstLineTrimmed = lines[startIdx].trim();
  // Check if first non-empty line is an opening code fence (```, ```markdown, ```md, etc.)
  const openFenceMatch = /^`{3,}\s*(?:markdown|md|[a-zA-Z0-9_-]+)?\s*$/i.test(firstLineTrimmed);
  if (!openFenceMatch) {
    return text;
  }

  // Find the matching closing fence line
  let depth = 1;
  let closeIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```')) {
      // If line has an info string (e.g. ```sql, ```python), it opens a nested code block
      if (/^`{3,}\s*[a-zA-Z0-9_-]+/i.test(trimmed)) {
        depth++;
      } else if (/^`{3,}\s*$/.test(trimmed)) {
        // Line containing only backticks (and optional harmless whitespace) closes a block
        depth--;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }
  }

  // Fallback: if depth didn't reach 0, search backwards for any line with only closing backticks
  if (closeIdx === -1) {
    for (let i = lines.length - 1; i > startIdx; i--) {
      if (/^`{3,}\s*$/.test(lines[i].trim())) {
        closeIdx = i;
        break;
      }
    }
  }

  if (closeIdx !== -1) {
    // Return all lines excluding startIdx and closeIdx
    const remaining = [
      ...lines.slice(0, startIdx),
      ...lines.slice(startIdx + 1, closeIdx),
      ...lines.slice(closeIdx + 1)
    ];
    return remaining.join('\n');
  }

  // If no closing fence found, strip at least the opening fence line
  const remaining = [
    ...lines.slice(0, startIdx),
    ...lines.slice(startIdx + 1)
  ];
  return remaining.join('\n');
}

/**
 * Safely prepares HTML content for the sandboxed iframe preview.
 * - Strips outer enclosing code fences (```html ... ```) if present.
 * - Preserves complete HTML document structure (<!DOCTYPE html>, <html>, <head>, <body>).
 * - Enforces the strict Content Security Policy inside <head>.
 * - Wraps HTML fragments cleanly without corrupting document structure.
 */
export function prepareSecureHtml(rawContent: string): string {
  if (!rawContent) return '';
  const content = stripOuterCodeFences(rawContent).trim();

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; script-src 'none';">`;

  // Check if content is already a full HTML document
  const isFullDoc = /<!doctype\s+html/i.test(content) || /<html[\s>]/i.test(content);

  if (isFullDoc) {
    if (/<head[\s>]/i.test(content)) {
      if (!content.includes('Content-Security-Policy')) {
        return content.replace(/<head([^>]*)>/i, `<head$1>\n    ${cspMeta}`);
      }
      return content;
    }
    if (/<html[\s>]/i.test(content)) {
      return content.replace(/<html([^>]*)>/i, `<html$1>\n  <head>\n    ${cspMeta}\n  </head>`);
    }
    return `${cspMeta}\n${content}`;
  }

  // HTML fragment: wrap in standard container
  return `<!DOCTYPE html>
<html>
  <head>
    ${cspMeta}
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}

export default function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);

  if (!artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHtml = artifact.type === 'html/css';
  const isError = artifact.type.toLowerCase() === 'error' || artifact.content.includes('Failed to generate');
  const isEssay = artifact.type === 'essay';
  const isActionBrief = artifact.type === 'action_brief';

  // Secure HTML wrapper
  const secureHtmlContent = prepareSecureHtml(artifact.content);

  // Clean up legacy mojibake characters (UTF-8 bytes misinterpreted as latin-1)
  const sanitizedContent = (artifact.content || '')
    .replace(/\u00e2\u0080\u0093/g, '–')
    .replace(/\u00e2\u0080\u0094/g, '—')
    .replace(/\u00e2\u0080\u0098/g, '‘')
    .replace(/\u00e2\u0080\u0099/g, '’')
    .replace(/\u00e2\u0080\u009c/g, '“')
    .replace(/\u00e2\u0080\u009d/g, '”')
    .replace(/\u00e2\u0080\u00a2/g, '•')
    .replace(/\u00e2\u0086\u0092/g, '→');

  // Strip enclosing outer code fences for Preview so headings and tables render natively
  const previewContent = stripOuterCodeFences(sanitizedContent);

  const extractText = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join(' ');
    if (node.props && node.props.children) return extractText(node.props.children);
    return String(node);
  };

  const renderHeading = (Tag: 'h2' | 'h3', props: any, children: any) => {
    if (isEssay) {
      return Tag === 'h2' ? (
        <h2 className="editorial-h2" {...props}>{children}</h2>
      ) : (
        <h3 className="editorial-h3" {...props}>{children}</h3>
      );
    }
    if (isActionBrief) {
      const rawText = extractText(children).toLowerCase();
      let badgeText = '';
      let badgeClass = '';
      let highlightClass = '';

      if (rawText.includes('recommendation')) {
        badgeText = 'RECOMMENDATION';
        badgeClass = 'badge-coral';
        highlightClass = 'highlight-recommendation';
      } else if (rawText.includes('metric') || rawText.includes('success metric')) {
        badgeText = 'MEASURABLE METRIC';
        badgeClass = 'badge-gold';
        highlightClass = 'highlight-metric';
      } else if (rawText.includes('experiment') || rawText.includes('sevenday') || rawText.includes('seven-day')) {
        badgeText = '7-DAY EXPERIMENT';
        badgeClass = 'badge-teal';
        highlightClass = 'highlight-experiment';
      } else if (rawText.includes('apply') || rawText.includes('applicability')) {
        badgeText = 'APPLICABILITY ANALYSIS';
        badgeClass = 'badge-navy';
        highlightClass = 'highlight-context';
      } else if (rawText.includes('insight') || rawText.includes('evidence')) {
        badgeText = 'PODCAST-BACKED INSIGHT';
        badgeClass = 'badge-teal';
        highlightClass = 'highlight-evidence';
      } else if (rawText.includes('situation') || rawText.includes('founder') || rawText.includes('business')) {
        badgeText = 'FOUNDER CONTEXT';
        badgeClass = 'badge-navy';
        highlightClass = 'highlight-context';
      } else if (rawText.includes('risk') || rawText.includes('limitation')) {
        badgeText = 'RISK / LIMITATION';
        badgeClass = 'badge-ruby';
        highlightClass = 'highlight-risk';
      } else if (rawText.includes('citation') || rawText.includes('supporting')) {
        badgeText = 'SUPPORTING CITATIONS';
        badgeClass = 'badge-navy';
        highlightClass = 'highlight-evidence';
      }

      const HeadingTag = Tag === 'h2' ? 'h2' : 'h3';
      const headingClass = Tag === 'h2' ? 'ab-h2' : 'ab-h3';

      if (badgeText) {
        return (
          <div className={`ab-section-container ${highlightClass}`}>
            <span className={`ab-pill-badge ${badgeClass}`}>{badgeText}</span>
            <HeadingTag className={headingClass} {...props}>{children}</HeadingTag>
          </div>
        );
      }
      return <HeadingTag className={headingClass} {...props}>{children}</HeadingTag>;
    }
    return Tag === 'h2' ? (
      <h2 className="artifact-h2" {...props}>{children}</h2>
    ) : (
      <h3 className="artifact-h3" {...props}>{children}</h3>
    );
  };

  return (
    <aside className={`artifact-viewer-container ${isEssay ? 'wide' : ''}`}>
      <div className="artifact-header">
        <div className="artifact-title">
          {isError ? (
            <><span className="icon error">⚠️</span><h3>Generation Failed</h3></>
          ) : isActionBrief ? (
            <><span className="icon">💡</span><h3>Strategy Action Brief</h3></>
          ) : isEssay ? (
            <><span className="icon">📝</span><h3>Ship 30 Editorial</h3></>
          ) : isHtml ? (
            <><span className="icon">🌐</span><h3>HTML / CSS ARTIFACT</h3></>
          ) : (
            <><span className="icon">📄</span><h3>{artifact.type.toUpperCase()}</h3></>
          )}
        </div>
        <div className="artifact-actions">
          <button className="icon-btn" onClick={handleCopy} title="Copy Content">
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-evidence)" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            )}
          </button>
          <button className="icon-btn" onClick={onClose} title="Close Panel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {!isError && (
        <div className="artifact-tabs">
          <button
            className={activeTab === 'preview' ? 'active' : ''}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          <button
            className={activeTab === 'source' ? 'active' : ''}
            onClick={() => setActiveTab('source')}
          >
            Source
          </button>
        </div>
      )}

      <div className="artifact-content-area">
        {activeTab === 'source' && !isError ? (
          <pre className="artifact-source">{artifact.content}</pre>
        ) : (
          <div className={`artifact-preview ${artifact.type} ${isEssay ? 'editorial-reader' : ''}`}>
            {isHtml ? (
              <iframe
                srcDoc={secureHtmlContent}
                sandbox=""
                title="HTML Artifact Preview"
                className="html-iframe"
              />
            ) : isError ? (
              <div className="error-display">
                <div className="error-icon">⚠️</div>
                <h4>Artifact Generation Failed</h4>
                <p>{artifact.content}</p>
                <p className="error-hint">This is a historical record of a failed generation attempt. Your previous conversation is still intact.</p>
              </div>
            ) : artifact.content === "GENERATING..." ? (
              <div className="generating-display">
                 <div className="spinner"></div>
                 <p>Drafting artifact, please wait...</p>
              </div>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({node, ...props}: any) => (
                      <div className="table-wrapper">
                        <table {...props} />
                      </div>
                    ),
                    h1: ({node, ...props}: any) => {
                       if (isEssay) return <h1 className="editorial-h1" {...props} />;
                       return <h1 className="artifact-h1" {...props} />;
                    },
                    h2: ({node, children, ...props}: any) => renderHeading('h2', props, children),
                    h3: ({node, children, ...props}: any) => renderHeading('h3', props, children)
                  }}
                >
                  {previewContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      {artifact.citations && artifact.citations.length > 0 && (
        <div className="artifact-citations">
          <div className="ac-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <h4>Grounded in Verified Evidence</h4>
          </div>
          <ul>
            {artifact.citations.map((c, i) => (
              <li key={i}>
                <strong>{c.title}</strong> (Guest: {c.guest})
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
