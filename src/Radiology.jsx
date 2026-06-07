import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

// Interactive radiograph reader. The "x-ray" is drawn procedurally in SVG (no
// image asset) so it renders anywhere, stays crisp at any zoom, and lets every
// finding be an addressable annotation. Pan/zoom is a CSS transform on the stage;
// findings reveal with a GSAP stagger so students read the image structure by
// structure instead of all at once.

// Coordinates are percentages of the radiograph field (viewBox 160 x 112),
// so they track the SVG content at any zoom.
const FINDINGS = [
  {
    id: 'enamel',
    x: 50,
    y: 14,
    tone: 'opaque',
    label: 'Enamel cap',
    note: 'Most radiopaque tissue. The bright outer shell of the crown — denser than dentin, so it absorbs the most x-rays.'
  },
  {
    id: 'dentin',
    x: 44,
    y: 32,
    tone: 'opaque',
    label: 'Dentin',
    note: 'Moderately radiopaque body of the tooth beneath the enamel, surrounding the pulp.'
  },
  {
    id: 'pulp',
    x: 50,
    y: 31,
    tone: 'lucent',
    label: 'Pulp chamber',
    note: 'Radiolucent (dark) — soft tissue and the canal space let x-rays pass. Watch its size: it narrows with age and recedes from caries.'
  },
  {
    id: 'caries',
    x: 63,
    y: 24,
    tone: 'finding',
    label: 'Interproximal caries',
    note: 'A radiolucent notch on the contact surface, just below the contact point. Classic early carious lesion on a bitewing or PA.'
  },
  {
    id: 'pdl',
    x: 39,
    y: 60,
    tone: 'lucent',
    label: 'PDL space',
    note: 'Thin radiolucent line hugging the root — the periodontal ligament. Uniform width is healthy; widening flags occlusal trauma or inflammation.'
  },
  {
    id: 'laminadura',
    x: 61,
    y: 62,
    tone: 'opaque',
    label: 'Lamina dura',
    note: 'Bright radiopaque line of cortical bone lining the socket. Intact = healthy attachment; loss around the apex suggests pathology.'
  },
  {
    id: 'periapical',
    x: 50,
    y: 90,
    tone: 'finding',
    label: 'Periapical radiolucency',
    note: 'A dark, rounded area at the root tip. Loss of lamina dura plus this halo points to apical periodontitis or a periapical lesion.'
  },
  {
    id: 'bone',
    x: 19,
    y: 76,
    tone: 'opaque',
    label: 'Alveolar bone',
    note: 'The trabecular background. Read its pattern and crest height — bone loss appears as reduced opacity and a lowered crest.'
  }
];

const TONE_COLOR = { opaque: '#7fd4cf', lucent: '#ffd166', finding: '#ff6b81' };
const TONE_LABEL = { opaque: 'Radiopaque', lucent: 'Radiolucent', finding: 'Finding' };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Radiograph() {
  // Procedural periapical of a lower molar: opaque tooth + bone, lucent pulp /
  // PDL / periapical lesion. Kept in a 0..100 viewBox so finding coords line up.
  return (
    <svg className="rad-film" viewBox="0 0 160 112" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id="radBone" cx="50%" cy="42%" r="80%">
          <stop offset="0%" stopColor="#3a4a55" />
          <stop offset="62%" stopColor="#222d36" />
          <stop offset="100%" stopColor="#121920" />
        </radialGradient>
        <linearGradient id="radEnamel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f8fb" />
          <stop offset="100%" stopColor="#cdd9e0" />
        </linearGradient>
        <linearGradient id="radDentin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c3ccd2" />
          <stop offset="100%" stopColor="#8c99a2" />
        </linearGradient>
        <filter id="radGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
          <feComposite operator="over" in2="SourceGraphic" />
        </filter>
        <filter id="radSoft"><feGaussianBlur stdDeviation="0.4" /></filter>
      </defs>

      {/* film background + bone */}
      <rect x="0" y="0" width="160" height="112" fill="url(#radBone)" />

      <g filter="url(#radSoft)">
        {/* trabecular bone texture filling the field */}
        <g opacity="0.5" stroke="#54636d" strokeWidth="0.5" fill="none">
          <path d="M4 66 L24 74 L44 68 L64 78 L86 70 L108 80 L132 72 L156 80" />
          <path d="M6 90 L26 84 L48 94 L70 86 L96 96 L120 88 L148 96" />
          <path d="M8 54 L30 60 L52 52 L78 62 L104 54 L130 62 L156 56" />
          <path d="M2 102 L30 98 L60 104 L92 98 L124 104 L156 100" />
        </g>

        {/* neighbouring tooth shadows for context */}
        <path d="M14 30 Q26 24 38 30 L34 50 Q30 70 26 96 L18 96 Q14 70 12 50 Z" fill="#7e8a92" opacity="0.45" />
        <path d="M122 30 Q134 24 146 30 L144 50 Q140 70 134 96 L126 96 Q122 70 122 50 Z" fill="#7e8a92" opacity="0.45" />

        {/* alveolar crest */}
        <path d="M0 50 Q40 45 80 48 Q120 45 160 50 L160 48 Q120 43 80 46 Q40 43 0 48 Z" fill="#9aa7af" opacity="0.7" />

        {/* tooth: dentin body + root, centred at x=80 */}
        <path
          d="M60 16 Q80 10 100 16 L96 46 Q92 70 86 104 Q83 112 80 104 Q77 112 74 104 Q68 70 64 46 Z"
          fill="url(#radDentin)"
        />
        {/* enamel crown cap */}
        <path d="M59 17 Q80 9 101 17 L98 30 Q80 25 62 30 Z" fill="url(#radEnamel)" />

        {/* pulp chamber + canal (radiolucent) */}
        <path
          d="M73 28 Q80 26 87 28 L85 44 Q83 60 81 100 Q80 104 79 100 Q77 60 75 44 Z"
          fill="#1b242b"
          opacity="0.92"
        />

        {/* PDL space (thin radiolucent line down the root) */}
        <path d="M64 47 Q60 72 74 104" fill="none" stroke="#10171c" strokeWidth="0.9" opacity="0.85" />
        <path d="M96 47 Q100 72 86 104" fill="none" stroke="#10171c" strokeWidth="0.9" opacity="0.85" />

        {/* lamina dura (bright line outside PDL) */}
        <path d="M63 47 Q58.5 72 73 105" fill="none" stroke="#cfd9de" strokeWidth="0.7" opacity="0.8" />
        <path d="M97 47 Q101.5 72 87 105" fill="none" stroke="#cfd9de" strokeWidth="0.7" opacity="0.8" />

        {/* interproximal caries notch */}
        <path d="M100 26 q-5 1 -4 6 q4 -1 4 -6 Z" fill="#10171c" opacity="0.85" />

        {/* periapical radiolucency at the apex */}
        <ellipse cx="80" cy="104" rx="7.5" ry="6" fill="#0c1216" opacity="0.85" />
      </g>
      <rect x="0" y="0" width="160" height="112" filter="url(#radGrain)" opacity="0.5" />
    </svg>
  );
}

