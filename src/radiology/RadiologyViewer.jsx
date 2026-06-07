import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ZoomIn, ZoomOut, Maximize, Move, Ruler, Triangle, Square,
  Eye, EyeOff, Contrast, Sun, Trash2, MapPin, ArrowLeft, FlipVertical2, Crosshair
} from 'lucide-react';

// RadiologyViewer
// ---------------
// Display + interaction shell for a single X-ray case.
//   - modality "image" (JPEG/PNG/SVG)  -> lightweight canvas/CSS viewer (this file)
//   - modality "dicom" (.dcm)          -> Cornerstone3D viewer (lazy-loaded)
// Viewer tools: zoom, pan, brightness/contrast (windowing), invert, reset, and
// length/angle/area measurement. Educational layer: clickable annotations gated
// by a Beginner/Intermediate/Advanced difficulty selector.
//
// Windowing note: for plain images we approximate windowing with CSS filters
// (brightness/contrast/invert), which is the right tool for 8-bit JPEG/PNG. True
// 16-bit DICOM windowing (VOI LUT) is handled natively by the Cornerstone path.

const DicomViewer = React.lazy(() => import('./DicomViewer.jsx'));

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const RANK = { beginner: 0, intermediate: 1, advanced: 2 };
const TONE = { opaque: '#7fd4cf', lucent: '#ffd166', finding: '#ff6b81' };
const TONE_LABEL = { opaque: 'Radiopaque', lucent: 'Radiolucent', finding: 'Finding' };

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// geometry helpers operate in natural pixels (fraction * natural dimension)
const toPx = (p, nat) => ({ x: p.x * nat.w, y: p.y * nat.h });
const dist = (a, b, nat) => {
  const pa = toPx(a, nat);
  const pb = toPx(b, nat);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
};
const angleAt = (a, b, c, nat) => {
  const pa = toPx(a, nat);
  const pb = toPx(b, nat);
  const pc = toPx(c, nat);
  const v1 = { x: pa.x - pb.x, y: pa.y - pb.y };
  const v2 = { x: pc.x - pb.x, y: pc.y - pb.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (!m1 || !m2) return 0;
  return (Math.acos(clamp(dot / (m1 * m2), -1, 1)) * 180) / Math.PI;
};

function Toolbar({
  tool, setTool, invert, setInvert, showAnn, setShowAnn,
  bright, setBright, contrast, setContrast, onZoom, onReset, onClear, hasMeasures
}) {
  const ToolBtn = ({ id, icon: Icon, label }) => (
    <button
      type="button"
      className={`rv-tool${tool === id ? ' active' : ''}`}
      onClick={() => setTool(id)}
      title={label}
      aria-pressed={tool === id}
    >
      <Icon size={17} />
    </button>
  );
  return (
    <div className="rv-toolbar">
      <div className="rv-tool-group">
        <button type="button" className="rv-tool" onClick={() => onZoom(0.4)} title="Zoom in"><ZoomIn size={17} /></button>
        <button type="button" className="rv-tool" onClick={() => onZoom(-0.4)} title="Zoom out"><ZoomOut size={17} /></button>
        <ToolBtn id="pan" icon={Move} label="Pan" />
        <button type="button" className="rv-tool" onClick={onReset} title="Reset view"><Maximize size={17} /></button>
      </div>
      <div className="rv-tool-group">
        <ToolBtn id="length" icon={Ruler} label="Length" />
        <ToolBtn id="angle" icon={Triangle} label="Angle" />
        <ToolBtn id="area" icon={Square} label="Area" />
        <ToolBtn id="calibrate" icon={Crosshair} label="Calibrate (draw a known length to measure in mm)" />
        <button type="button" className="rv-tool" onClick={onClear} disabled={!hasMeasures} title="Clear measurements"><Trash2 size={17} /></button>
      </div>
      <div className="rv-tool-group">
        <button type="button" className={`rv-tool${invert ? ' active' : ''}`} onClick={() => setInvert((v) => !v)} title="Invert greyscale"><FlipVertical2 size={17} /></button>
        <button type="button" className={`rv-tool${showAnn ? ' active' : ''}`} onClick={() => setShowAnn((v) => !v)} title="Show / hide annotations">{showAnn ? <Eye size={17} /> : <EyeOff size={17} />}</button>
      </div>
      <div className="rv-sliders">
        <label title="Brightness"><Sun size={14} /><input type="range" min="40" max="160" value={bright} onChange={(e) => setBright(+e.target.value)} /></label>
        <label title="Contrast"><Contrast size={14} /><input type="range" min="40" max="220" value={contrast} onChange={(e) => setContrast(+e.target.value)} /></label>
      </div>
    </div>
  );
}

function MeasureLayer({ measurements, pending, nat, calibration, calibDraft }) {
  // calibration = mm per natural pixel; when set, lengths/areas read in mm.
  const fmtLen = (px) => (calibration ? `${(px * calibration).toFixed(1)} mm` : `${Math.round(px)} px`);
  const label = (m) => {
    if (m.type === 'length') return fmtLen(dist(m.points[0], m.points[1], nat));
    if (m.type === 'angle') return `${Math.round(angleAt(m.points[0], m.points[1], m.points[2], nat))}°`;
    if (m.type === 'area') {
      const w = Math.abs(m.points[1].x - m.points[0].x) * nat.w;
      const h = Math.abs(m.points[1].y - m.points[0].y) * nat.h;
      const px = w * h;
      return calibration
        ? `${Math.round(px * calibration * calibration).toLocaleString()} mm²`
        : `${Math.round(px).toLocaleString()} px²`;
    }
    return '';
  };
  const pc = (v) => v * 100;
  const all = [
    ...measurements,
    ...(pending.points?.length ? [{ ...pending, draft: true }] : []),
    ...(calibDraft ? [{ type: 'length', points: calibDraft.points, calib: true }] : [])
  ];
  return (
    <svg className="rv-measure" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {all.map((m, i) => {
        const pts = m.points;
        const stroke = m.calib ? '#ffd166' : m.draft ? '#9fb4ff' : '#5cf2d6';
        if (m.type === 'area' && pts.length === 2) {
          const x = pc(Math.min(pts[0].x, pts[1].x));
          const y = pc(Math.min(pts[0].y, pts[1].y));
          const w = pc(Math.abs(pts[1].x - pts[0].x));
          const h = pc(Math.abs(pts[1].y - pts[0].y));
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="rgba(92,242,214,0.1)" stroke={stroke} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
              {!m.draft && <text x={x + 1} y={y + 4} className="rv-mlabel">{label(m)}</text>}
            </g>
          );
        }
        return (
          <g key={i}>
            <polyline
              points={pts.map((p) => `${pc(p.x)},${pc(p.y)}`).join(' ')}
              fill="none"
              stroke={stroke}
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            {pts.map((p, j) => (
              <circle key={j} cx={pc(p.x)} cy={pc(p.y)} r="0.7" fill={stroke} vectorEffect="non-scaling-stroke" />
            ))}
            {!m.draft && pts.length > 1 && (
              <text x={pc(pts[pts.length - 1].x) + 1} y={pc(pts[pts.length - 1].y) - 1} className="rv-mlabel">{label(m)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function RadiologyViewer({ case: c, onBack, onDelete }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [tool, setTool] = useState('pan');
  const [measurements, setMeasurements] = useState([]);
  const [pending, setPending] = useState({ type: null, points: [] });
  // Calibration: mm per natural pixel, persisted per case so mm measurements stick.
  const calibKey = `rad.calib.${c?.id}`;
  const [calibration, setCalibration] = useState(() => {
    try { const v = localStorage.getItem(`rad.calib.${c?.id}`); return v ? JSON.parse(v).mmPerPx : null; } catch { return null; }
  });
  const [calibDraft, setCalibDraft] = useState(null);
  const [calibInput, setCalibInput] = useState('');
  const [showAnn, setShowAnn] = useState(true);
  // Open each case at its own difficulty so its annotations are visible up front;
  // the student can then dial the level down to test themselves.
  const [difficulty, setDifficulty] = useState(c?.difficulty || 'beginner');
  const [activeAnn, setActiveAnn] = useState(null);
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [imgState, setImgState] = useState('loading');
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const isDicom = c?.modality === 'dicom';

  const visibleAnn = useMemo(
    () => (c?.annotations || []).filter((a) => RANK[a.level] <= RANK[difficulty]),
    [c, difficulty]
  );

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);
  const zoom = useCallback((delta) => setScale((s) => clamp(s + delta, MIN_SCALE, MAX_SCALE)), []);
  const clearMeasures = useCallback(() => { setMeasurements([]); setPending({ type: null, points: [] }); }, []);

  const onWheel = useCallback((e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.3 : -0.3); }, [zoom]);

  const toFraction = useCallback((e) => {
    const r = imgRef.current.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  }, []);

  const onPointerDown = useCallback((e) => {
    if (tool === 'pan') {
      if (scale <= 1) return;
      dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    // calibration: collect two points, then ask for the real-world length
    if (tool === 'calibrate') {
      const cp = toFraction(e);
      setPending((prev) => {
        const points = prev.type === 'calibrate' ? [...prev.points, cp] : [cp];
        if (points.length >= 2) { setCalibDraft({ points }); return { type: null, points: [] }; }
        return { type: 'calibrate', points };
      });
      return;
    }
    // measurement tools collect points in image fractions
    const p = toFraction(e);
    const need = tool === 'angle' ? 3 : 2;
    setPending((prev) => {
      const points = prev.type === tool ? [...prev.points, p] : [p];
      if (points.length >= need) {
        setMeasurements((m) => [...m, { type: tool, points }]);
        return { type: null, points: [] };
      }
      return { type: tool, points };
    });
  }, [tool, scale, pos, toFraction]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    setPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  }, []);
  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const applyCalibration = useCallback(() => {
    const mm = parseFloat(calibInput);
    if (!mm || mm <= 0 || !calibDraft) return;
    const px = dist(calibDraft.points[0], calibDraft.points[1], nat);
    if (!px) return;
    const mmPerPx = mm / px;
    setCalibration(mmPerPx);
    try { localStorage.setItem(calibKey, JSON.stringify({ mmPerPx })); } catch { /* noop */ }
    setCalibDraft(null);
    setCalibInput('');
    setTool('length');
  }, [calibInput, calibDraft, nat, calibKey]);

  const clearCalibration = useCallback(() => {
    setCalibration(null);
    try { localStorage.removeItem(calibKey); } catch { /* noop */ }
  }, [calibKey]);

  const filter = `brightness(${bright}%) contrast(${contrast}%) ${invert ? 'invert(1)' : ''}`;
  const activeFinding = visibleAnn.find((a) => a.id === activeAnn) || null;

  if (!c) {
    return <div className="rv-empty"><p>Select a case to open it in the viewer.</p></div>;
  }

  return (
    <div className="rv-root">
      <div className="rv-head">
        {onBack && <button type="button" className="rv-back" onClick={onBack}><ArrowLeft size={16} /> Cases</button>}
        <div className="rv-title">
          <strong>{c.title}</strong>
          <span>{c.type} · {c.id}</span>
        </div>
        <div className="rv-levels" role="group" aria-label="Difficulty">
          {LEVELS.map((lvl) => (
            <button key={lvl} type="button" className={difficulty === lvl ? 'active' : ''} onClick={() => { setDifficulty(lvl); setActiveAnn(null); }}>
              {lvl[0].toUpperCase() + lvl.slice(1)}
            </button>
          ))}
        </div>
        {c.user && onDelete && (
          <button
            type="button"
            className="rv-delete"
            onClick={() => { if (confirm('Delete this uploaded X-ray? This cannot be undone.')) onDelete(c.id); }}
            title="Delete this uploaded X-ray"
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>

      <Toolbar
        tool={tool} setTool={setTool} invert={invert} setInvert={setInvert}
        showAnn={showAnn} setShowAnn={setShowAnn} bright={bright} setBright={setBright}
        contrast={contrast} setContrast={setContrast} onZoom={zoom} onReset={reset}
        onClear={clearMeasures} hasMeasures={measurements.length > 0}
      />

      <div className="rv-body">
        <div
          className={`rv-stage${tool === 'pan' && scale > 1 ? ' grabbable' : ''}${tool !== 'pan' ? ' measuring' : ''}`}
          onWheel={isDicom ? undefined : onWheel}
          onPointerDown={isDicom ? undefined : onPointerDown}
          onPointerMove={isDicom ? undefined : onPointerMove}
          onPointerUp={isDicom ? undefined : onPointerUp}
          onPointerLeave={isDicom ? undefined : onPointerUp}
        >
          {isDicom ? (
            <React.Suspense fallback={<div className="rv-loading"><span>Loading DICOM engine…</span></div>}>
              <DicomViewer src={c.image} invert={invert} bright={bright} contrast={contrast} tool={tool} resetKey={`${scale}`} />
            </React.Suspense>
          ) : (
            <div className="rv-content" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}>
              {imgState === 'error' && <div className="rv-loading error"><span>Could not load this image.</span></div>}
              <img
                ref={imgRef}
                className="rv-image"
                src={c.image}
                alt={c.title}
                draggable={false}
                style={{ filter, visibility: imgState === 'ready' ? 'visible' : 'hidden' }}
                onLoad={(e) => { setNat({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 }); setImgState('ready'); }}
                onError={() => setImgState('error')}
              />
              <MeasureLayer measurements={measurements} pending={pending} nat={nat} calibration={calibration} calibDraft={calibDraft} />
              {showAnn && (
                <div className="rv-pins">
                  {visibleAnn.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`rv-pin tone-${a.tone}${activeAnn === a.id ? ' active' : ''}`}
                      style={{ left: `${a.x}%`, top: `${a.y}%`, color: TONE[a.tone] }}
                      onClick={(e) => { e.stopPropagation(); setActiveAnn(a.id); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title={a.structure}
                    >
                      <span className="rv-pin-dot" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {imgState === 'loading' && !isDicom && <div className="rv-loading"><span>Loading image…</span></div>}
          {calibDraft && (
            <div className="rv-calib-panel">
              <span>Real length of this line</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={calibInput}
                autoFocus
                onChange={(e) => setCalibInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCalibration(); }}
              />
              <span>mm</span>
              <button type="button" className="rv-calib-apply" onClick={applyCalibration} disabled={!parseFloat(calibInput)}>Apply</button>
              <button type="button" className="rv-calib-cancel" onClick={() => { setCalibDraft(null); setCalibInput(''); }}>Cancel</button>
            </div>
          )}
          <span className="rv-zoom">{Math.round(scale * 100)}%</span>
        </div>

        <aside className="rv-side">
          <div className={`rv-calib-status${calibration ? ' on' : ''}`}>
            {calibration ? (
              <>
                <span><Crosshair size={13} /> Calibrated · measuring in mm</span>
                <button type="button" onClick={clearCalibration}>Reset scale</button>
              </>
            ) : (
              <span><Crosshair size={13} /> Tip: use Calibrate to draw a known length and measure in mm.</span>
            )}
          </div>
          {activeFinding ? (
            <div className="rv-readout">
              <span className={`rv-tag tone-${activeFinding.tone}`}>{TONE_LABEL[activeFinding.tone]}</span>
              <strong>{activeFinding.structure}</strong>
              <p>{activeFinding.note}</p>
            </div>
          ) : (
            <div className="rv-readout empty">
              <strong>Read the film</strong>
              <p>{showAnn ? 'Tap a marker to study a structure or finding. Raise the difficulty to reveal subtle findings.' : 'Annotations are hidden. Turn them on to study labelled structures.'}</p>
            </div>
          )}
          <div className="rv-meta">
            <div><span>Pathology</span><div className="rv-tags">{(c.pathologies || []).map((p) => <i key={p}>{p}</i>)}</div></div>
            <p className="rv-desc">{c.description}</p>
          </div>
          <div className="rv-annlist">
            <div className="rv-annlist-head"><MapPin size={14} /> Structures ({visibleAnn.length})</div>
            {visibleAnn.map((a) => (
              <button key={a.id} type="button" className={activeAnn === a.id ? 'active' : ''} onClick={() => setActiveAnn(a.id)}>
                <i style={{ background: TONE[a.tone] }} />{a.structure}
              </button>
            ))}
            {!visibleAnn.length && <p className="muted">No structures at this level.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
