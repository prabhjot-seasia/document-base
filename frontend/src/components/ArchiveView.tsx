import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import './ArchiveView.css';

interface ArchivedDoc {
  id: string;
  name: string;
  directory: { id: string; name: string; path: string };
  current_version: {
    id: string;
    version_number: number;
    file_name: string;
    file_size: number;
    start_date: string | null;
    end_date: string | null;
    is_archived: boolean;
    uploaded_by: string;
    created_at: string;
  } | null;
  tags: { id: string; name: string }[];
  created_by: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export const ArchiveView: React.FC = () => {
  const [documents, setDocuments] = useState<ArchivedDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchVersionRef = useRef(0);

  // Reset on search change
  useEffect(() => {
    searchVersionRef.current++;
    setDocuments([]);
    setTotal(0);
    setPage(1);
  }, [searchQuery]);

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    const version = searchVersionRef.current;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, string> = {
        archived: 'true',
        page: pageNum.toString(),
        page_size: PAGE_SIZE.toString(),
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.get('/api/documents', { params });

      if (version !== searchVersionRef.current) return;

      const newDocs: ArchivedDoc[] = res.data.documents || [];
      setTotal(res.data.total || 0);

      if (append) {
        setDocuments((prev) => [...prev, ...newDocs]);
      } else {
        setDocuments(newDocs);
      }
    } catch {
      if (version !== searchVersionRef.current) return;
      if (!append) {
        setDocuments([]);
        setTotal(0);
      }
    } finally {
      if (version === searchVersionRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [searchQuery]);

  // Initial fetch with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  // Load more pages
  useEffect(() => {
    if (page > 1) {
      fetchPage(page, true);
    }
  }, [page, fetchPage]);

  // IntersectionObserver
  const hasMore = documents.length < total;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="archive-view">
      <h2>Archived Documents</h2>

      <div className="archive-search">
        <input
          type="text"
          placeholder="Search archived documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="empty-text">No archived documents found.</p>
      ) : (
        <>
          <p className="results-count">{total} archived document{total !== 1 ? 's' : ''} found</p>
          <div className="archive-list">
            {documents.map((doc, idx) => (
              <div key={doc.current_version?.id || `${doc.id}-${idx}`} className="archive-card">
                <div className="archive-card-header">
                  <h3>{doc.name}</h3>
                  <span className="archive-badge">Archived</span>
                </div>
                <div className="archive-meta">
                  <span><strong>Directory:</strong> {doc.directory.path}</span>
                  {doc.current_version && (
                    <>
                      <span><strong>Version:</strong> {doc.current_version.version_number}</span>
                      <span><strong>Size:</strong> {formatSize(doc.current_version.file_size)}</span>
                      {doc.current_version.start_date && (
                        <span><strong>Period:</strong> {doc.current_version.start_date} - {doc.current_version.end_date || 'N/A'}</span>
                      )}
                    </>
                  )}
                  <span><strong>By:</strong> {doc.created_by}</span>
                </div>
                {doc.tags.length > 0 && (
                  <div className="archive-tags">
                    {doc.tags.map((t) => (
                      <span key={t.id} className="tag-chip">{t.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="scroll-sentinel">
            {loadingMore && <p className="loading-more-text">Loading more...</p>}
            {!hasMore && documents.length > 0 && (
              <p className="end-of-list-text">All {total} documents loaded</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