export default function Radiology({ onStudy }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const stageRef = useRef(null);
  const pinsRef = useRef(null);
  const dragRef = useRef(null);

  const reveal = useCallback(() => {
    setRevealed(true);
    setActive(null);
    const pins = pinsRef.current ? Array.from(pinsRef.current.children) : [];
    if (!pins.length) return;
    gsap.fromTo(
      pins,
      { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' },
      { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', stagger: 0.09 }
    );
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback((event) => {
    event.preventDefault();
    setScale((s) => clamp(s + (event.deltaY < 0 ? 0.3 : -0.3), MIN_SCALE, MAX_SCALE));
  }, []);

  const onPointerDown = useCallback((event) => {
    if (scale <= 1) return;
    dragRef.current = { x: event.clientX - pos.x, y: event.clientY - pos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [scale, pos]);

  const onPointerMove = useCallback((event) => {
    if (!dragRef.current) return;
    setPos({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y });
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // First mount: bring the findings in once the film is on screen.
  useEffect(() => {
    const t = setTimeout(reveal, 400);
    return () => clearTimeout(t);
  }, [reveal]);

  const activeFinding = FINDINGS.find((f) => f.id === active) || null;

  return (
    <div className="rad-viewer">
      <div className="rad-main">
        <div
          className={`rad-stage${scale > 1 ? ' grabbable' : ''}`}
          ref={stageRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className="rad-canvas"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          >
            <div className="rad-film-wrap">
            <Radiograph />
            <div className="rad-pins" ref={pinsRef}>
              {FINDINGS.map((finding) => (
                <button
                  key={finding.id}
                  type="button"
                  className={`rad-pin tone-${finding.tone}${active === finding.id ? ' active' : ''}`}
                  style={{ left: `${finding.x}%`, top: `${finding.y}%`, color: TONE_COLOR[finding.tone] }}
                  onClick={() => setActive(finding.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label={finding.label}
                >
                  <span className="rad-pin-dot" />
                </button>
              ))}
            </div>
            </div>
          </div>

          <div className="rad-controls">
            <button type="button" onClick={() => setScale((s) => clamp(s + 0.4, MIN_SCALE, MAX_SCALE))} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setScale((s) => clamp(s - 0.4, MIN_SCALE, MAX_SCALE))} aria-label="Zoom out">−</button>
            <button type="button" onClick={reset} aria-label="Reset view">⤢</button>
          </div>
          <span className="rad-zoomlabel">{Math.round(scale * 100)}%</span>
        </div>
        <div className="rad-toolbar">
          <button type="button" className="rad-reveal" onClick={reveal}>Replay findings</button>
          <span className="rad-hint">{scale > 1 ? 'Drag to pan · scroll to zoom' : 'Scroll to zoom · tap a marker'}</span>
        </div>
      </div>

      <aside className="rad-readout">
        {activeFinding ? (
          <div className="rad-detail">
            <span className={`rad-tag tone-${activeFinding.tone}`}>{TONE_LABEL[activeFinding.tone]}</span>
            <strong>{activeFinding.label}</strong>
            <p>{activeFinding.note}</p>
            {onStudy && (
              <button
                type="button"
                className="rad-studybtn"
                onClick={() => onStudy(`Teach me how to identify "${activeFinding.label}" on a dental radiograph from my active source. Include what it looks like, what it means clinically, and the common pitfalls when reading it.`)}
              >
                Study this on my source
              </button>
            )}
          </div>
        ) : (
          <div className="rad-detail empty">
            <strong>Read the film</strong>
            <p>Tap any marker to learn the structure or finding. Markers are colour-coded by how they appear on the radiograph.</p>
          </div>
        )}
        <ul className="rad-legend">
          {Object.entries(TONE_LABEL).map(([tone, label]) => (
            <li key={tone}><span style={{ background: TONE_COLOR[tone] }} />{label}</li>
          ))}
        </ul>
        <div className="rad-findlist">
          {FINDINGS.map((finding) => (
            <button
              key={finding.id}
              type="button"
              className={active === finding.id ? 'active' : ''}
              onClick={() => setActive(finding.id)}
            >
              <i style={{ background: TONE_COLOR[finding.tone] }} />
              {finding.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
