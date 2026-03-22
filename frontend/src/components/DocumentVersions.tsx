import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { usePermissions } from '../contexts/PermissionContext';
import './DocumentVersions.css';

interface Version {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
  uploaded_by: string;
  created_at: string;
}

interface DocumentDetail {
  id: string;
  name: string;
  directory: { id: string; name: string; path: string };
  current_version: Version | null;
  tags: { id: string; name: string }[];
  total_versions: number;
  created_by: string;
  created_at: string;
}

interface DocumentVersionsProps {
  documentId: string;
  onBack: () => void;
}

export const DocumentVersions: React.FC<DocumentVersionsProps> = ({ documentId, onBack }) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('write', 'documents');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [docRes, versRes] = await Promise.all([
          api.get(`/api/documents/${documentId}`),
          api.get(`/api/documents/${documentId}/versions`),
        ]);
        setDoc(docRes.data);
        setVersions(versRes.data || []);
      } catch {
        setDoc(null);
        setVersions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [documentId]);

  const handleDownload = async (versionId: string) => {
    try {
      const res = await api.get(`/api/documents/${documentId}/versions/${versionId}/download`, { responseType: 'blob' });
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
    if (!window.confirm(`Delete document "${doc?.name}" and all its versions?`)) return;
    try {
      await api.delete(`/api/documents/${documentId}`);
      onBack();
    } catch {
      alert('Failed to delete document');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) return <p>Loading...</p>;
  if (!doc) return <p>Document not found.</p>;

  return (
    <div className="document-versions">
      <button className="back-btn" onClick={onBack}>&larr; Back to Documents</button>

      <div className="doc-detail-header">
        <h2>{doc.name}</h2>
        <div className="doc-detail-actions">
          <button className="view-doc-btn" onClick={() => window.open(`/documents/${documentId}`, '_blank')}>
            View Document
          </button>
          {canWrite && (
            <button className="delete-doc-btn" onClick={handleDelete}>Delete Document</button>
          )}
        </div>
      </div>

      <div className="doc-info">
        <span><strong>Directory:</strong> {doc.directory.path}</span>
        <span><strong>Created by:</strong> {doc.created_by}</span>
        <span><strong>Total versions:</strong> {doc.total_versions}</span>
      </div>

      {doc.tags.length > 0 && (
        <div className="doc-tags">
          {doc.tags.map((t) => (
            <span key={t.id} className="tag-chip">{t.name}</span>
          ))}
        </div>
      )}

      <h3>Version History</h3>
      <div className="versions-table-container">
        <table className="versions-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>File</th>
              <th>Size</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Uploaded By</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className={v.is_archived ? 'archived-row' : ''}>
                <td>{v.version_number}</td>
                <td>{v.file_name}</td>
                <td>{formatSize(v.file_size)}</td>
                <td>{v.start_date || '-'}</td>
                <td>{v.end_date || '-'}</td>
                <td>
                  <span className={`status-badge ${v.is_archived ? 'archived' : 'current'}`}>
                    {v.is_archived ? 'Archived' : 'Current'}
                  </span>
                </td>
                <td>{v.uploaded_by}</td>
                <td>{new Date(v.created_at).toLocaleDateString()}</td>
                <td className="version-actions">
                  <button
                    className="view-btn-sm"
                    onClick={() => {
                      const url = v.is_archived
                        ? `/documents/${documentId}/versions/${v.id}`
                        : `/documents/${documentId}`;
                      window.open(url, '_blank');
                    }}
                  >
                    View
                  </button>
                  <button className="download-btn-sm" onClick={() => handleDownload(v.id)}>Download</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
