import React from 'react';
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
  return (
    <div className="source-explorer-overlay">
      <div className="source-explorer-modal">
        <header className="se-header">
          <h2>Source Evidence</h2>
          <button className="se-close-btn" onClick={onClose} title="Close">Ã—</button>
        </header>
        <div className="se-body">
          <div className="se-meta">
            <div className="se-meta-item">
              <strong>Episode:</strong> {citation.title}
            </div>
            <div className="se-meta-item">
              <strong>Guest:</strong> {citation.guest}
            </div>
            <div className="se-meta-item">
              <strong>Source File:</strong> <code>{citation.source_file}</code>
            </div>
          </div>
          <div className="se-content">
            <h3>Transcript Passage</h3>
            <blockquote>
              {citation.content ? citation.content : <em>Loading or missing passage...</em>}
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
};
