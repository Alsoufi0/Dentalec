import React, { useMemo, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, MapPin, Activity, Loader2 } from 'lucide-react';
import { useLocalStore } from './useLocalStore';

// XrayInterpreter
// ---------------
// The student writes their reading of an X-ray, submits, and gets structured AI
// feedback (correct / missed / landmarks / clinical significance + a score).
// The demo cases are SVG, which OpenAI vision cannot read, so we rasterise the
// image to a JPEG data URL in the browser before sending. Scores persist to
// localStorage for a per-session tracker.

async function rasterize(src, maxDim = 1000) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not load the case image.'));
    i.src = src;
  });
  const natW = img.naturalWidth || maxDim;
  const natH = img.naturalHeight || maxDim;
  const scale = Math.min(1, maxDim / Math.max(natW, natH));
  const w = Math.round(natW * scale);
  const h = Math.round(natH * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function Block({ kind, icon: Icon, title, items, text }) {
  if ((!items || !items.length) && !text) return null;
  return (
    <div className={`xi-block ${kind}`}>
      <h4><Icon size={15} /> {title}</h4>
      {text ? <p>{text}</p> : <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>}
    </div>
  );
}

export default function XrayInterpreter({ cases, loading, error, caseId, setCaseId }) {
  const [interpretation, setInterpretation] = useState('');
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [reqError, setReqError] = useState('');
  const [scores, setScores] = useLocalStore('rad.scores', []);

  const current = useMemo(
    () => cases.find((c) => c.id === caseId) || cases[0] || null,
    [cases, caseId]
  );

  const stats = useMemo(() => {
    if (!scores.length) return { attempts: 0, avg: 0, best: 0 };
    const vals = scores.map((s) => s.score);
    return {
      attempts: scores.length,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      best: Math.max(...vals)
    };
  }, [scores]);

  const submit = async () => {
    if (!current || !interpretation.trim()) return;
    setStatus('loading');
    setReqError('');
    setFeedback(null);
    try {
      const image = await rasterize(current.image);
      const res = await fetch('/api/radiology/interpret', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interpretation,
          keyFindings: current.keyFindings || [],
          image,
          caseTitle: current.title,
          caseType: current.type
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setFeedback(data);
      setStatus('done');
      if (typeof data.score === 'number') {
        setScores((prev) => [...prev, { caseId: current.id, score: data.score, at: Date.now() }]);
      }
    } catch (err) {
      setReqError(err.message || 'Something went wrong.');
      setStatus('error');
    }
  };

  const onPickCase = (id) => {
    setCaseId(id);
    setInterpretation('');
    setFeedback(null);
    setStatus('idle');
    setReqError('');
  };

  return (
    <div className="rad-mod">
      <div className="rad-page-head">
        <div>
          <span className="rad-page-eyebrow"><Sparkles size={13} /> Radiology</span>
          <h2>X-ray Interpreter</h2>
          <p>Read the film, write your interpretation, and get instant tutor feedback.</p>
        </div>
        <div className="xi-scorebar">
          <div><strong>{stats.attempts}</strong><span>Attempts</span></div>
          <div><strong>{stats.avg}</strong><span>Avg score</span></div>
          <div><strong>{stats.best}</strong><span>Best</span></div>
        </div>
      </div>

      {loading ? (
        <div className="cl-loading">Loading cases…</div>
      ) : error ? (
        <div className="cl-error">Could not load cases: {error}</div>
      ) : !current ? (
        <div className="cl-empty">No cases available.</div>
      ) : (
        <div className="xi-body">
          <div className="xi-left">
            <div className="xi-casebar">
              <select value={current.id} onChange={(e) => onPickCase(e.target.value)}>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} ({c.type})</option>
                ))}
              </select>
              <span className={`cl-badge ${current.difficulty}`} style={{ position: 'static' }}>{current.difficulty}</span>
            </div>
            <div className="xi-film">
              <img src={current.image} alt={current.title} />
            </div>
          </div>

          <div className="xi-right">
            <p className="xi-prompt">{current.description}</p>
            <textarea
              className="xi-textarea"
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="Describe what you see: image quality, anatomy, then any pathology (caries, periapical lesions, bone levels, impactions) and your impression."
            />
            <button type="button" className="xi-submit" onClick={submit} disabled={status === 'loading' || !interpretation.trim()}>
              {status === 'loading' ? <><Loader2 size={16} className="spin" /> Reading…</> : <><Sparkles size={16} /> Get feedback</>}
            </button>

            {status === 'error' && <p className="xi-err">{reqError}</p>}

            {status === 'done' && feedback && (
              <div className="xi-feedback">
                {typeof feedback.score === 'number' && (
                  <div className="xi-scorecard">
                    <div className="xi-ring" style={{ '--p': feedback.score }}><span>{feedback.score}</span></div>
                    <div>
                      <strong>Your score</strong>
                      <p className="xi-prompt">Based on how completely and accurately you read this film.</p>
                    </div>
                  </div>
                )}
                <Block kind="correct" icon={CheckCircle2} title="What you got right" items={feedback.correct} />
                <Block kind="missed" icon={AlertTriangle} title="What you missed" items={feedback.missed} />
                <Block kind="landmarks" icon={MapPin} title="Landmarks to look for" items={feedback.landmarks} />
                <Block kind="significance" icon={Activity} title="Clinical significance" text={feedback.significance} />
              </div>
            )}

            {status === 'idle' && (
              <div className="xi-empty">
                <p>Write your interpretation above, then submit to compare it against the film.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
