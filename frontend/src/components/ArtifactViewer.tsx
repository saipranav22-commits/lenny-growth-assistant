import { useState } from 'react';
import './ArtifactViewer.css';
import ReactMarkdown from 'react-markdown';

interface Artifact {
  id: string;
  type: string; // 'essay', 'markdown', 'html/css'
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

  if (!artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    alert('Copied to clipboard');
  };

  const isHtml = artifact.type === 'html/css';

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
    <aside className="artifact-viewer">
      <div className="artifact-header">
        <div className="artifact-title">
          <h3>Artifact: {artifact.type.toUpperCase()}</h3>
          <span className="artifact-id">ID: {artifact.id.slice(0, 8)}...</span>
        </div>
        <div className="artifact-actions">
          <button onClick={handleCopy} title="Copy Source">Copy</button>
          <button onClick={onClose} title="Close Artifact">X</button>
        </div>
      </div>

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

      <div className="artifact-content-area">
        {activeTab === 'source' ? (
          <pre className="artifact-source">{artifact.content}</pre>
        ) : (
          <div className="artifact-preview">
            {isHtml ? (
              <iframe 
                srcDoc={secureHtmlContent} 
                sandbox="" 
                title="HTML Artifact Preview"
                className="html-iframe"
              />
            ) : (
              <div className="markdown-body">
                <ReactMarkdown>{artifact.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      {artifact.citations && artifact.citations.length > 0 && (
        <div className="artifact-citations">
          <h4>Grounding Evidence</h4>
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


