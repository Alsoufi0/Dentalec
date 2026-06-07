/*
 * Generates procedural demo dental X-ray images (SVG) for the radiology module.
 * These are teaching stand-ins so the Case Library / viewers have real grayscale
 * content before the licensed datasets (DENTEX / Roboflow / Mendeley) are added.
 * Re-run any time with:  node scripts/genXrays.mjs
 *
 * Output: public/radiology/cases/{panoramic,periapical,bitewing}/*.svg
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'radiology', 'cases');

const DENTIN = '#aeb8bf';
const DENTIN_D = '#7c8893';
const ENAMEL = '#eef3f7';
const PULP = '#1b242b';
const BONE_LINE = '#5a6772';

const defs = `
  <defs>
    <radialGradient id="bone" cx="50%" cy="44%" r="80%">
      <stop offset="0%" stop-color="#394954"/>
      <stop offset="60%" stop-color="#212c35"/>
      <stop offset="100%" stop-color="#10161c"/>
    </radialGradient>
    <linearGradient id="dentin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${DENTIN}"/>
      <stop offset="100%" stop-color="${DENTIN_D}"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"/>
      <feComposite operator="over" in2="SourceGraphic"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter>
  </defs>`;

// One stylised tooth. (cx, cy) = occlusal end on the arch; it extends `len`
// in direction d (+1 down, -1 up). Wide crown tapering to a narrow root.
function tooth(cx, cy, w, len, d, { caries = false } = {}) {
  const cw = w / 2;
  const rw = w * 0.2;
  const tip = cy + d * len;
  const crownEnd = cy + d * len * 0.34;
  const body = `M${cx - cw} ${cy} Q${cx} ${cy - d * 4} ${cx + cw} ${cy}
    L${cx + rw} ${tip} Q${cx} ${tip + d * 5} ${cx - rw} ${tip} Z`;
  const enamel = `M${cx - cw} ${cy} Q${cx} ${cy - d * 6} ${cx + cw} ${cy}
    L${cx + cw * 0.7} ${crownEnd} Q${cx} ${crownEnd - d * 3} ${cx - cw * 0.7} ${crownEnd} Z`;
  const pulp = `M${cx} ${crownEnd} L${cx} ${cy + d * len * 0.82}`;
  const cariesMark = caries
    ? `<path d="M${cx + cw} ${cy + d * 6} q${-w * 0.22} ${d * 3} 0 ${d * 8}" fill="${PULP}" opacity="0.85"/>`
    : '';
  return `<g filter="url(#soft)">
    <path d="${body}" fill="url(#dentin)"/>
    <path d="${enamel}" fill="${ENAMEL}" opacity="0.92"/>
    <path d="${pulp}" stroke="${PULP}" stroke-width="${w * 0.12}" opacity="0.8" fill="none" stroke-linecap="round"/>
    ${cariesMark}
  </g>`;
}

function wrap(w, h, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
${defs}
  <rect width="${w}" height="${h}" fill="url(#bone)"/>
${inner}
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.45"/>
</svg>`;
}

/* ---------- Panoramic ---------- */
function panoramic() {
  const W = 1200, H = 620;
  const cx = W / 2, baseY = 330, drop = 64, half = 520;
  const curveY = (x) => baseY - drop * Math.pow((x - cx) / half, 2);
  let s = '';

  // maxillary sinuses + nasal airway (radiolucent)
  s += `<g filter="url(#soft)" fill="#0e141a" opacity="0.7">
    <ellipse cx="${cx - 250}" cy="200" rx="120" ry="78"/>
    <ellipse cx="${cx + 250}" cy="200" rx="120" ry="78"/>
    <path d="M${cx - 26} 150 q26 -40 52 0 l-8 90 q-18 16 -36 0 Z"/>
  </g>`;

  // mandible lower border + rami + condyles
  s += `<g fill="none" stroke="#9aa7af" stroke-width="6" opacity="0.55" filter="url(#soft)">
    <path d="M150 470 Q${cx} 600 1050 470"/>
    <path d="M150 470 Q120 300 175 150 M1050 470 Q1080 300 1025 150"/>
    <path d="M150 250 q-28 -36 18 -70 M1050 250 q28 -36 -18 -70"/>
  </g>`;
  // inferior alveolar nerve canal hint
  s += `<path d="M205 380 Q${cx} 470 995 380" fill="none" stroke="${BONE_LINE}" stroke-width="3" opacity="0.4" stroke-dasharray="2 6"/>`;
  // trabecular texture
  s += `<g opacity="0.4" stroke="${BONE_LINE}" stroke-width="0.8" fill="none">`;
  for (let i = 0; i < 7; i++) s += `<path d="M40 ${120 + i * 70} L1160 ${110 + i * 72}"/>`;
  s += `</g>`;

  // 14 columns of teeth, narrow at centre (incisors) -> wide at back (molars)
  const cols = 14;
  for (let i = 0; i < cols; i++) {
    const t = (i - (cols - 1) / 2) / ((cols - 1) / 2); // -1..1
    const x = cx + t * half * 0.92;
    const y = curveY(x);
    const w = 30 + Math.abs(t) * 30;
    const len = 95 + Math.abs(t) * 55;
    const caries = i === 4; // upper one with a carious notch
    s += tooth(x, y - 6, w, len, -1, { caries }); // upper (root up)
    s += tooth(x, y + 6, w * 0.96, len * 0.92, 1); // lower (root down)
  }

  // periapical radiolucency at an upper molar apex
  const lx = cx - half * 0.78;
  s += `<ellipse cx="${lx}" cy="${curveY(lx) - 150}" rx="22" ry="17" fill="#0b1015" opacity="0.85" filter="url(#soft)"/>`;

  // impacted lower-right third molar (angled, lodged below last molar)
  const ix = cx + half * 0.9;
  const iy = curveY(ix) + 70;
  s += `<g transform="rotate(58 ${ix} ${iy})">${tooth(ix, iy, 52, 90, 1)}</g>`;

  return wrap(W, H, s);
}

