/* Generates an editable PowerPoint (.pptx) user guide from the captured app
 * screenshots. One slide per feature, precisely positioned so every page is
 * self-contained and aligned. Run: node scripts/gen-pptx.mjs */
import pptxgen from 'pptxgenjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'docs', 'user-guide', 'shots');
const OUT = join(ROOT, 'docs', 'user-guide', 'DentalOS-AI-User-Guide.pptx');

const BG = '0A0E14';
const PANEL = '111722';
const LINE = '2E3950';
const TEXT = 'E8EEF9';
const MUTED = '8794AB';
const TEAL = '36D6C3';
const BLUE = '5B8BFF';

const slides = [
  {
    num: '1', title: 'Create an account or sign in',
    sub: 'Your private workspace keeps your sources, notes, flashcards, and progress saved.',
    img: '01-signin.png',
    steps: [
      'Open the app. New here? Click Create an account.',
      'Enter your name, email, and a password (8+ characters).',
      'Returning? Switch to Sign in with your email and password.',
      'Use the Light / Dark toggle (top right) any time.'
    ],
    tip: 'Private by design: everything you upload stays inside your own account.'
  },
  {
    num: '2', title: 'Add your study source',
    sub: 'Everything the app generates is built only from the material you add here.',
    img: '02-library.png',
    steps: [
      'Go to Notes & Books in the sidebar.',
      'Drop a PDF (lecture, chapter, handout) or paste notes, then press Index.',
      'Wait a few seconds — it appears under Indexed material.',
      'Remove any source with the trash icon next to it.'
    ],
    tip: 'Start here — most features stay locked until you add at least one source.'
  },
  {
    num: '3', title: 'The Dashboard',
    sub: 'Your home base: jump back in, explore anatomy, and see your progress.',
    img: '03-dashboard.png',
    steps: [
      'Continue studying picks up where you left off.',
      'Interactive Tooth Anatomy — tap a layer (enamel, dentin, pulp…) to study it.',
      'Your Progress shows readiness and a topic mastery map.',
      'The left sidebar moves you between every tool.'
    ],
    tip: 'The app is bounded like a real app — content scrolls inside the panel, never endlessly.'
  },
  {
    num: '4', title: 'AI Tutor — ask anything',
    sub: 'Ask a focused question and get a clear, source-grounded answer.',
    img: '04-tutor.png',
    steps: [
      'Open AI Tutor.',
      'Type a question at the bottom, or tap a suggested question.',
      'Read the answer — organised into clear sections from your notes.',
      'Use Listen to hear it, or Cards to turn it into flashcards.'
    ],
    tip: 'The AI Tutor is the one place meant to run long — it is a conversation.'
  },
  {
    num: '5', title: 'Study Tools — one focused output',
    sub: 'Turn your source into a specific study artifact. Pick the way you want to study.',
    img: '05-studytools.png',
    steps: [
      'Open Study Tools.',
      'From the "Way of study" dropdown, choose what you need.',
      'Press Generate. Each choice produces a different, on-topic result.',
      'Options: gap check, differential, visual map, mnemonics, and more.'
    ],
    tip: 'Each tool is unique: differential gives a table, visual learning gives a step map.'
  },
  {
    num: '6', title: 'How answers are shown',
    sub: 'Long content is interactive and scannable — never a wall of text.',
    img: '06-studytools-output.png',
    steps: [
      'Comparison tables are clean and condensed for quick scanning.',
      'Long answers split into collapsible sections — open what you need.',
      'Processes render as a connected step map.',
      'Wide tables scroll sideways inside their card.'
    ],
    tip: 'Answers are concise on purpose, and can still be wrong — verify against your material.'
  },
  {
    num: '7', title: 'Flashcards — active recall',
    sub: 'Review one card at a time with spaced repetition.',
    img: '08-flashcards.png',
    steps: [
      'Open Flashcards and press Make cards (or Cards under a tutor answer).',
      'Click the card or press Space to flip and reveal the answer.',
      'Move with Previous / Next (or the arrow keys).',
      'Rate yourself Again / Hard / Good / Easy to schedule reviews.'
    ],
    tip: 'Export your deck as Anki TSV any time.'
  },
  {
    num: '8', title: 'Quizzes — test yourself',
    sub: 'Answer multiple-choice questions and get instant feedback.',
    img: '09-exam-quiz.png',
    steps: [
      'Open Exams (or pick the Examiner tool in Study Tools).',
      'Start the test — questions render as an interactive quiz.',
      'Click an option: correct turns green, a wrong pick turns red, with a reason.',
      'A running score tracks how many you got right.'
    ],
    tip: 'Active recall + instant feedback is the fastest way to fix weak spots.'
  },
  {
    num: '9', title: 'Clinical Cases',
    sub: 'Practice reasoning with patient scenarios built from your notes.',
    img: '10-clinical-cases.png',
    steps: [
      'Open Clinical Cases.',
      'Pick a format: Clinical case, OSCE station, Exam checklist, or Rescue plan.',
      'Press the card button to generate it from your source.',
      'Work through the scenario step by step.'
    ],
    tip: 'OSCE station gives a patient script plus a marking rubric to rehearse against.'
  },
  {
    num: '10', title: 'Radiology — Case Library',
    sub: 'Browse X-rays, filter and bookmark, or upload your own.',
    img: '11-radiology-library.png',
    steps: [
      'Open Radiology to browse teaching X-rays.',
      'Filter by type, difficulty, or pathology; bookmark with the star.',
      'Upload your own X-ray (and delete it any time).',
      'Click a case to open it in the Viewer.'
    ],
    tip: 'Cases include panoramic, periapical, and bitewing films.'
  },
  {
    num: '11', title: 'Radiology — reading a film',
    sub: 'Zoom, adjust, measure, and study labelled structures.',
    img: '12-radiology-viewer.png',
    steps: [
      'Zoom / pan, adjust brightness & contrast, and invert the greyscale.',
      'Measure length, angle, area. Use Calibrate (a known length) for real mm.',
      'Tap a coloured marker to learn a structure; raise difficulty for subtle findings.',
      'Markers are colour-coded: radiopaque, radiolucent, finding.'
    ],
    tip: 'Labels and measurements are teaching aids and can be approximate — not for diagnosis.'
  },
  {
    num: '12', title: 'X-ray Interpreter',
    sub: 'Write your reading of a film and get AI feedback.',
    img: '13-interpreter.png',
    steps: [
      'Open X-ray Interpreter and choose a case from the dropdown.',
      'Write your interpretation in the text box.',
      'Press Get feedback — see what you got right, missed, landmarks, and significance.',
      'Your attempts and scores are tracked.'
    ],
    tip: 'The AI reader can misread radiographs — treat its feedback as practice, not truth.'
  }
];

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pres.layout = 'WIDE';
pres.author = 'DentalOS AI';
pres.title = 'DentalOS AI — User Guide';

