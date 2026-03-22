import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { usePermissions } from '../contexts/PermissionContext';
import { DocumentVersions } from './DocumentVersions';
import { PinnedDocuments } from './PinnedDocuments';
import './DocumentSearch.css';

interface DocumentWithDetails {
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
  total_versions?: number;
  created_by: string;
  created_at: string;
  is_pinned?: boolean;
}

interface DirectoryOption {
  id: string;
  name: string;
  path: string;
}

const PinIconSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
  </svg>
);

const PAGE_SIZE = 20;

export const DocumentSearch: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('');
  const [directories, setDirectories] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [pinnedRefresh, setPinnedRefresh] = useState(0);
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('write', 'documents');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchVersionRef = useRef(0);

  const flattenDirs = (dirs: any[], result: DirectoryOption[] = []): DirectoryOption[] => {
    for (const dir of dirs) {
      result.push({ id: dir.id, name: dir.name, path: dir.path });
      if (dir.children?.length) {
        flattenDirs(dir.children, result);
      }
    }
    return result;
  };

  useEffect(() => {
    api.get('/api/directories').then((res) => {
      setDirectories(flattenDirs(res.data));
    }).catch(() => {});
  }, []);

  const isSearching = searchQuery.trim() !== '' || directoryFilter !== '';

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    searchVersionRef.current++;
    setDocuments([]);
    setTotal(0);
    setPage(1);
  }, [searchQuery, directoryFilter]);

  // Fetch documents for the current page
  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (!isSearching) {
      if (!append) {
        setDocuments([]);
        setTotal(0);
      }
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const version = searchVersionRef.current;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, string> = {
        page: pageNum.toString(),
        page_size: PAGE_SIZE.toString(),
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (directoryFilter) params.directory_id = directoryFilter;

      const res = await api.get('/api/documents', { params });

      // Ignore stale responses
      if (version !== searchVersionRef.current) return;

      const newDocs: DocumentWithDetails[] = res.data.documents || [];
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
  }, [isSearching, searchQuery, directoryFilter]);

  // Initial fetch (page 1) with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  // Load more when page increments beyond 1
  useEffect(() => {
    if (page > 1) {
      fetchPage(page, true);
    }
  }, [page, fetchPage]);

  // IntersectionObserver for infinite scroll
  const hasMore = documents.length < total;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && isSearching) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, isSearching]);

  const handleDownload = async (docId: string) => {
    try {
      const res = await api.get(`/api/documents/${docId}/download`, { responseType: 'blob' });
      const contentDisposition = res.headers['content-disposition'];
      let fileName = 'document.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) fileName = decodeURIComponent(match[1]);
      }
      const url = window.URL.createObjectURL(res.data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download document');
    }
  };

  const handleView = (docId: string) => {
    window.open(`/documents/${docId}`, '_blank');
  };

  const handleTogglePin = async (docId: string, isPinned: boolean) => {
    try {
      if (isPinned) {
        await api.delete(`/api/documents/${docId}/pin`);
      } else {
        await api.post(`/api/documents/${docId}/pin`);
      }
      setPinnedRefresh((v) => v + 1);
      // Update pin state in-place
      setDocuments((prev) =>
        prev.map((d) => d.id === docId ? { ...d, is_pinned: !isPinned } : d)
      );
    } catch {
      alert('Failed to update pin status');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (selectedDocId) {
    return (
      <DocumentVersions
        documentId={selectedDocId}
        onBack={() => setSelectedDocId(null)}
      />
    );
  }

  const hasSearchResults = isSearching && !loading && documents.length > 0;

  return (
    <div className="document-search">
      <h2>Documents</h2>

      <div className="search-filters">
        <input
          type="text"
          placeholder="Search by name or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <select
          value={directoryFilter}
          onChange={(e) => setDirectoryFilter(e.target.value)}
          className="search-select"
        >
          <option value="">All Directories</option>
          {directories.map((d) => (
            <option key={d.id} value={d.id}>{d.path}</option>
          ))}
        </select>
      </div>

      {/* Show pinned section only when NOT showing search results */}
      {!hasSearchResults && (
        <PinnedDocuments key={pinnedRefresh} onDocumentClick={(id) => setSelectedDocId(id)} />
      )}

      {!isSearching ? (
        <p className="empty-text">Use the search bar above to find documents.</p>
      ) : loading ? (
        <p className="loading-text">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="empty-text">No documents found.</p>
      ) : (
        <>
          <p className="results-count">{total} document{total !== 1 ? 's' : ''} found</p>
          <div className="document-list">
            {documents.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-card-header">
                  <h3
                    className="document-name"
                    onClick={() => setSelectedDocId(doc.id)}
                    title="View versions"
                  >
                    {doc.name}
                  </h3>
                  <div className="document-actions">
                    {canWrite && (
                      <button
                        className={`pin-btn${doc.is_pinned ? ' pinned' : ''}`}
                        onClick={() => handleTogglePin(doc.id, !!doc.is_pinned)}
                        title={doc.is_pinned ? 'Unpin from home' : 'Pin to home'}
                      >
                        <PinIconSmall />
                      </button>
                    )}
                    <button
                      className="view-btn"
                      onClick={() => handleView(doc.id)}
                      title="View document in new tab"
                    >
                      View
                    </button>
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(doc.id)}
                      title="Download current version"
                    >
                      Download
                    </button>
                  </div>
                </div>
                <div className="document-meta">
                  <span className="meta-item">
                    <strong>Directory:</strong> {doc.directory.path}
                  </span>
                  {doc.current_version && (
                    <>
                      <span className="meta-item">
                        <strong>Version:</strong> {doc.current_version.version_number}
                      </span>
                      <span className="meta-item">
                        <strong>Size:</strong> {formatSize(doc.current_version.file_size)}
                      </span>
                      {doc.current_version.start_date && (
                        <span className="meta-item">
                          <strong>Start:</strong> {doc.current_version.start_date}
                        </span>
                      )}
                    </>
                  )}
                  <span className="meta-item">
                    <strong>By:</strong> {doc.created_by}
                  </span>
                </div>
                {doc.tags.length > 0 && (
                  <div className="document-tags">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="tag-chip"
                        onClick={() => setSearchQuery(tag.name)}
                        title={`Search for ${tag.name}`}
                      >
                        {tag.name}
                      </span>
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
