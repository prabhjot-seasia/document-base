import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { usePermissions } from '../contexts/PermissionContext';
import './DocumentViewer.css';

interface DocumentDetail {
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
  total_versions: number;
  created_by: string;
  created_at: string;
}

export const DocumentViewer: React.FC = () => {
  const { id, vid } = useParams<{ id: string; vid?: string }>();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('write', 'documents');

  useEffect(() => {
    if (!id) return;

    const fetchDocument = async () => {
      setLoading(true);
      setError(null);
      try {
        const docRes = await api.get(`/api/documents/${id}`);
        setDoc(docRes.data);

        // Fetch PDF blob — specific version or current
        let pdfRes;
        if (vid) {
          pdfRes = await api.get(`/api/documents/${id}/versions/${vid}/view`, { responseType: 'blob' });
          // Find the version number for display
          const versionsRes = await api.get(`/api/documents/${id}/versions`);
          const matchedVersion = (versionsRes.data || []).find((v: any) => v.id === vid);
          setViewingVersion(matchedVersion?.version_number || null);
        } else {
          pdfRes = await api.get(`/api/documents/${id}/view`, { responseType: 'blob' });
          setViewingVersion(null);
        }
        const url = window.URL.createObjectURL(pdfRes.data);
        setPdfUrl(url);
      } catch (err: any) {
        setError(err.response?.status === 404 ? 'Document not found.' : 'Failed to load document.');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();

    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [id, vid]);

  const handleDownload = async () => {
    if (!id) return;
    try {
      const downloadUrl = vid
        ? `/api/documents/${id}/versions/${vid}/download`
        : `/api/documents/${id}/download`;
      const res = await api.get(downloadUrl, { responseType: 'blob' });
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
      alert('Failed to download');
    }
  };

  const handleDelete = async () => {
    if (!id || !doc) return;
    if (!window.confirm(`Delete document "${doc.name}" and all its versions?`)) return;
    try {
      await api.delete(`/api/documents/${id}`);
      window.close();
    } catch {
      alert('Failed to delete document');
    }
  };

  if (loading) {
    return (
      <div className="viewer-container">
        <div className="viewer-loading">Loading document...</div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="viewer-container">
        <div className="viewer-error">
          <h2>{error || 'Document not found'}</h2>
          <Link to="/" className="viewer-home-link">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-container">
      <div className="viewer-header">
        <div className="viewer-header-left">
          <Link to="/" className="viewer-back-link" title="Back to Dashboard">&larr;</Link>
          <div className="viewer-doc-info">
            <h1 className="viewer-title">{doc.name}</h1>
            <div className="viewer-meta">
              <span>{doc.directory.path}</span>
              {viewingVersion ? (
                <span className="viewer-version-badge archived">v{viewingVersion} (archived)</span>
              ) : doc.current_version ? (
                <>
                  <span>v{doc.current_version.version_number}</span>
                  <span>{doc.current_version.uploaded_by}</span>
                </>
              ) : null}
              {doc.tags.length > 0 && (
                <span className="viewer-tags">
                  {doc.tags.map(t => t.name).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="viewer-actions">
          <button className="viewer-download-btn" onClick={handleDownload}>Download</button>
          {canWrite && (
            <button className="viewer-delete-btn" onClick={handleDelete}>Delete</button>
          )}
        </div>
      </div>

      <div className="viewer-content">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="pdf-iframe"
            title={doc.name}
          />
        ) : (
          <div className="viewer-no-pdf">Unable to display PDF</div>
        )}
      </div>
    </div>
  );
};