// ---- Title slide ----
const t = pres.addSlide();
t.background = { color: BG };
t.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: TEAL } });
t.addText('DENTALOS AI · SIMAV DENTAL TUTOR', { x: 0.8, y: 1.7, w: 11.7, h: 0.4, fontSize: 14, color: TEAL, bold: true, charSpacing: 2 });
t.addText('Your complete guide to studying smarter', { x: 0.8, y: 2.2, w: 11.7, h: 1.6, fontSize: 44, color: TEXT, bold: true });
t.addText('DentalOS AI turns your own lectures and notes into summaries, flashcards, quizzes, clinical cases, and X-ray practice — all grounded in your material. This deck walks through every feature, step by step.',
  { x: 0.8, y: 3.9, w: 10.5, h: 1.2, fontSize: 16, color: MUTED, lineSpacingMultiple: 1.3 });
t.addText('A study aid for dental students. AI answers can be wrong — always verify against your source and instructors. Not for clinical use.',
  { x: 0.8, y: 6.6, w: 11.7, h: 0.6, fontSize: 11, color: MUTED, italic: true });

// ---- Feature slides ----
const IMG_X = 0.55, IMG_Y = 1.65, IMG_W = 7.7, IMG_H = 7.7 / 1.535;
const COL_X = 8.55, COL_W = 4.25;

