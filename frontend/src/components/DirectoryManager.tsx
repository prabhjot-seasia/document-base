import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import './DirectoryManager.css';

interface DirectoryTree {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  children: DirectoryTree[];
}

export const DirectoryManager: React.FC = () => {
  const [directories, setDirectories] = useState<DirectoryTree[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDirectories = async () => {
    try {
      const res = await api.get('/api/directories');
      setDirectories(res.data || []);
    } catch {
      setDirectories([]);
    }
  };

  useEffect(() => {
    fetchDirectories();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const body: Record<string, string> = { name: newName.trim() };
      if (parentId) body.parent_id = parentId;
      await api.post('/api/directories', body);
      setNewName('');
      setParentId(null);
      setMessage({ type: 'success', text: `Directory "${newName.trim()}" created.` });
      fetchDirectories();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create directory.' });
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await api.put(`/api/directories/${id}`, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      setMessage({ type: 'success', text: 'Directory renamed.' });
      fetchDirectories();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to rename.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete directory "${name}"?`)) return;
    try {
      await api.delete(`/api/directories/${id}`);
      setMessage({ type: 'success', text: `Directory "${name}" deleted.` });
      fetchDirectories();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete.' });
    }
  };

  const flattenForSelect = (dirs: DirectoryTree[], result: { id: string; path: string }[] = []): { id: string; path: string }[] => {
    for (const dir of dirs) {
      result.push({ id: dir.id, path: dir.path });
      if (dir.children?.length) flattenForSelect(dir.children, result);
    }
    return result;
  };

  const renderTree = (dirs: DirectoryTree[], depth: number = 0) => {
    return dirs.map((dir) => (
      <div key={dir.id} className="dir-node" style={{ marginLeft: depth * 20 }}>
        <div className="dir-row">
          {dir.children.length > 0 ? (
            <button className="expand-btn" onClick={() => toggleExpand(dir.id)}>
              {expanded.has(dir.id) ? '\u25BC' : '\u25B6'}
            </button>
          ) : (
            <span className="expand-placeholder" />
          )}

          {editingId === dir.id ? (
            <div className="edit-inline">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(dir.id)}
                autoFocus
              />
              <button onClick={() => handleRename(dir.id)} className="action-btn save">Save</button>
              <button onClick={() => setEditingId(null)} className="action-btn cancel">Cancel</button>
            </div>
          ) : (
            <>
              <span className="dir-name">{dir.name}</span>
              <span className="dir-path">{dir.path}</span>
              <div className="dir-actions">
                <button
                  className="action-btn edit"
                  onClick={() => { setEditingId(dir.id); setEditName(dir.name); }}
                >
                  Rename
                </button>
                <button
                  className="action-btn delete"
                  onClick={() => handleDelete(dir.id, dir.name)}
                >
                  Delete
                </button>
                <button
                  className="action-btn create-child"
                  onClick={() => setParentId(dir.id)}
                >
                  + Child
                </button>
              </div>
            </>
          )}
        </div>

        {expanded.has(dir.id) && dir.children.length > 0 && renderTree(dir.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="directory-manager">
      <h2>Directories</h2>

      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleCreate} className="create-dir-form">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New directory name"
          required
        />
        <select value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)}>
          <option value="">Root level</option>
          {flattenForSelect(directories).map((d) => (
            <option key={d.id} value={d.id}>{d.path}</option>
          ))}
        </select>
        <button type="submit" className="submit-btn">Create</button>
      </form>

      <div className="dir-tree">
        {directories.length === 0 ? (
          <p className="empty-text">No directories yet. Create one above.</p>
        ) : (
          renderTree(directories)
        )}
      </div>
    </div>
  );
};
