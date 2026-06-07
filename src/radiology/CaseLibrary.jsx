import React, { useMemo, useRef, useState } from 'react';
import { Search, Star, Layers, Upload, Trash2, X, Loader2 } from 'lucide-react';

// CaseLibrary
// -----------
// Filterable grid of X-ray cases (teaching cases + the user's own uploads).
// Filters: type, difficulty, pathology, free-text search, bookmarks-only.
// Clicking a card opens it in the RadiologyViewer; the star toggles a favourite;
// uploaded cases can be deleted. The Upload button adds the user's own X-rays.

const TYPES = ['all', 'panoramic', 'periapical', 'bitewing', 'other'];
const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'];
const UPLOAD_TYPES = ['panoramic', 'periapical', 'bitewing', 'other'];

function UploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('panoramic');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const submit = async () => {
    if (!file) { setErr('Choose an image file first.'); return; }
    setBusy(true);
    setErr('');
    try {
      await onUpload({ title: title.trim(), type, file });
      onClose();
    } catch (e) {
      setErr(e.message || 'Upload failed.');
      setBusy(false);
    }
  };

  return (
    <div className="rad-modal-backdrop" onClick={onClose}>
      <div className="rad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rad-modal-head">
          <strong>Upload an X-ray</strong>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="rad-modal-note">Add your own panoramic, periapical, bitewing, or other X-ray. It stays on this device and can be studied, measured, and sent to the Interpreter.</p>

        <button type="button" className={`rad-drop${file ? ' has' : ''}`} onClick={() => inputRef.current?.click()}>
          {file ? <span>{file.name}</span> : <><Upload size={20} /><span>Click to choose an image (JPG, PNG)</span></>}
        </button>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setErr(''); }} />

        <label className="rad-field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {UPLOAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="rad-field">
          <span>Title (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. My panoramic, March" />
        </label>

        {err && <p className="xi-err">{err}</p>}
        <div className="rad-modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="xi-submit" onClick={submit} disabled={busy || !file}>
            {busy ? <><Loader2 size={16} className="spin" /> Adding…</> : <><Upload size={16} /> Add X-ray</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseLibrary({ cases, loading, error, bookmarks, onOpen, onUpload, onDelete }) {
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [pathology, setPathology] = useState('all');
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const pathologies = useMemo(() => {
    const set = new Set();
    cases.forEach((c) => (c.pathologies || []).forEach((p) => set.add(p)));
    return ['all', ...Array.from(set).sort()];
  }, [cases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (type !== 'all' && c.type !== type) return false;
      if (level !== 'all' && c.difficulty !== level) return false;
      if (pathology !== 'all' && !(c.pathologies || []).includes(pathology)) return false;
      if (favOnly && !bookmarks.has(c.id)) return false;
      if (q && !(`${c.title} ${c.id} ${(c.pathologies || []).join(' ')}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [cases, type, level, pathology, favOnly, query, bookmarks]);

  return (
    <div className="rad-mod">
      <div className="rad-page-head">
        <div>
          <span className="rad-page-eyebrow"><Layers size={13} /> Radiology</span>
          <h2>Case Library</h2>
          <p>Browse teaching X-rays or upload your own, then open a case to read and measure it.</p>
        </div>
        <button type="button" className="xi-submit" onClick={() => setUploadOpen(true)}>
          <Upload size={16} /> Upload X-ray
        </button>
      </div>

      <div className="cl-toolbar">
        <div className="cl-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cases or pathology…" />
        </div>
        <div className="cl-filter" role="group" aria-label="Type">
          {TYPES.map((t) => (
            <button key={t} type="button" className={type === t ? 'active' : ''} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
        <div className="cl-filter" role="group" aria-label="Difficulty">
          {LEVELS.map((l) => (
            <button key={l} type="button" className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>{l}</button>
          ))}
        </div>
        <div className="cl-filter" role="group" aria-label="Pathology">
          {pathologies.map((p) => (
            <button key={p} type="button" className={pathology === p ? 'active' : ''} onClick={() => setPathology(p)}>{p}</button>
          ))}
        </div>
        <div className="cl-filter">
          <button type="button" className={favOnly ? 'active' : ''} onClick={() => setFavOnly((v) => !v)}>★ Saved</button>
        </div>
      </div>

      {loading ? (
        <div className="cl-loading">Loading cases…</div>
      ) : error ? (
        <div className="cl-error">Could not load cases: {error}</div>
      ) : !filtered.length ? (
        <div className="cl-empty">No cases match these filters. Try Upload X-ray to add your own.</div>
      ) : (
        <div className="cl-grid">
          {filtered.map((c) => (
            <article key={c.id} className="cl-card" onClick={() => onOpen(c.id)}>
              <div className="cl-thumb">
                <img src={c.image} alt={c.title} loading="lazy" />
                <span className={`cl-badge ${c.difficulty}`}>{c.difficulty}</span>
                {c.user && <span className="cl-badge user cl-badge-2">Yours</span>}
                <button
                  type="button"
                  className={`cl-fav${bookmarks.has(c.id) ? ' on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); bookmarks.toggle(c.id); }}
                  aria-label={bookmarks.has(c.id) ? 'Remove bookmark' : 'Bookmark case'}
                >
                  <Star size={15} fill={bookmarks.has(c.id) ? 'currentColor' : 'none'} />
                </button>
                {c.user && onDelete && (
                  <button
                    type="button"
                    className="cl-del"
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete this uploaded X-ray?')) onDelete(c.id); }}
                    aria-label="Delete uploaded case"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="cl-card-body">
                <strong>{c.title}</strong>
                <div className="cl-card-meta">
                  <span style={{ textTransform: 'capitalize' }}>{c.type}</span>
                  <i className="dot" />
                  <span>{c.user ? 'uploaded' : c.id}</span>
                </div>
                <div className="cl-path">
                  {(c.pathologies || []).map((p) => <i key={p}>{p}</i>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUpload={onUpload} />}
    </div>
  );
}
