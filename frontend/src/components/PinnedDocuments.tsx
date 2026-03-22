import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import { usePermissions } from '../contexts/PermissionContext';
import './PinnedDocuments.css';

interface PinnedDoc {
  id: string;
  name: string;
  directory: { id: string; name: string; path: string };
  current_version: {
    id: string;
    version_number: number;
    file_name: string;
    file_size: number;
    start_date: string | null;
  } | null;
  tags: { id: string; name: string }[];
  created_by: string;
}

interface PinnedDocumentsProps {
  onDocumentClick?: (docId: string) => void;
}

const PinIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
  </svg>
);

const UnpinIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
    <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5"/>
  </svg>
);

const DragIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
    <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
  </svg>
);

const VISIBLE_ROWS = 2;
const CARDS_PER_ROW_ESTIMATE = 3; // rough estimate for "show more" threshold

export const PinnedDocuments: React.FC<PinnedDocumentsProps> = ({ onDocumentClick }) => {
  const [pinnedDocs, setPinnedDocs] = useState<PinnedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('write', 'documents');
  const dragItem = useRef<number | null>(null);

  const fetchPinned = useCallback(async () => {
    try {
      const res = await api.get('/api/documents/pinned');
      setPinnedDocs(res.data || []);
    } catch {
      setPinnedDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  const handleUnpin = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/documents/${docId}/pin`);
      setPinnedDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      alert('Failed to unpin document');
    }
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverIndex === null || dragItem.current === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      dragItem.current = null;
      return;
    }

    const updated = [...pinnedDocs];
    const [moved] = updated.splice(dragItem.current, 1);
    updated.splice(dragOverIndex, 0, moved);
    setPinnedDocs(updated);

    setDragIndex(null);
    setDragOverIndex(null);
    dragItem.current = null;

    try {
      await api.put('/api/documents/pinned/reorder', {
        document_ids: updated.map((d) => d.id),
      });
    } catch {
      fetchPinned();
    }
  };

  if (loading) return null;

  const maxVisible = VISIBLE_ROWS * CARDS_PER_ROW_ESTIMATE;
  const hasOverflow = pinnedDocs.length > maxVisible;
  const visibleDocs = expanded ? pinnedDocs : pinnedDocs.slice(0, maxVisible);
  const hiddenCount = pinnedDocs.length - maxVisible;

  return (
    <div className="pinned-documents">
      <div className="pinned-header">
        <PinIcon size={16} className="pinned-header-icon" />
        <h3>Pinned Documents</h3>
        <span className="pinned-count">{pinnedDocs.length}</span>
        {hasOverflow && (
          <button className="pinned-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `+${hiddenCount} more`}
          </button>
        )}
      </div>
      {pinnedDocs.length === 0 ? (
        <div className="pinned-empty">
          <PinIcon size={24} className="pinned-empty-icon" />
          <p>No pinned documents yet</p>
          <span>Search and pin documents for quick access</span>
        </div>
      ) : (
        <div className={`pinned-grid${expanded ? ' expanded' : ''}`}>
          {visibleDocs.map((doc, index) => (
            <div
              key={doc.id}
              className={`pinned-card${dragIndex === index ? ' dragging' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
              draggable={canWrite}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDragLeave={() => setDragOverIndex(null)}
            >
              {canWrite && (
                <div className="drag-handle" title="Drag to reorder">
                  <DragIcon />
                </div>
              )}
              <div
                className="pinned-card-body"
                onClick={() => onDocumentClick ? onDocumentClick(doc.id) : undefined}
              >
                <div className="pinned-card-name" title={doc.name}>{doc.name}</div>
                <div className="pinned-card-meta">
                  <span className="pinned-card-dir">{doc.directory.path}</span>
                  {doc.current_version && (
                    <span className="pinned-card-ver">v{doc.current_version.version_number}</span>
                  )}
                </div>
              </div>
              {canWrite && (
                <button
                  className="pinned-unpin-btn"
                  onClick={(e) => handleUnpin(doc.id, e)}
                  title="Unpin"
                >
                  <UnpinIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
