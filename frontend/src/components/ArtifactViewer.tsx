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
  const secureHtmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; script-src 'none';">
        <style>
          body { font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        ${artifact.content}
      </body>
    </html>
  `;

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
                       if(isEssay) return <h1 className="editorial-h1" {...props} />;
                       return <h1 {...props} />;
                    },
                    h2: ({node, ...props}: any) => {
                      let className = '';
                      if (isActionBrief) {
                        const text = String(props.children).toLowerCase();
                        if (text.includes('founder') || text.includes('challenge')) className = 'ab-navy';
                        else if (text.includes('evidence') || text.includes('observation')) className = 'ab-teal';
                        else if (text.includes('recommendation') || text.includes('action')) className = 'ab-coral';
                        else if (text.includes('experiment') || text.includes('metric') || text.includes('plan')) className = 'ab-gold';
                      }
                      if(isEssay) className = 'editorial-h2';
                      return <h2 className={className} {...props} />;
                    }
                  }}
                >
                  {artifact.content}
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