/* ---------- Periapical ---------- */
function periapical({ lesion = true, caries = true } = {}) {
  const W = 480, H = 620;
  const cx = W / 2;
  let s = '';
  // neighbour shadows + crest
  s += `<g filter="url(#soft)" opacity="0.4" fill="#7e8a92">
    <path d="M70 150 Q110 130 150 150 L138 360 Q120 470 96 520 L60 520 Q44 420 50 300 Z"/>
    <path d="M${W - 70} 150 Q${W - 110} 130 ${W - 150} 150 L${W - 138} 360 Q${W - 120} 470 ${W - 96} 520 L${W - 60} 520 Q${W - 44} 420 ${W - 50} 300 Z"/>
  </g>`;
  s += `<path d="M0 250 Q${cx} 225 ${W} 250 L${W} 240 Q${cx} 215 0 240 Z" fill="#9aa7af" opacity="0.6"/>`;
  s += `<g opacity="0.4" stroke="${BONE_LINE}" stroke-width="0.9" fill="none">`;
  for (let i = 0; i < 5; i++) s += `<path d="M20 ${320 + i * 60} L${W - 20} ${310 + i * 62}"/>`;
  s += `</g>`;
  // central tooth (single root)
  s += tooth(cx, 110, 150, 360, 1, { caries });
  // PDL + lamina dura
  s += `<path d="M${cx - 70} 250 Q${cx - 92} 380 ${cx - 30} 520" fill="none" stroke="#10171c" stroke-width="3" opacity="0.8"/>
    <path d="M${cx + 70} 250 Q${cx + 92} 380 ${cx + 30} 520" fill="none" stroke="#10171c" stroke-width="3" opacity="0.8"/>`;
  if (lesion) s += `<ellipse cx="${cx}" cy="525" rx="34" ry="28" fill="#0b1015" opacity="0.85" filter="url(#soft)"/>`;
  return wrap(W, H, s);
}

/* ---------- Bitewing ---------- */
function bitewing() {
  const W = 620, H = 430;
  let s = '';
  // occlusal contact line
  s += `<rect x="0" y="208" width="${W}" height="14" fill="#0e141a" opacity="0.5"/>`;
  s += `<g opacity="0.4" stroke="${BONE_LINE}" stroke-width="0.9" fill="none">
    <path d="M20 60 L600 70"/><path d="M20 360 L600 350"/></g>`;
  const cols = 4;
  for (let i = 0; i < cols; i++) {
    const x = 110 + i * 130;
    const w = 96;
    s += tooth(x, 205, w, 150, -1, { caries: i === 1 }); // upper crowns down
    s += tooth(x + 30, 225, w, 150, 1, { caries: i === 2 }); // lower crowns up
  }
  // alveolar bone crest between roots
  s += `<path d="M60 150 Q${W / 2} 120 560 150" fill="none" stroke="#9aa7af" stroke-width="5" opacity="0.5"/>
    <path d="M60 285 Q${W / 2} 315 560 285" fill="none" stroke="#9aa7af" stroke-width="5" opacity="0.5"/>`;
  return wrap(W, H, s);
}

const files = [
  ['panoramic/pano-001.svg', panoramic()],
  ['periapical/pa-001.svg', periapical({ lesion: true, caries: true })],
  ['periapical/pa-002.svg', periapical({ lesion: false, caries: true })],
  ['bitewing/bw-001.svg', bitewing()]
];

for (const [rel, svg] of files) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg, 'utf8');
  console.log('wrote', rel, `(${svg.length} bytes)`);
}
console.log('done');
