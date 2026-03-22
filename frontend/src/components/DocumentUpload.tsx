import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import './DocumentUpload.css';

interface DirectoryOption {
  id: string;
  name: string;
  path: string;
}

interface DocumentUploadProps {
  onUploaded?: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploaded }) => {
  const [name, setName] = useState('');
  const [directoryId, setDirectoryId] = useState('');
  const [directories, setDirectories] = useState<DirectoryOption[]>([]);
  const [tags, setTags] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [versionInfo, setVersionInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flattenDirs = (dirs: any[], result: DirectoryOption[] = []): DirectoryOption[] => {
    for (const dir of dirs) {
      result.push({ id: dir.id, name: dir.name, path: dir.path });
      if (dir.children?.length) flattenDirs(dir.children, result);
    }
    return result;
  };

  useEffect(() => {
    api.get('/api/directories').then((res) => {
      setDirectories(flattenDirs(res.data));
    }).catch(() => {});
  }, []);

  // Check for existing document (version detection)
  useEffect(() => {
    if (!name.trim() || !directoryId) {
      setVersionInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/documents', {
          params: { q: name.trim(), directory_id: directoryId },
        });
        const exact = res.data.documents?.find(
          (d: any) => d.name.toLowerCase() === name.trim().toLowerCase() && d.directory.id === directoryId
        );
        if (exact) {
          const ver = exact.current_version?.version_number || 0;
          setVersionInfo(`Document "${name}" exists in this directory. Uploading will create version ${ver + 1}.`);
        } else {
          setVersionInfo(null);
        }
      } catch {
        setVersionInfo(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [name, directoryId]);

  // Tag autocomplete
  useEffect(() => {
    const parts = tags.split(',');
    const current = parts[parts.length - 1]?.trim();
    if (!current || current.length < 1) {
      setTagSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/tags/search', { params: { q: current } });
        setTagSuggestions(res.data || []);
      } catch {
        setTagSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [tags]);

  const addTag = (tagName: string) => {
    const parts = tags.split(',').map((t) => t.trim()).filter(Boolean);
    parts.pop();
    parts.push(tagName);
    setTags(parts.join(', ') + ', ');
    setTagSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !directoryId || !file) {
      setMessage({ type: 'error', text: 'Name, directory, and file are required.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('directory_id', directoryId);
      formData.append('tags', tags.split(',').map((t) => t.trim()).filter(Boolean).join(','));
      if (startDate) formData.append('start_date', startDate);
      if (endDate) formData.append('end_date', endDate);
      formData.append('file', file);

      const res = await api.post('/api/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage({ type: 'success', text: `Document "${res.data.name}" uploaded successfully (version ${res.data.version}).` });
      setName('');
      setTags('');
      setStartDate('');
      setEndDate('');
      setFile(null);
      setVersionInfo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploaded?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="document-upload">
      <h2>Upload Document</h2>
      <p className="upload-subtitle">Upload a PDF document to the system</p>

      {message && (
        <div className={`upload-message ${message.type}`}>
          {message.type === 'success' ? '\u2713' : '\u2717'} {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="doc-name">Document Name</label>
          <input
            id="doc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter document name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="doc-directory">Directory</label>
          <select
            id="doc-directory"
            value={directoryId}
            onChange={(e) => setDirectoryId(e.target.value)}
            required
          >
            <option value="">Select directory...</option>
            {directories.map((d) => (
              <option key={d.id} value={d.id}>{d.path}</option>
            ))}
          </select>
        </div>

        {versionInfo && <div className="version-notice">{versionInfo}</div>}

        <div className="form-group">
          <label htmlFor="doc-tags">Tags (comma-separated)</label>
          <div className="tag-input-container">
            <input
              id="doc-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., policy, hr, 2024"
            />
            {tagSuggestions.length > 0 && (
              <div className="tag-suggestions">
                {tagSuggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="tag-suggestion"
                    onClick={() => addTag(t.name)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="doc-start">Start Date</label>
            <input
              id="doc-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="doc-end">End Date</label>
            <input
              id="doc-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>PDF File</label>
          <div
            className={`file-drop-zone${file ? ' has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="file-drop-icon">{file ? '\uD83D\uDCC4' : '\uD83D\uDCE4'}</div>
            <div className="file-drop-text">
              {file ? (
                <>{file.name} <strong>({(file.size / 1024 / 1024).toFixed(1)} MB)</strong></>
              ) : (
                <>Click to select a <strong>PDF file</strong></>
              )}
            </div>
            {!file && <div className="file-drop-hint">Maximum file size: 50 MB</div>}
          </div>
          <input
            ref={fileInputRef}
            className="file-hidden-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={uploading}>
          {uploading ? 'Uploading...' : '\u2B06 Upload Document'}
        </button>
      </form>
    </div>
  );
};