for (const s of slides) {
  const sl = pres.addSlide();
  sl.background = { color: BG };
  // number chip
  sl.addShape(pres.ShapeType.roundRect, { x: 0.55, y: 0.45, w: 0.55, h: 0.55, fill: { color: TEAL }, rectRadius: 0.08, line: { type: 'none' } });
  sl.addText(s.num, { x: 0.55, y: 0.45, w: 0.55, h: 0.55, align: 'center', valign: 'middle', fontSize: 20, bold: true, color: '04130F' });
  // title + sub
  sl.addText(s.title, { x: 1.3, y: 0.42, w: 11.4, h: 0.6, fontSize: 26, bold: true, color: TEXT });
  sl.addText(s.sub, { x: 1.3, y: 1.0, w: 11.4, h: 0.5, fontSize: 13, color: MUTED });
  // divider
  sl.addShape(pres.ShapeType.line, { x: 0.55, y: 1.55, w: 12.25, h: 0, line: { color: LINE, width: 1 } });
  // image
  sl.addImage({ path: join(SHOTS, s.img), x: IMG_X, y: IMG_Y, w: IMG_W, h: IMG_H, rounding: false, sizing: { type: 'contain', w: IMG_W, h: IMG_H } });
  sl.addShape(pres.ShapeType.rect, { x: IMG_X, y: IMG_Y, w: IMG_W, h: IMG_H, fill: { type: 'none' }, line: { color: LINE, width: 1 } });
  // steps
  sl.addText('HOW TO USE', { x: COL_X, y: 1.7, w: COL_W, h: 0.35, fontSize: 12, bold: true, color: TEAL, charSpacing: 1 });
  sl.addText(s.steps.map((text) => ({ text, options: { bullet: { type: 'number' }, paraSpaceAfter: 9 } })),
    { x: COL_X, y: 2.15, w: COL_W, h: 3.7, fontSize: 14, color: TEXT, valign: 'top', lineSpacingMultiple: 1.05 });
  // tip box
  sl.addShape(pres.ShapeType.roundRect, { x: COL_X, y: 5.95, w: COL_W, h: 1.1, fill: { color: '14223A' }, line: { color: BLUE, width: 1 }, rectRadius: 0.08 });
  sl.addText([{ text: 'Tip  ', options: { bold: true, color: BLUE } }, { text: s.tip, options: { color: 'CDD9F5' } }],
    { x: COL_X + 0.18, y: 6.05, w: COL_W - 0.36, h: 0.9, fontSize: 11.5, valign: 'middle', lineSpacingMultiple: 1.05 });
}

// ---- Closing slide ----
const c = pres.addSlide();
c.background = { color: BG };
c.addText("That's the whole app.", { x: 0.8, y: 2.3, w: 11.7, h: 0.9, fontSize: 36, bold: true, color: TEXT, align: 'center' });
c.addText('The fastest routine: add a source → ask the tutor → make flashcards → quiz yourself → review weak spots. Add radiology practice whenever you want to read films.',
  { x: 1.8, y: 3.3, w: 9.7, h: 1.2, fontSize: 16, color: MUTED, align: 'center', lineSpacingMultiple: 1.3 });
c.addText('DentalOS AI · Simav Dental Tutor — an educational study aid. Always verify against your course material and instructors.',
  { x: 1.5, y: 6.4, w: 10.3, h: 0.6, fontSize: 11, color: MUTED, align: 'center', italic: true });

await pres.writeFile({ fileName: OUT });
console.log('wrote', OUT);
