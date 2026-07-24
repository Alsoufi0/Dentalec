import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bell,
  BookOpen,
  BookmarkPlus,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Compass,
  Download,
  FileQuestion,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  Layers,
  LayoutDashboard,
  Library,
  LineChart,
  Loader2,
  MessageCircleQuestion,
  Mic,
  Moon,
  Pause,
  ScanSearch,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  Sun,
  Timer,
  Trash2,
  Upload,
  UserPlus,
  Volume2,
  XCircle,
  Zap
} from 'lucide-react';
import './styles.css';
import './radiology/app-polish.css';

import { CasesPage, RadiologyPage, InterpreterPage } from './radiology/index.jsx';

// Radiology routes render their own dark clinical chrome, so the generic
// page-intro header is suppressed for them.
const RAD_PAGES = ['cases', 'radiology', 'interpreter', 'radiologyHub'];

const API_BASE = '/api';
const STORAGE_KEY = 'simav-dental-tutor-state-v1';
const THEME_KEY = 'simav-dental-tutor-theme-v1';
const SPOKEN_TEXT_LIMIT = 1400;

const modes = [
  { id: 'answer', label: 'Q&A', icon: MessageCircleQuestion, hint: 'ask anything', prompt: 'Ask about caries, anatomy, procedures, pathology, or any indexed study-source detail.' },
  { id: 'summary', label: 'Summary', icon: BookOpen, hint: 'chapter recap', prompt: 'Generate high-yield summaries, exam traps, and active-recall checklists from the active source.' },
  { id: 'explanation', label: 'Explain', icon: Brain, hint: 'teach a topic', prompt: 'Ask for a clear explanation with mechanism, clinical relevance, and memory hooks.' },
  { id: 'test', label: 'Test', icon: FileQuestion, hint: 'oral exam', prompt: 'Practice oral exam questions, grade your answers, and target weak spots.' }
];

const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'overview', prompt: 'Your study hub: progress, next actions, and current source set.' },
  { id: 'library', label: 'Library', icon: Upload, hint: 'sources', prompt: 'Upload PDFs or index pasted dental notes, rubrics, protocols, and handouts.' },
  ...modes,
  { id: 'mastery', label: 'Progress', icon: CheckCircle2, hint: 'your activity', prompt: 'Your real study activity: questions asked, flashcards made, and cards due for review.' },
  { id: 'engines', label: 'Study Tools', icon: Brain, hint: 'from your notes', prompt: 'Turn your uploaded source into focused study outputs: gap checks, differentials, protocols, cases, visuals, mnemonics, and more.' },
  { id: 'clinic', label: 'Clinical Cases', icon: Stethoscope, hint: 'practice', prompt: 'Generate patient cases, OSCE stations, and exam checklists from your uploaded source.' },
  { id: 'cases', label: 'Case Library', icon: Layers, hint: 'x-ray cases', prompt: 'Browse and filter teaching radiographs, then open one in the viewer.' },
  { id: 'radiology', label: 'Radiology Viewer', icon: Activity, hint: 'viewer', prompt: 'Zoom, window, measure, and study annotated structures on an X-ray.' },
  { id: 'interpreter', label: 'X-ray Interpreter', icon: Sparkles, hint: 'AI feedback', prompt: 'Write your reading of a film and get instant AI feedback.' },
  { id: 'kit', label: 'Study Kit', icon: Library, hint: 'notes & cards', prompt: 'Saved notes, generated flashcards, exports, and review material.' },
  { id: 'learn', label: 'Learn', icon: Brain, hint: 'tutor', prompt: 'Ask, explain, or summarize in one continuous tutor conversation from your active source.' },
  { id: 'practice', label: 'Practice', icon: FileQuestion, hint: 'active recall', prompt: 'Flashcards, quiz yourself, and work clinical cases from your source.' },
  { id: 'radiologyHub', label: 'Radiology', icon: Activity, hint: 'x-ray', prompt: 'Browse teaching radiographs and get AI feedback on your reading.' }
];

// Six clear areas. The primary study loop, then Radiology as a distinct tool.
const sidebarItems = [
  { page: 'dashboard', label: 'Home', icon: Home, hint: 'study path' },
  { page: 'library', label: 'Library', icon: Library, hint: 'your sources' },
  { page: 'learn', label: 'Learn', icon: Brain, hint: 'tutor + aids' },
  { page: 'practice', label: 'Practice', icon: FileQuestion, hint: 'cards, quiz, cases' },
  { page: 'mastery', label: 'Progress', icon: LineChart, hint: 'your activity' },
  { page: 'radiologyHub', label: 'Radiology', icon: Activity, hint: 'x-ray', section: 'clinical' }
];

const stopPhrases = [
  'thank you',
  'thanks',
  'stop',
  'stop talking',
  'pause',
  'be quiet',
  'that is enough',
  'thats enough',
  "that's enough"
];

const voicePersonas = [
  { id: 'peer', label: 'Supportive Peer', voice: 'cedar' },
  { id: 'professor', label: 'Stern Professor', voice: 'cedar' },
  { id: 'clinic', label: 'Clinical Mentor', voice: 'cedar' }
];

const dentalosEngines = [
  { id: 'knowledgeGap', title: 'Knowledge Gap Detector', icon: Brain, group: 'Understand', produces: 'Gap map', copy: 'Spot missing prerequisites and confused concepts.' },
  { id: 'differentialDiagnosis', title: 'Differential Diagnosis', icon: ClipboardList, group: 'Understand', produces: 'Comparison table', copy: 'Tell similar conditions apart in one table.' },
  { id: 'visualLearning', title: 'Visual Learning', icon: LayoutDashboard, group: 'Understand', produces: 'Flow diagram', copy: 'See the topic as flow maps and pathways.' },
  { id: 'examinerQuestions', title: 'Examiner Engine', icon: FileQuestion, group: 'Practice', produces: 'MCQs + rubric', copy: 'Board-style questions with a marking rubric.' },
  { id: 'clinicalCase', title: 'Case Simulator', icon: MessageCircleQuestion, group: 'Practice', produces: 'Worked case', copy: 'Solve a realistic patient case step by step.' },
  { id: 'memoryPlan', title: 'Memory Engine', icon: BookmarkPlus, group: 'Practice', produces: 'Review plan', copy: 'Spaced-review schedule, mnemonics, and pearls.' },
  { id: 'treatmentProtocol', title: 'Treatment Protocol', icon: CheckCircle2, group: 'Clinical', produces: 'Protocol table', copy: 'Safe steps, materials, and common pitfalls.' },
  { id: 'radiologyChecklist', title: 'Radiology Learning', icon: FileText, group: 'Clinical', produces: 'Read checklist', copy: 'A checklist for reading radiographs.' },
  { id: 'professorStudio', title: 'Professor Studio', icon: GraduationCap, group: 'Teach', produces: 'Teaching pack', copy: 'Objectives, OSCE stations, and rubrics.' }
];

const engineGroups = [
  { key: 'Understand', caption: 'Build and repair understanding' },
  { key: 'Practice', caption: 'Test yourself and retain it' },
  { key: 'Clinical', caption: 'Apply it safely in context' },
  { key: 'Teach', caption: 'Professor and assessment tools' }
];

const spacedIntervals = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 7
};

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clipSpokenText(text) {
  const clean = stripMarkdown(text);
  if (clean.length <= SPOKEN_TEXT_LIMIT) return clean;
  const clipped = clean.slice(0, SPOKEN_TEXT_LIMIT);
  const lastSentence = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('? '), clipped.lastIndexOf('! '));
  return `${clipped.slice(0, lastSentence > 700 ? lastSentence + 1 : SPOKEN_TEXT_LIMIT).trim()} I paused there to keep the spoken answer short. Ask me to continue if you want more.`;
}

function stateKeyForUser(userId) {
  return `${STORAGE_KEY}:${userId}`;
}

// crypto.randomUUID is only available in secure contexts; fall back to a
// timestamp-random id so the app never crashes on plain-http access.
function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptySourceData() {
  return { chat: [], flashcards: [], notes: '' };
}

function InlineText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function isMarkdownTableLine(line) {
  return /^\|.+\|$/.test(line.trim());
}

function isMarkdownSeparatorLine(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function buildContentBlocks(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isMarkdownTableLine(line)) {
      const tableLines = [];
      while (index < lines.length && isMarkdownTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      blocks.push({ type: 'table', lines: tableLines });
    } else {
      blocks.push({ type: 'line', line });
    }
  }
  return blocks;
}

function scoreFromCell(value) {
  const match = String(value || '').match(/\b(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\b/);
  if (!match) return null;
  const score = Number(match[1]);
  const max = Number(match[2] || 5);
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return null;
  return { score, max, percent: Math.max(0, Math.min(100, (score / max) * 100)) };
}

function ResponseTable({ lines }) {
  const hasSeparator = lines.some(isMarkdownSeparatorLine);
  const cleaned = lines.filter((line) => !isMarkdownSeparatorLine(line));
  if (!cleaned.length) return null;
  const rows = cleaned.map(parseTableRow).filter((row) => row.some(Boolean));
  if (!rows.length) return null;
  const [header, ...body] = rows;
  // A Markdown table's first row is its header. The |---| separator marks that,
  // so when a separator is present always treat row 0 as the header. Fall back
  // to a keyword guess only for stray pipe rows with no separator.
  const keywordHeader = header.some((cell) => /criteria|marks|score|comments|finding|feature|step|task|rubric|domain|aspect|risk|type|sign|cause|indicat|category|item|column/i.test(cell));
  const useFirstAsHeader = hasSeparator || keywordHeader;
  const dataRows = useFirstAsHeader ? body : rows;
  const headers = useFirstAsHeader ? header : rows[0].map((_, index) => `Column ${index + 1}`);
  const scoreColumnIndex = headers.findIndex((header) => /mark|score/i.test(header));
  const labelColumnIndex = headers.findIndex((header) => /criteria|domain|skill|task|question|module|step|finding|feature/i.test(header));
  const scoreRows = scoreColumnIndex >= 0
    ? dataRows
        .map((row) => ({
          label: row[labelColumnIndex >= 0 ? labelColumnIndex : 0] || 'Item',
          value: row[scoreColumnIndex],
          score: scoreFromCell(row[scoreColumnIndex])
        }))
        .filter((row) => row.score)
    : [];

  return (
    <>
      <div className="answer-table-wrap">
        <table className="answer-table">
          <thead>
            <tr>
              {headers.map((cell, index) => (
                <th key={`${cell}-${index}`}>
                  <InlineText text={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIndex) => (
              <tr key={`${row.join('-')}-${rowIndex}`}>
                {headers.map((_, cellIndex) => {
                  const cell = row[cellIndex] || '';
                  const score = /mark|score/i.test(headers[cellIndex] || '') ? scoreFromCell(cell) : null;
                  return (
                    <td key={`${cell}-${cellIndex}`}>
                      {score ? (
                        <span className="score-cell">
                          <span>{cell}</span>
                          <i style={{ '--score-width': `${score.percent}%` }}></i>
                        </span>
                      ) : (
                        <InlineText text={cell} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scoreRows.length >= 2 && (
        <div className="answer-chart" aria-label="Score chart">
          {scoreRows.map((row, index) => (
            <div className="chart-row" key={`${row.label}-${index}`}>
              <span>{row.label}</span>
              <div>
                <i style={{ '--score-width': `${row.score.percent}%` }}></i>
              </div>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function lineIsHeading(line, mode) {
  const heading = line.replace(/^#{1,6}\s*/, '');
  const numbered = heading.match(/^(\d+)\.\s+(.*)/);
  return (
    /^#{1,6}\s/.test(line) ||
    (/^[A-Z][^.!?]{2,48}:$/.test(heading) && !numbered) ||
    (mode === 'test' && /question|answer|rubric|explanation|challenge|case|vignette/i.test(heading))
  );
}

// Renders one parsed block (table, flow map, numbered/bullet row, heading, or
// paragraph). Shared by the flat and the collapsible-section layouts.
function isRuleLine(line) {
  return /^\s*([-*_=])\1{2,}\s*$/.test(line);
}

function RenderBlock({ block, mode }) {
  if (block.type === 'table') return <ResponseTable lines={block.lines} />;

  const line = block.line;
  // Horizontal-rule / separator lines (---, ***, ___, ===) are noise here.
  if (isRuleLine(line)) return null;
  const heading = line.replace(/^#{1,6}\s*/, '');
  const numbered = heading.match(/^(\d+)\.\s+(.*)/);
  const bullet = heading.match(/^[-*]\s+(.*)/);

  // Turn ASCII arrow chains (A -> B -> C) into a real visual flow map. Handle
  // long chains too so they never fall back to raw "A -> B ->" text.
  const flowSource = bullet ? bullet[1] : numbered ? numbered[2] : heading;
  const flowNodes = flowSource.split(/\s*(?:->|=>|→)\s*/).map((node) => node.trim()).filter(Boolean);
  if (flowNodes.length >= 2 && flowNodes.length <= 12 && /(?:->|=>|→)/.test(flowSource)) {
    // A proper connected step map (a stepper with a connecting rail), not text arrows.
    return (
      <div className="vmap">
        {flowNodes.map((node, nodeIndex) => (
          <div className="vmap-step" key={`${node}-${nodeIndex}`}>
            <div className="vmap-rail"><span className="vmap-dot">{nodeIndex + 1}</span></div>
            <div className="vmap-card"><InlineText text={node} /></div>
          </div>
        ))}
      </div>
    );
  }
  if (numbered) {
    return <div className="answer-row numbered"><span>{numbered[1]}</span><p><InlineText text={numbered[2]} /></p></div>;
  }
  if (bullet) {
    return <div className="answer-row bullet"><span></span><p><InlineText text={bullet[1]} /></p></div>;
  }
  if (lineIsHeading(line, mode)) {
    return <h3><InlineText text={heading.replace(/:$/, '')} /></h3>;
  }
  return <p><InlineText text={heading} /></p>;
}

// A short text preview of what sits inside a collapsed section, so students
// can see the content is there instead of guessing from a bare count.
function sectionPreview(blocks) {
  for (const block of blocks) {
    if (block.type !== 'line') continue;
    if (isRuleLine(block.line)) continue;
    // Render arrow chains as readable "A to B to C" instead of raw "->".
    const text = stripMarkdown(block.line).replace(/\s*(?:->|=>|→)\s*/g, ' → ').trim();
    if (text) return text.length > 140 ? `${text.slice(0, 140).trim()}...` : text;
  }
  if (blocks.some((block) => block.type === 'table')) return 'Includes a comparison table.';
  return '';
}

// A collapsible section of an answer. Lets a student scan headings and open
// only what they need instead of reading everything at once.
function AnswerSection({ title, blocks, mode, defaultOpen, openSignal }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (openSignal?.n) setOpen(openSignal.open);
  }, [openSignal?.n]);
  const preview = sectionPreview(blocks);
  return (
    <section className={`answer-section${open ? ' open' : ''}`}>
      <button type="button" className="answer-section-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={16} className="sec-caret" />
        <span><InlineText text={title} /></span>
      </button>
      {!open && preview && <em className="sec-preview">{preview}</em>}
      {open && (
        <div className="answer-section-body">
          {blocks.map((block, index) => <RenderBlock key={index} block={block} mode={mode} />)}
        </div>
      )}
    </section>
  );
}

// Pull multiple-choice questions out of an AI answer so they can be answered
// interactively. Tolerates common formats: an optional vignette/stem, lettered
// options (A) / A. / A:), an "Answer: X" line, and an "Explanation:" line.
function parseQuizQuestions(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim());
  const questions = [];
  let stem = []; let opts = []; let answer = null; let exp = [];
  const flush = () => {
    if (opts.length >= 2) {
      questions.push({
        question: stem.join(' ').replace(/^\**\s*(?:Q(?:uestion)?\s*\d*[:.)\-]?\s*|\d+[.)]\s*)/i, '').replace(/\*\*/g, '').trim(),
        options: opts,
        answer,
        explanation: exp.join(' ').replace(/\*\*/g, '').trim()
      });
    }
    stem = []; opts = []; answer = null; exp = [];
  };
  for (const raw of lines) {
    if (!raw) continue;
    const opt = raw.match(/^(?:[-*]\s*)?\(?([A-E])[).:]\s+(.+)$/);
    const ans = raw.match(/^\**\s*(?:correct\s+answer|answer|correct)\s*\**\s*[:\-]?\s*\(?([A-E])\b/i);
    const expl = raw.match(/^\**\s*explanation\s*\**\s*[:\-]?\s*(.*)$/i);
    if (opt) { opts.push({ key: opt[1].toUpperCase(), text: opt[2].replace(/\*\*/g, '').trim() }); continue; }
    if (ans) { answer = ans[1].toUpperCase(); continue; }
    if (expl) { exp.push(expl[1]); continue; }
    if (opts.length) {
      if (answer || exp.length) { flush(); stem.push(raw); }
      else { exp.push(raw); }
    } else {
      stem.push(raw);
    }
  }
  flush();
  return questions.filter((q) => q.question);
}

function MCQCard({ q, index, onResult }) {
  const [picked, setPicked] = useState(null);
  const answered = picked !== null;
  const choose = (key) => {
    if (answered) return;
    setPicked(key);
    if (onResult) onResult(index, q.answer ? key === q.answer : null);
  };
  return (
    <div className={`mcq${answered ? ' answered' : ''}`}>
      <div className="mcq-q"><span className="mcq-num">{index + 1}</span><p><InlineText text={q.question} /></p></div>
      <div className="mcq-opts">
        {q.options.map((o) => {
          const isCorrect = q.answer && o.key === q.answer;
          const isPicked = o.key === picked;
          const cls = answered ? (isCorrect ? 'correct' : isPicked ? 'wrong' : 'dim') : '';
          return (
            <button key={o.key} type="button" className={`mcq-opt ${cls}`} onClick={() => choose(o.key)} disabled={answered}>
              <span className="mcq-key">{o.key}</span>
              <span className="mcq-text"><InlineText text={o.text} /></span>
              {answered && isCorrect && <CheckCircle2 size={16} className="mcq-ic ok" />}
              {answered && isPicked && !isCorrect && <XCircle size={16} className="mcq-ic no" />}
            </button>
          );
        })}
      </div>
      {answered && q.explanation && (
        <div className="mcq-exp"><strong>Why:</strong> <InlineText text={q.explanation} /></div>
      )}
    </div>
  );
}

function InteractiveQuiz({ questions }) {
  const [results, setResults] = useState({});
  const onResult = (i, ok) => setResults((r) => ({ ...r, [i]: ok }));
  const answered = Object.keys(results).length;
  const gradable = Object.values(results).filter((v) => v !== null).length;
  const correct = Object.values(results).filter((v) => v === true).length;
  return (
    <div className="quiz">
      <div className="quiz-head">
        <span><CircleHelp size={15} /> Quick quiz</span>
        <strong>{answered} of {questions.length} answered{gradable ? ` · ${correct}/${gradable} correct` : ''}</strong>
      </div>
      {questions.map((q, i) => <MCQCard key={i} q={q} index={i} onResult={onResult} />)}
    </div>
  );
}

// Quote flowchart node labels so special characters (/, &, commas, parentheses)
// do not break Mermaid's parser. id[label] -> id["label"]; same for () and {}.
function sanitizeMermaid(code) {
  return String(code)
    .replace(/\r/g, '')
    .replace(/([A-Za-z0-9_]+)\[([^\]\n]*)\]/g, (m, id, label) => {
      const clean = label.trim();
      return /^".*"$/.test(clean) ? `${id}[${clean}]` : `${id}["${clean.replace(/"/g, "'")}"]`;
    })
    .replace(/([A-Za-z0-9_]+)\(([^)\n]*)\)/g, (m, id, label) => {
      const clean = label.trim();
      return /^".*"$/.test(clean) ? `${id}(${clean})` : `${id}("${clean.replace(/"/g, "'")}")`;
    });
}

// Parse a flowchart's edges into readable parent -> child pairs, used as a
// fallback so a student never sees raw diagram code if Mermaid cannot render.
function mermaidToPairs(code) {
  const labels = {};
  const nodeRe = /([A-Za-z0-9_]+)\s*(?:\["?([^\]"]*)"?\]|\("?([^)"]*)"?\)|\{"?([^}"]*)"?\})/g;
  let m;
  while ((m = nodeRe.exec(code)) !== null) labels[m[1]] = (m[2] || m[3] || m[4] || m[1]).trim();
  const pairs = [];
  const edgeRe = /([A-Za-z0-9_]+)\s*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*[-.=]{1,2}->?\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/g;
  while ((m = edgeRe.exec(code)) !== null) {
    const from = labels[m[1]] || m[1];
    const to = labels[m[2]] || m[2];
    if (from && to && from !== to) pairs.push([from, to]);
  }
  return pairs;
}

function MermaidFallback({ code }) {
  const pairs = mermaidToPairs(code);
  if (!pairs.length) return null;
  return (
    <div className="mmd-fallback-map">
      {pairs.map(([from, to], index) => (
        <div className="mmd-edge" key={index}>
          <span>{from}</span>
          <ChevronRight size={14} />
          <span>{to}</span>
        </div>
      ))}
    </div>
  );
}

// Lazy Mermaid renderer for ```mermaid diagrams in the visual (Ask) mode.
// Mermaid loads only when a diagram actually appears on screen.
let mermaidPromise;
function MermaidBlock({ code }) {
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        mermaidPromise ??= import('mermaid').then((m) => {
          const mermaid = m.default;
          mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', flowchart: { useMaxWidth: true } });
          return mermaid;
        });
        const mermaid = await mermaidPromise;
        let out;
        try {
          const r = await mermaid.render('mmd-' + Math.random().toString(36).slice(2, 10), sanitizeMermaid(code));
          out = r.svg;
        } catch {
          const r = await mermaid.render('mmd-' + Math.random().toString(36).slice(2, 10), String(code).trim());
          out = r.svg;
        }
        if (alive) setSvg(out);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [code]);
  if (failed) return <MermaidFallback code={code} />;
  if (!svg) return <div className="mermaid-loading">Rendering diagram...</div>;
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Split raw answer text into ordered text / mermaid segments so a diagram
// renders as SVG while the surrounding prose and tables render normally.
function splitMermaid(text) {
  const segments = [];
  const re = /```mermaid\s*\n?([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: 'text', text: text.slice(last, match.index) });
    segments.push({ type: 'mermaid', code: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments;
}

// Render a plain text segment as flat blocks (used alongside mermaid diagrams).
function renderTextSegment(text, mode, keyPrefix) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return buildContentBlocks(lines).map((block, index) => <RenderBlock key={`${keyPrefix}-${index}`} block={block} mode={mode} />);
}

function ResponseContent({ text, mode }) {
  const [openSignal, setOpenSignal] = useState(null);

  // Only test-mode content becomes an interactive quiz. Explanations and
  // summaries that happen to contain lettered lists stay readable prose.
  const quiz = mode === 'test' ? parseQuizQuestions(text) : [];
  if (mode === 'test' && quiz.length >= 1) {
    return (
      <div className="answer-content test-answer">
        <InteractiveQuiz questions={quiz} />
      </div>
    );
  }

  // Visual answers with mermaid diagrams render segment by segment (diagram as
  // SVG, prose and tables as usual). No collapsible sections in this path.
  if (text.includes('```mermaid')) {
    return (
      <div className="answer-content">
        {splitMermaid(text).map((seg, index) => (
          seg.type === 'mermaid'
            ? <MermaidBlock key={`mmd-${index}`} code={seg.code} />
            : <React.Fragment key={`txt-${index}`}>{renderTextSegment(seg.text, mode, index)}</React.Fragment>
        ))}
      </div>
    );
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\d+\.?$/.test(lines[index]) && lines[index + 1]) {
      normalizedLines.push(`${lines[index].replace(/\.$/, '')}. ${lines[index + 1]}`);
      index += 1;
    } else {
      normalizedLines.push(lines[index]);
    }
  }

  if (!normalizedLines.length) return null;

  const blocks = buildContentBlocks(normalizedLines);
  const wrapClass = mode === 'test' ? 'answer-content test-answer' : 'answer-content';

  // Long, multi-section answers become collapsible sections so the student can
  // scan and dive in, instead of facing a wall of text. Short answers and oral
  // tests stay flat.
  const headingCount = blocks.filter((b) => b.type === 'line' && lineIsHeading(b.line, mode)).length;
  const useSections = mode !== 'test' && headingCount >= 2 && blocks.length > 12;

  if (!useSections) {
    return (
      <div className={wrapClass}>
        {blocks.map((block, index) => <RenderBlock key={index} block={block} mode={mode} />)}
      </div>
    );
  }

  const intro = [];
  const sections = [];
  let current = null;
  for (const block of blocks) {
    if (block.type === 'line' && lineIsHeading(block.line, mode)) {
      current = { title: block.line.replace(/^#{1,6}\s*/, '').replace(/:$/, ''), blocks: [] };
      sections.push(current);
    } else if (current) {
      current.blocks.push(block);
    } else {
      intro.push(block);
    }
  }

  const allOpen = openSignal?.open === true;
  return (
    <div className={wrapClass}>
      {intro.map((block, index) => <RenderBlock key={`intro-${index}`} block={block} mode={mode} />)}
      <div className="answer-expand-row">
        <button
          type="button"
          className="answer-expand-all"
          onClick={() => setOpenSignal({ open: !allOpen, n: (openSignal?.n || 0) + 1 })}
        >
          {allOpen ? 'Collapse all sections' : 'Expand all sections'}
        </button>
      </div>
      {sections.map((section, index) => (
        <AnswerSection key={`sec-${index}`} title={section.title} blocks={section.blocks} mode={mode} defaultOpen={index === 0} openSignal={openSignal} />
      ))}
    </div>
  );
}

// A small, curated set of starting points (kept short on purpose).
const commandActions = [
  { title: 'Study a topic', subtitle: 'Clear, layered explanations', icon: BookOpen, page: 'explanation', prompt: 'Teach this topic using the seven-level dental learning ladder.' },
  { title: 'Ask the tutor', subtitle: 'Answers from your source', icon: Brain, page: 'answer', prompt: 'Open the professor tutor for this subject.' },
  { title: 'Flashcards', subtitle: 'Review with spaced repetition', icon: BookmarkPlus, artifact: 'flashcards', prompt: 'Create source-grounded flashcards for this subject.' },
  { title: 'Practice exam', subtitle: 'Questions and weak spots', icon: FileQuestion, page: 'test', prompt: 'Start an oral exam on this subject.' }
];

const clinicTools = [
  { id: 'case', icon: Stethoscope, title: 'Clinical case', desc: 'A step-by-step patient scenario to reason through.', artifact: 'caseStudy', cta: 'Generate case', featured: true },
  { id: 'osce', icon: ClipboardList, title: 'OSCE station', desc: 'An exam station with a patient script and marking rubric.', artifact: 'osce', cta: 'Generate OSCE' },
  { id: 'checklist', icon: CheckCircle2, title: 'Exam checklist', desc: 'Observable signs, red flags, and how to present findings.', artifact: 'clinicalVisionChecklist', cta: 'Build checklist' },
  { id: 'rescue', icon: Brain, title: 'Rescue plan', desc: 'Targeted drills and a spaced review plan for weak spots.', artifact: 'adaptivePlan', cta: 'Create plan' }
];

const dentalSubjects = [
  'Dental Anatomy',
  'Endodontics',
  'Operative Dentistry',
  'Periodontology',
  'Oral Surgery',
  'Oral Pathology',
  'Radiology',
  'Prosthodontics',
  'Orthodontics',
  'Pharmacology'
];

const modeWorkflows = {
  answer: {
    title: 'Professor Q&A Desk',
    subtitle: 'Ask one focused question. The tutor should answer, find gaps, suggest related concepts, and flag common mistakes.',
    cards: [
      ['Ask precisely', 'Use a concrete topic, symptom, diagnosis, material, or procedure.'],
      ['Require evidence', 'Ask for source-grounded reasoning and citations when the source supports it.'],
      ['Close the loop', 'Request related concepts and exam traps after the answer.']
    ],
    prompt: 'Answer this like a dental professor: include the direct answer, source-grounded reasoning, knowledge gaps, related concepts, common mistakes, and exam pearls.',
    cta: 'Ask the professor',
    starters: ['What are the highest-yield facts in this source?', 'Explain the hardest concept here simply', 'What do students most often get wrong on this topic?']
  },
  summary: {
    title: 'Structured Study Builder',
    subtitle: 'Convert the source into high-yield notes, tables, clinical checklists, and active recall.',
    cards: [
      ['Core map', 'Build the topic hierarchy without deleting classifications or criteria.'],
      ['Tables', 'Use comparison tables for diseases, tests, materials, criteria, and protocols.'],
      ['Recall', 'End with active-recall prompts and a 60-second recap.']
    ],
    prompt: 'Create a structured dental study summary with tables, clinical relevance, exam traps, active recall, and a 60-second recap.',
    cta: 'Build the summary',
    starters: ['Summarize the whole source for an exam', 'Build a comparison table of the key conditions', 'Give me the 60-second recap']
  },
  explanation: {
    title: 'Seven-Level Explanation Lab',
    subtitle: 'Move from simple explanation to clinical reasoning without cutting important details.',
    cards: [
      ['Level 1-2', 'Plain explanation and dental student version.'],
      ['Level 3-4', 'Detailed textbook mechanism and clinical application.'],
      ['Level 5-7', 'Examiner answer, board review, and expert decision-making.']
    ],
    prompt: 'Explain this topic at levels 1 through 7: simple, student, detailed textbook, clinical application, examiner answer, board review, and expert clinical reasoning.',
    cta: 'Explain it to me',
    starters: ['Explain the main mechanism step by step', 'Give me a memory hook for this topic', 'Why does this matter clinically?']
  },
  test: {
    title: 'Examiner Simulation',
    subtitle: 'Practice oral exams, MCQs, OSCE tasks, grading rubrics, and remediation.',
    cards: [
      ['Oral exam', 'Ask sequential questions and wait for the student answer.'],
      ['Rubric', 'Grade with criteria, marks, feedback, and critical errors.'],
      ['Remediation', 'Generate targeted drills for weak points.']
    ],
    prompt: 'Start an examiner-style dental test with oral questions, a clinical vignette, a marking rubric table, critical errors, and adaptive remediation.',
    cta: 'Start the test',
    starters: ['Quiz me with 5 oral-exam questions', 'Give me one clinical vignette to solve', 'Test my weak spots from this source']
  }
};

const anatomyStructures = [
  {
    id: 'crown',
    label: 'Crown',
    tissue: 'Anatomical region',
    color: '#cfe9ff',
    anchor: [50, 17],
    detail: 'The enamel-covered part of the tooth that sits above the gingival margin and does the chewing. Its contour guides occlusion, contacts, and food deflection, and it is the most common site for caries, fractures, and restorations.',
    points: ['Enamel-covered functional surface above the gum', 'Shape controls occlusion, contacts, and embrasures', 'Primary site for caries, wear, and fractures'],
    related: ['Occlusion', 'Caries progression', 'Crown fractures']
  },
  {
    id: 'enamel',
    label: 'Enamel',
    tissue: 'Hardest tissue in the body',
    color: '#f2f6fb',
    anchor: [70, 22],
    detail: 'A ~96% mineral (hydroxyapatite) shell covering the crown. It is acellular and avascular, so it cannot regenerate. Early acid demineralization shows as a white-spot lesion and can be remineralized with fluoride before it cavitates.',
    points: ['~96% hydroxyapatite, hardest tissue in the body', 'Cannot regenerate once lost', 'Acid etching of the prism structure enables bonding'],
    related: ['White spot lesions', 'Fluoride', 'Etch and bond']
  },
  {
    id: 'dentin',
    label: 'Dentin',
    tissue: 'Living tubular tissue',
    color: '#f2d79a',
    anchor: [34, 40],
    detail: 'The living, ~70% mineralized tissue that forms the bulk of the tooth. Fluid-filled dentinal tubules connect to odontoblasts in the pulp, which is why exposed dentin is sensitive and can lay down reparative dentin in response to insult.',
    points: ['~70% mineral, forms the bulk of the tooth', 'Dentinal tubules transmit stimuli to the pulp', 'Odontoblasts can form reparative/tertiary dentin'],
    related: ['Pulp anatomy', 'Dentin hypersensitivity', 'Caries progression']
  },
  {
    id: 'pulp',
    label: 'Pulp Chamber',
    tissue: 'Neurovascular core',
    color: '#ff6f87',
    anchor: [50, 27],
    detail: 'The coronal neurovascular core holding odontoblasts, blood vessels, and nerves. Inflammation here (pulpitis) drives toothache; irreversible pulpitis with lingering pain is the classic indication for root canal treatment.',
    points: ['Houses odontoblasts, vessels, and nerves', 'Inflammation produces reversible or irreversible pulpitis', 'Access cavity must respect the chamber roof and horns'],
    related: ['Pulpitis', 'Endodontics', 'Pain diagnosis']
  },
  {
    id: 'root',
    label: 'Root Canal',
    tissue: 'Endodontic space',
    color: '#ff96a6',
    anchor: [50, 62],
    detail: 'The continuation of the pulp through the root to the apical foramen. Endodontic therapy cleans, shapes, and obturates this canal; missed canals and length control errors are leading causes of treatment failure.',
    points: ['Carries pulp tissue toward the apex', 'Accessory and curved canals are common', 'Length control protects the apical seal'],
    related: ['Working length', 'Irrigation', 'Obturation']
  },
  {
    id: 'cementum',
    label: 'Cementum',
    tissue: 'Mineralized root surface',
    color: '#d8b075',
    anchor: [66, 58],
    detail: 'A thin, bone-like mineralized layer covering the root dentin. It anchors the periodontal ligament fibers (Sharpey fibers) and becomes vulnerable to root caries when gingival recession exposes it.',
    points: ['Bone-like layer covering root dentin', 'Anchors Sharpey fibers of the PDL', 'Exposed surfaces are prone to root caries'],
    related: ['Root caries', 'Periodontium', 'Attachment loss']
  },
  {
    id: 'periodontal',
    label: 'Periodontal Ligament',
    tissue: 'Fibrous suspensory sling',
    color: '#46d6cc',
    anchor: [70, 70],
    detail: 'The fibrous, vascular ligament suspending the tooth in its socket. It absorbs occlusal load, supplies proprioception, and its radiographic widening can signal trauma, inflammation, or occlusal overload.',
    points: ['Suspends the tooth and absorbs occlusal forces', 'Provides proprioception during function', 'Radiographic widening flags trauma or overload'],
    related: ['Periapical lesions', 'Mobility', 'Periodontitis']
  },
  {
    id: 'apex',
    label: 'Apical Foramen',
    tissue: 'Neurovascular gateway',
    color: '#ffd166',
    anchor: [50, 92],
    detail: 'The opening at the root tip where vessels and nerves enter the pulp. It is the apical limit for endodontic instrumentation and the focus of periapical (peri-radicular) disease.',
    points: ['Entry point for pulpal vessels and nerves', 'Apical limit for instrumentation and obturation', 'Center of periapical pathology'],
    related: ['Apical periodontitis', 'Working length', 'Radiographic apex']
  }
];

// Inline, individually highlightable cross-section so each layer can light up,
// dim its neighbours, and stay anatomically legible. viewBox is 320 x 540.
const toothLayerPaths = {
  bone: 'M34 250 C34 232 48 224 70 224 L118 224 C112 260 110 330 120 392 C124 432 134 470 150 502 L70 502 C46 502 34 488 34 466 Z M286 250 C286 232 272 224 250 224 L202 224 C208 260 210 330 200 392 C196 432 186 470 170 502 L250 502 C274 502 286 488 286 466 Z',
  gingiva: 'M40 256 C40 228 62 216 98 216 C124 216 132 230 160 230 C188 230 196 216 222 216 C258 216 280 228 280 256 L280 276 C238 268 198 264 160 264 C122 264 82 268 40 276 Z',
  pdl: 'M124 226 C116 250 110 306 119 368 C125 430 142 480 160 514 C178 480 195 430 201 368 C210 306 204 250 196 226 Z',
  cementum: 'M129 228 C122 250 117 304 125 365 C131 426 147 476 160 508 C173 476 189 426 195 365 C203 304 198 250 191 228 Z',
  dentin: 'M188 232 C194 206 197 160 196 118 C194 82 180 58 160 56 C140 58 126 82 124 118 C123 160 126 206 132 232 C127 250 123 302 130 362 C135 422 148 472 160 502 C172 472 185 422 190 362 C197 302 193 250 188 232 Z',
  enamel: 'M160 44 C188 46 206 74 208 116 C209 160 204 206 196 234 L124 234 C116 206 111 160 112 116 C114 74 132 46 160 44 Z',
  pulp: 'M160 96 C149 98 144 120 144 152 C144 196 146 244 150 300 L170 300 C174 244 176 196 176 152 C176 120 171 98 160 96 Z',
  canal: 'M150 300 C152 360 156 420 160 470 C164 420 168 360 170 300 Z'
};

// Which painted shapes glow when a structure is selected.
const toothHighlightFor = {
  crown: ['enamel'],
  enamel: ['enamel'],
  dentin: ['dentin'],
  pulp: ['pulp'],
  root: ['canal'],
  cementum: ['cementum'],
  periodontal: ['pdl'],
  apex: ['apex']
};

const topicTabs = [
  { id: 'overview', label: 'Overview', body: 'Generate the core definition, boundaries of the topic, prerequisite concepts, and the minimum facts a dental student must not miss.' },
  { id: 'pathogenesis', label: 'Pathogenesis', body: 'Explain mechanisms step by step while preserving classifications, diagnostic criteria, and cause-effect relationships from the source.' },
  { id: 'clinical', label: 'Clinical Features', body: 'Organize symptoms, signs, chairside findings, radiographic signs, and red flags into scannable tables and checklists.' },
  { id: 'diagnosis', label: 'Diagnosis', body: 'Build a diagnostic reasoning pathway with tests, interpretation limits, differential diagnoses, and common false assumptions.' },
  { id: 'treatment', label: 'Treatment', body: 'Create educational treatment protocols with indications, contraindications, instruments, materials, errors, complications, and follow-up.' },
  { id: 'pearls', label: 'Exam Pearls', body: 'Extract examiner-friendly answers, board traps, common mistakes, and concise high-yield recall prompts.' }
];

const explanationLevels = ['Simple', 'Student', 'Textbook', 'Clinical', 'Examiner', 'Board', 'Expert'];

// Interactive anatomical cross-section. Each tissue is its own SVG path so the
// selected layer glows, neighbours dim, and clicking a layer drives the lesson.
function InteractiveTooth({ selected, onSelect }) {
  const active = toothHighlightFor[selected] || [];
  const dimming = active.length > 0;
  const structure = anatomyStructures.find((item) => item.id === selected) || anatomyStructures[0];
  const layerClass = (name) =>
    `tooth-layer tooth-${name}${active.includes(name) ? ' is-active' : dimming ? ' is-dim' : ''}`;
  const apexActive = selected === 'apex';

  return (
    <div className="tooth-stage interactive">
      <span className="tooth-callout">
        <em style={{ background: structure.color }} />
        {structure.label}
      </span>
      <div className="tooth-frame">
        <svg viewBox="0 0 320 540" className="tooth-svg" role="img" aria-label={`Tooth cross-section highlighting ${structure.label}`}>
          <defs>
            <radialGradient id="toothGlow" cx="50%" cy="32%" r="60%">
              <stop offset="0%" stopColor={structure.color} stopOpacity="0.55" />
              <stop offset="62%" stopColor={structure.color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="320" height="540" fill="url(#toothGlow)" />
          <path className={layerClass('bone')} d={toothLayerPaths.bone} />
          <path className={layerClass('gingiva')} d={toothLayerPaths.gingiva} />
          <path className={layerClass('pdl')} d={toothLayerPaths.pdl} onClick={() => onSelect('periodontal')} />
          <path className={layerClass('cementum')} d={toothLayerPaths.cementum} onClick={() => onSelect('cementum')} />
          <path className={layerClass('dentin')} d={toothLayerPaths.dentin} onClick={() => onSelect('dentin')} />
          <path className={layerClass('enamel')} d={toothLayerPaths.enamel} onClick={() => onSelect('enamel')} />
          <path className={layerClass('pulp')} d={toothLayerPaths.pulp} onClick={() => onSelect('pulp')} />
          <path className={layerClass('canal')} d={toothLayerPaths.canal} onClick={() => onSelect('root')} />
          <circle
            className={`tooth-layer tooth-apex${apexActive ? ' is-active' : dimming ? ' is-dim' : ''}`}
            cx="160"
            cy="510"
            r="9"
            onClick={() => onSelect('apex')}
          />
        </svg>
      </div>
    </div>
  );
}

const howToSteps = [
  { icon: Upload, title: 'Add your material', text: 'Open Notes & Books, then upload a PDF or paste your lecture notes. You can keep several sources.' },
  { icon: Library, title: 'Pick what to study', text: 'Each source keeps its own tutor chat, flashcards, and notes. Switch the active source anytime in Notes & Books.' },
  { icon: Sparkles, title: 'Study your way', text: 'Ask the AI Tutor, generate a Summary, make Flashcards, or take an Exam. Everything comes from your active source.' },
  { icon: BookmarkPlus, title: 'Review and remember', text: 'Grade your flashcards. Cards you find hard come back sooner, tracked on the Progress page.' }
];

function HowToUse({ navigate, compact = false }) {
  return (
    <article className={compact ? 'how-to compact glass-panel' : 'how-to glass-panel'}>
      <div className="how-to-head">
        <div>
          <strong>How to use Simav Dental Tutor</strong>
          <span>A grounded study tool: it only answers from the material you add, so it will not invent facts.</span>
        </div>
      </div>
      <ol className="how-to-steps">
        {howToSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <span className="how-to-num">{index + 1}</span>
              <span className="how-to-ic"><Icon size={18} /></span>
              <span className="how-to-body">
                <strong>{step.title}</strong>
                <small>{step.text}</small>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="how-to-foot">
        <p>Tip: turn on the Study buddy in the sidebar to ask questions by voice.</p>
        <button type="button" className="primary-chip" onClick={() => navigate('library')}>
          <Upload size={16} /> Add your first source
        </button>
      </div>
    </article>
  );
}

// A clear, ordered path so a student always knows the next step. Every "done"
// state is derived from real per-source activity, so it ticks off as they work.
function StudyPath({ steps, stats }) {
  const total = steps.length;
  const doneCount = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);
  return (
    <article className="study-path glass-panel">
      <div className="study-path-head">
        <div>
          <strong>Your study path</strong>
          <span>Work through these steps to learn this source well.</span>
        </div>
        <span className="study-path-count">{doneCount} of {total}</span>
      </div>
      <div className="study-path-progress"><i style={{ width: `${Math.round((doneCount / total) * 100)}%` }} /></div>
      <ol className="study-path-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={`study-path-step${step.done ? ' is-done' : ''}${index === nextIndex ? ' is-next' : ''}`}>
            <span className="sp-num">{step.done ? <CheckCircle2 size={16} /> : index + 1}</span>
            <span className="sp-body">
              <strong>{step.label}</strong>
              {index === nextIndex && <em>Next step</em>}
            </span>
            <button type="button" className="sp-action" onClick={step.onAction} disabled={step.disabled}>{step.actionLabel}</button>
          </li>
        ))}
      </ol>
      {stats && (
        <div className="study-path-stats">
          <span><strong>{stats.total}</strong> flashcards</span>
          <span><strong>{stats.reviewed}</strong> reviewed</span>
          <span><strong>{stats.due}</strong> to review</span>
        </div>
      )}
    </article>
  );
}

function ModeWorkspace({ page, studySet, busy, submitStudy, createArtifact, navigate }) {
  const workflow = modeWorkflows[page];
  if (!workflow) return null;

  return (
    <section className={`mode-workspace mode-${page}`}>
      <div className="mode-workspace-hero">
        <div>
          <p>{page.toUpperCase()}</p>
          <h3>{workflow.title}</h3>
          <span>{workflow.subtitle}</span>
        </div>
        <button type="button" className="primary-chip" onClick={() => submitStudy(workflow.prompt)} disabled={!studySet || !!busy}>
          {workflow.cta}
        </button>
      </div>
      {!studySet ? (
        <div className="engines-need-source">
          <span>Add a study source first, then this works from your own material.</span>
          <button type="button" onClick={() => navigate('library')}>Add a source</button>
        </div>
      ) : workflow.starters ? (
        <div className="mode-starters">
          <span className="mode-starters-label">Or try a question</span>
          <div className="mode-starter-chips">
            {workflow.starters.map((starter) => (
              <button key={starter} type="button" onClick={() => submitStudy(starter)} disabled={!!busy}>
                {starter}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function parseLatestMcq(chat = []) {
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    const item = chat[index];
    if (item?.role !== 'assistant' || !/question|mcq|choice|answer|exam/i.test(item.text || '')) continue;
    const lines = String(item.text || '').split('\n').map((line) => stripMarkdown(line).trim()).filter(Boolean);
    const options = [];
    let question = '';
    lines.forEach((line) => {
      const option = line.match(/^(?:[-*]\s*)?([A-D])[\).:-]\s+(.+)/i);
      if (option) {
        options.push({ key: option[1].toUpperCase(), text: option[2] });
        return;
      }
      if (!question && (line.endsWith('?') || /which of the following|best answer|most accurate|diagnos/i.test(line))) {
        question = line.replace(/^Question\s*\d*[:.-]\s*/i, '');
      }
    });
    if (question && options.length >= 2) return { question, options };
  }
  return null;
}

function CommandCenterDashboard({ user, studyStats, flashcards, chat, studySet, busy, navigate, createArtifact, submitStudy, startSummary, startQuiz }) {
  const [selectedStructure, setSelectedStructure] = useState('dentin');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [learningLevel, setLearningLevel] = useState(4);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedIntent, setSelectedIntent] = useState('');
  const [activeCaseStep, setActiveCaseStep] = useState(0);
  const [activeXrayStep, setActiveXrayStep] = useState(2);
  const [activeTreatmentStep, setActiveTreatmentStep] = useState(0);
  const [selectedMcq, setSelectedMcq] = useState('');
  const [previewCardRevealed, setPreviewCardRevealed] = useState(false);
  const structure = anatomyStructures.find((item) => item.id === selectedStructure) ?? anatomyStructures[0];
  const topicTab = topicTabs.find((item) => item.id === selectedTab) ?? topicTabs[0];
  const firstName = (user?.name || 'Ahmed').split(' ')[0] || 'Ahmed';
  const hasSource = !!studySet?.vectorStoreId;
  const sourceName = studySet?.files?.map((file) => file.originalName).join(', ') || '';
  const previewCard = flashcards[0];
  const caseSteps = ['Patient Info', 'Examination', 'Radiographs', 'Diagnosis', 'Treatment Plan'];
  const xraySteps = ['Image Quality', 'Anatomy', 'Pathology', 'Hard Tissues', 'Periodontal Status', 'Final Impression'];
  const treatmentSteps = ['Indications', 'Armamentarium', 'Sequence', 'Errors', 'Complications', 'Follow-up'];
  const mcqData = parseLatestMcq(chat);
  const focusSubject = selectedSubject || 'the full active source';
  const caseStageCopy = [
    ['Set the case frame', 'Generate a source-grounded patient profile only after choosing a focus. Include age, complaint, history, risk factors, and what the student must clarify.'],
    ['Collect findings', 'Ask for examination findings, special tests, periodontal charting, vitality tests, occlusion, and red flags relevant to the focus.'],
    ['Request imaging', 'Decide which image is educationally appropriate, then interpret observable signs without autonomous diagnosis.'],
    ['Reason safely', 'Build a differential diagnosis table with distinguishing clinical, radiographic, and histologic features where relevant.'],
    ['Plan and debrief', 'Create an educational treatment plan with indications, contraindications, materials, errors, complications, prognosis, and follow-up.']
  ];
  const activityMetrics = [
    { label: 'Questions asked', value: studyStats.questions },
    { label: 'Answers', value: studyStats.answers },
    { label: 'Flashcards', value: studyStats.total },
    { label: 'Due to review', value: studyStats.dueCards.length }
  ];
  const hasActivity = activityMetrics.some((metric) => metric.value > 0);

  function runAction(action) {
    if (!hasSource) { navigate('library'); return; }
    if (action.page) { navigate(action.page); return; }
    if (action.artifact) createArtifact(action.artifact);
  }

  const summaryDone = chat.some((item) => item.role === 'assistant' && item.mode === 'summary');
  const testDone = chat.some((item) => item.role === 'assistant' && item.mode === 'test');
  const steps = [
    { label: 'Add your material', done: hasSource, actionLabel: hasSource ? 'Added' : 'Add source', onAction: () => navigate('library'), disabled: hasSource },
    { label: 'Read a summary', done: summaryDone, actionLabel: 'Summarize', onAction: startSummary, disabled: !hasSource || !!busy },
    { label: 'Make flashcards', done: flashcards.length > 0, actionLabel: 'Make cards', onAction: () => createArtifact('flashcards'), disabled: !hasSource || !!busy },
    { label: 'Review your cards', done: studyStats.reviewed > 0, actionLabel: 'Review', onAction: () => navigate('mastery'), disabled: !flashcards.length },
    { label: 'Test yourself', done: testDone, actionLabel: 'Quiz me', onAction: startQuiz, disabled: !hasSource || !!busy }
  ];

  return (
    <section className="command-center" aria-label="Home">
      {hasSource && (
        <div className="command-topbar">
          <label className="command-search">
            <Search size={17} />
            <input
              placeholder="Ask a quick question, then press Enter"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                  submitStudy(`Teach me about ${event.currentTarget.value.trim()} with exam pearls, clinical relevance, and common mistakes.`);
                  event.currentTarget.value = '';
                  navigate('learn');
                }
              }}
            />
          </label>
          {studyStats.dueCards.length > 0 && (
            <button type="button" className="topbar-due" onClick={() => navigate('mastery')}>
              <Bell size={16} />
              {studyStats.dueCards.length} due
            </button>
          )}
        </div>
      )}

      <div className="command-greeting">
        <div>
          <h2>Welcome back, {firstName}.</h2>
          <p>{hasSource ? `Studying ${sourceName}. Follow your study path below.` : 'Add a study source to begin.'}</p>
        </div>
        <button type="button" onClick={() => navigate(hasSource ? 'learn' : 'library')}>
          <Sparkles size={17} />
          {hasSource ? 'Open Learn' : 'Add study source'}
        </button>
      </div>

      {!hasSource && <HowToUse navigate={navigate} />}

      {hasSource && (
        <StudyPath
          steps={steps}
          stats={{ total: studyStats.total, reviewed: studyStats.reviewed, due: studyStats.dueCards.length }}
        />
      )}
    </section>
  );
}

const MAX_CHAT = 200;
const EMPTY_CHAT = [];
const EMPTY_CARDS = [];

function App() {
  const [files, setFiles] = useState([]);
  const [sources, setSources] = useState([]);
  const [activeSourceId, setActiveSourceId] = useState(null);
  const [sourceData, setSourceData] = useState({});
  const [mode, setMode] = useState('answer');
  const [page, setPage] = useState('dashboard');
  const [practiceTab, setPracticeTab] = useState('flashcards');
  const [radTab, setRadTab] = useState('cases');
  const [lastPracticeKind, setLastPracticeKind] = useState('');
  const [radCaseId, setRadCaseId] = useState(null);
  const [selectedEngine, setSelectedEngine] = useState('knowledgeGap');
  const [message, setMessage] = useState('');
  const [textSourceTitle, setTextSourceTitle] = useState('');
  const [textSource, setTextSource] = useState('');
  const [learning, setLearning] = useState({ reviews: {}, confidence: {}, milestones: [] });
  const [revealedCards, setRevealedCards] = useState({});
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [voicePersona, setVoicePersona] = useState('peer');
  const [theme, setTheme] = useState('dark');
  const [auth, setAuth] = useState({ status: 'loading', user: null });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [conversationMode, setConversationMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Ready');
  const [authBusy, setAuthBusy] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const speechControllerRef = useRef(null);
  const speechUrlRef = useRef('');
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const buddyActiveRef = useRef(false);
  const speechItemRef = useRef('');
  const busyRef = useRef('');
  const tutorSpeakingRef = useRef(false);
  const pauseRecognitionRef = useRef(false);
  const restartTimerRef = useRef(null);
  const lastTutorSpeechRef = useRef('');
  const speechWatchdogRef = useRef(null);
  const activeKeyRef = useRef('unassigned');

  // Each source keeps its own chat, flashcards, and notes. The derived
  // studySet keeps the many existing consumers of the old single-set shape
  // working without edits.
  const activeSource = useMemo(() => sources.find((source) => source.id === activeSourceId) || null, [sources, activeSourceId]);
  const studySet = useMemo(
    () => (activeSource ? { vectorStoreId: activeSource.vectorStoreId, files: activeSource.files || [] } : null),
    [activeSource]
  );
  const activeData = sourceData[activeSourceId || 'unassigned'];
  const chat = activeData?.chat || EMPTY_CHAT;
  const flashcards = activeData?.flashcards || EMPTY_CARDS;
  const notes = activeData?.notes || '';

  useEffect(() => {
    activeKeyRef.current = activeSourceId || 'unassigned';
  }, [activeSourceId]);

  function applyActiveSourceId(id) {
    activeKeyRef.current = id || 'unassigned';
    setActiveSourceId(id || null);
  }

  function updateSourceData(key, field, next, transform) {
    setSourceData((data) => {
      const current = data[key] || emptySourceData();
      const raw = typeof next === 'function' ? next(current[field]) : next;
      return { ...data, [key]: { ...current, [field]: transform ? transform(raw) : raw } };
    });
  }

  const sliceChat = (value) => (Array.isArray(value) ? value.slice(-MAX_CHAT) : []);
  const sliceCards = (value) => (Array.isArray(value) ? value.slice(0, 300) : []);
  const asNotes = (value) => String(value || '');

  // Writes to whichever source is active right now. For async handlers that
  // span an await, bind to the source captured at call time instead (see
  // sourceWriters) so a result never lands in a source the student switched to
  // mid-generation.
  const setChat = (next) => updateSourceData(activeKeyRef.current, 'chat', next, sliceChat);
  const setFlashcards = (next) => updateSourceData(activeKeyRef.current, 'flashcards', next, sliceCards);
  const setNotes = (next) => updateSourceData(activeKeyRef.current, 'notes', next, asNotes);

  function sourceWriters(key) {
    return {
      setChat: (next) => updateSourceData(key, 'chat', next, sliceChat),
      setFlashcards: (next) => updateSourceData(key, 'flashcards', next, sliceCards),
      setNotes: (next) => updateSourceData(key, 'notes', next, asNotes)
    };
  }

  const fileNames = useMemo(() => studySet?.files?.map((file) => file.originalName).join(', '), [studySet]);
  const sourceKind = useMemo(() => {
    if (!studySet?.files?.length) return 'material';
    const hasPdf = studySet.files.some((file) => file.sourceType !== 'text');
    const hasText = studySet.files.some((file) => file.sourceType === 'text');
    if (hasPdf && hasText) return 'sources';
    return hasText ? 'text source' : 'PDF';
  }, [studySet]);
  const sourceCountLabel = useMemo(() => {
    if (!studySet?.files?.length) return 'No source';
    if (sourceKind === 'sources') return `${studySet.files.length} sources`;
    return `${studySet.files.length} ${sourceKind}${studySet.files.length > 1 ? 's' : ''}`;
  }, [sourceKind, studySet]);
  const activePage = pages.find((item) => item.id === page) ?? pages[0];
  const selectedEngineObj = dentalosEngines.find((engine) => engine.id === selectedEngine) ?? dentalosEngines[0];
  const visibleChat = useMemo(() => {
    if (!modes.some((item) => item.id === page)) return [];
    return chat.filter((item) => item.mode === page || (page === 'answer' && !item.mode));
  }, [chat, page]);
  const progress = useMemo(() => {
    const answers = chat.filter((item) => item.role === 'assistant').length;
    const questions = chat.filter((item) => item.role === 'user').length;
    return { answers, questions, cards: flashcards.length };
  }, [chat, flashcards.length]);
  // Honest study stats from real actions only: sources, flashcards, spaced
  // repetition reviews, and questions asked. No invented mastery percentages.
  const studyStats = useMemo(() => {
    const now = Date.now();
    const newCards = [];
    const dueScheduled = [];
    let reviewed = 0;
    for (const card of flashcards) {
      const review = learning.reviews?.[card.id];
      if (review) reviewed += 1;
      if (!review?.dueAt) newCards.push(card);
      else if (new Date(review.dueAt).getTime() <= now) dueScheduled.push(card);
    }
    // Scheduled cards first (they are overdue), then new cards to learn.
    const dueCards = [...dueScheduled, ...newCards];
    const questions = chat.filter((item) => item.role === 'user').length;
    const answers = chat.filter((item) => item.role === 'assistant').length;
    return { dueCards, newCount: newCards.length, dueCount: dueScheduled.length, reviewed, total: flashcards.length, questions, answers };
  }, [flashcards, learning, chat]);
  const reviewedCount = studyStats.reviewed;
  const activeCard = flashcards[Math.min(activeCardIndex, Math.max(0, flashcards.length - 1))];
  const activeCardReview = activeCard ? learning.reviews?.[activeCard.id] : null;

  useEffect(() => {
    if (activeCardIndex >= flashcards.length) {
      setActiveCardIndex(Math.max(0, flashcards.length - 1));
    }
  }, [activeCardIndex, flashcards.length]);

  // Switching source switches to that source's own deck and chat.
  useEffect(() => {
    setActiveCardIndex(0);
    setRevealedCards({});
  }, [activeSourceId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Not signed in');
        return response.json();
      })
      .then((data) => setAuth({ status: 'authenticated', user: data.user }))
      .catch(() => setAuth({ status: 'guest', user: null }));
  }, []);

  function applyStudyState(saved = {}) {
    let nextSources = Array.isArray(saved.sources) ? saved.sources : [];
    let nextActiveId = saved.activeSourceId || null;
    let nextData = saved.sourceData && typeof saved.sourceData === 'object' ? saved.sourceData : {};

    // Legacy local copy from before multi-source support: wrap the single
    // study set the same way the server does. The next server load replaces
    // this with canonical ids.
    if (!nextSources.length && saved.studySet?.vectorStoreId) {
      const legacyId = 'legacy-local';
      nextSources = [{
        id: legacyId,
        title: saved.studySet.files?.[0]?.originalName || 'My study set',
        sourceType: 'pdf',
        vectorStoreId: saved.studySet.vectorStoreId,
        files: saved.studySet.files || [],
        textChars: 0,
        createdAt: saved.updatedAt || new Date().toISOString()
      }];
      nextActiveId = legacyId;
      nextData = {
        [legacyId]: {
          chat: Array.isArray(saved.chat) ? saved.chat : [],
          flashcards: Array.isArray(saved.flashcards) ? saved.flashcards : [],
          notes: typeof saved.notes === 'string' ? saved.notes : ''
        }
      };
    }

    setSources(nextSources);
    applyActiveSourceId(nextSources.some((source) => source.id === nextActiveId) ? nextActiveId : nextSources[0]?.id || null);
    setSourceData(nextData);
    setLearning(saved.learning && typeof saved.learning === 'object' ? saved.learning : { reviews: {}, confidence: {}, milestones: [] });
    setVoicePersona(saved.voicePersona || 'peer');
    setPage(saved.page || 'dashboard');
    setMode(modes.some((item) => item.id === saved.page) ? saved.page : 'answer');
  }

  useEffect(() => {
    if (!auth.user?.id) return;
    let cancelled = false;

    async function loadSession() {
      setSessionLoaded(false);
      try {
        const response = await fetch(`${API_BASE}/session`, { credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your study session.');
        const localState = JSON.parse(localStorage.getItem(stateKeyForUser(auth.user.id)) || '{}');
        if (!cancelled) {
          applyStudyState(data.studyState || localState);
          setSessionLoaded(true);
        }
      } catch (sessionError) {
        if (!cancelled) {
          setError(sessionError.message);
          setSessionLoaded(true);
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [auth.user?.id]);

  useEffect(() => {
    if (!auth.user?.id || !sessionLoaded) return;

    // The server owns sources and the active source; the client only persists
    // its per-source study data plus preferences. localStorage keeps a full
    // copy so an offline reload still shows the library.
    const body = { sourceData, page, voicePersona, learning };
    const localCopy = { sources, activeSourceId, ...body };
    try {
      localStorage.setItem(stateKeyForUser(auth.user.id), JSON.stringify(localCopy));
    } catch {
      // Storage is full: retry with trimmed chats, then give up quietly.
      try {
        const slimData = Object.fromEntries(
          Object.entries(sourceData).map(([key, value]) => [key, { ...value, chat: (value.chat || []).slice(-40) }])
        );
        localStorage.setItem(stateKeyForUser(auth.user.id), JSON.stringify({ ...localCopy, sourceData: slimData }));
      } catch {
        try { localStorage.removeItem(stateKeyForUser(auth.user.id)); } catch { /* unavailable */ }
      }
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${API_BASE}/session`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      }).catch(() => {});
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [auth.user?.id, sessionLoaded, sources, activeSourceId, sourceData, page, voicePersona, learning]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat, busy]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    return () => {
      stopSpeech(false);
      stopStudyBuddy();
      recorderRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    buddyActiveRef.current = conversationMode;
    if (conversationMode) {
      startStudyBuddy();
    } else {
      stopStudyBuddy();
    }
  }, [conversationMode, studySet?.vectorStoreId]);

  function stopSpeech(resumeBuddy = true) {
    window.clearTimeout(speechWatchdogRef.current);
    speechControllerRef.current?.abort();
    speechControllerRef.current = null;
    window.speechSynthesis?.cancel();
    speechItemRef.current = '';
    tutorSpeakingRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (speechUrlRef.current) {
      URL.revokeObjectURL(speechUrlRef.current);
      speechUrlRef.current = '';
    }

    setSpeakingId(null);
    pauseRecognitionRef.current = false;
    if (resumeBuddy && conversationMode && studySet?.vectorStoreId && !busyRef.current) {
      setVoiceStatus('Always listening');
      restartTimerRef.current = window.setTimeout(() => startStudyBuddy(), 800);
    } else {
      setVoiceStatus(conversationMode ? 'Paused' : 'Ready');
    }
  }

  function isStopPhrase(text) {
    const normalized = text.toLowerCase().replace(/[^\w\s']/g, '').trim();
    return stopPhrases.some((phrase) => normalized === phrase || normalized.includes(phrase));
  }

  function looksLikeTutorEcho(transcript) {
    const spokenWords = new Set(
      lastTutorSpeechRef.current
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 4)
    );
    const transcriptWords = transcript
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);

    if (transcriptWords.length < 5 || !spokenWords.size) return false;
    const overlap = transcriptWords.filter((word) => spokenWords.has(word)).length / transcriptWords.length;
    return overlap > 0.58;
  }

  function getRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  }

  function startStudyBuddy() {
    if (!studySet?.vectorStoreId || recognitionRef.current || tutorSpeakingRef.current || busyRef.current) return;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setVoiceStatus('Use mic button');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setRecording(true);
      setVoiceStatus('Always listening');
    };

    recognition.onresult = async (event) => {
      if (tutorSpeakingRef.current || speechItemRef.current) return;
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript?.trim();
      if (!transcript) return;
      if (looksLikeTutorEcho(transcript)) return;

      if (isStopPhrase(transcript)) {
        stopSpeech();
        setVoiceStatus('Listening');
        return;
      }

      if (busyRef.current) return;
      if (handleVoiceCommand(transcript)) return;
      await submitStudy(transcript, { speak: true, fromBuddy: true });
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setVoiceStatus('Mic blocked');
        setConversationMode(false);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (pauseRecognitionRef.current) {
        return;
      }
      if (buddyActiveRef.current && studySet?.vectorStoreId && !tutorSpeakingRef.current && !busyRef.current) {
        restartTimerRef.current = window.setTimeout(() => startStudyBuddy(), 450);
      } else {
        setRecording(false);
        setVoiceStatus('Ready');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Recognition was already running or in a bad state; retry shortly.
      recognitionRef.current = null;
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => startStudyBuddy(), 800);
    }
  }

  function stopStudyBuddy() {
    buddyActiveRef.current = false;
    pauseRecognitionRef.current = false;
    window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    if (!speakingId) setVoiceStatus('Ready');
  }

  function pauseStudyBuddyForTutor() {
    pauseRecognitionRef.current = true;
    window.clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
  }

  function resumeStudyBuddyAfterTutor() {
    tutorSpeakingRef.current = false;
    pauseRecognitionRef.current = false;
    setSpeakingId(null);
    if (conversationMode && studySet?.vectorStoreId) {
      setVoiceStatus('Always listening');
      restartTimerRef.current = window.setTimeout(() => startStudyBuddy(), 800);
    } else {
      setVoiceStatus('Ready');
    }
  }

  function navigate(nextPage) {
    stopSpeech(false);
    setPage(nextPage);
    if (modes.some((item) => item.id === nextPage)) setMode(nextPage);
    setError('');
  }

  function handleVoiceCommand(transcript) {
    const normalized = transcript.toLowerCase();
    if (!normalized.includes('tutor') && !normalized.startsWith('summarize') && !normalized.startsWith('start')) {
      return false;
    }

    if (normalized.includes('open library') || normalized.includes('go to library')) {
      navigate('library');
      return true;
    }
    if (normalized.includes('study kit') || normalized.includes('flashcards')) {
      navigate('practice');
      setPracticeTab('flashcards');
      return true;
    }
    if (normalized.includes('summarize')) {
      navigate('learn');
      submitStudy('Summarize this study source for a dental exam.', { speak: true, mode: 'summary' });
      return true;
    }
    if (normalized.includes('case study') || normalized.includes('vignette')) {
      createArtifact('caseStudy');
      return true;
    }
    if (normalized.includes('mnemonic')) {
      createArtifact('mnemonics');
      return true;
    }
    if (normalized.includes('quiz') || normalized.includes('test me')) {
      navigate('practice');
      setPracticeTab('quiz');
      submitStudy('Start a 5-minute oral quiz on the highest-yield material in this study source.', { speak: true, mode: 'test' });
      return true;
    }
    return false;
  }

  function parseFlashcards(text) {
    const cards = [];
    // Markdown table format: | question | answer |
    const rows = text.split('\n').map((l) => l.trim()).filter((l) => /^\|.*\|$/.test(l));
    for (const line of rows) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if (cells.length < 2) continue;
      if (/^[-:\s]+$/.test(cells[0]) || /^(question|front|term|q|card)$/i.test(cells[0])) continue;
      const q = stripMarkdown(cells[0]);
      const a = stripMarkdown(cells.slice(1).join(' '));
      if (q && a) cards.push({ id: makeId(), question: q, answer: a });
    }
    if (cards.length) return cards;
    const blocks = text.split(/\n\s*\n/);
    for (const block of blocks) {
      const q = block.match(/(?:Q|Question)\s*\d*\s*[:.-]\s*(.+)/i)?.[1]?.trim();
      const a = block.match(/(?:A|Answer)\s*\d*\s*[:.-]\s*([\s\S]+)/i)?.[1]?.trim();
      if (q && a) {
        cards.push({ id: makeId(), question: stripMarkdown(q), answer: stripMarkdown(a) });
      }
    }
    return cards;
  }

  function downloadFile(filename, content, type = 'text/markdown') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    const body = [
      '# Simav Dental Tutor Session',
      '',
      `Sources: ${fileNames || 'No active source'}`,
      '',
      '## Notes',
      notes || 'No saved notes yet.',
      '',
      '## Flashcards',
      ...flashcards.map((card, index) => `${index + 1}. Q: ${card.question}\n   A: ${card.answer}`),
      '',
      '## Conversation',
      ...chat.map((item) => `### ${item.role === 'assistant' ? 'Tutor' : 'Student'}\n${stripMarkdown(item.text)}`)
    ].join('\n');
    downloadFile('simav-dental-study-session.md', body);
  }

  function exportAnki() {
    // Anki fields must stay on one TSV line; it renders <br> inside a field.
    const cell = (value) => String(value || '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
    const rows = flashcards.map((card) => `${cell(card.question)}\t${cell(card.answer)}`);
    downloadFile('dental-flashcards.tsv', rows.join('\n'), 'text/tab-separated-values');
  }

  async function clearSession() {
    if (sources.length && !window.confirm('Remove every source, chat, and flashcard deck? This cannot be undone.')) return;
    stopSpeech(false);
    stopStudyBuddy();
    setSources([]);
    applyActiveSourceId(null);
    setSourceData({});
    setLearning({ reviews: {}, confidence: {}, milestones: [] });
    setFiles([]);
    setMessage('');
    setError('');
    setRevealedCards({});
    setActiveCardIndex(0);
    setPage('dashboard');
    setMode('answer');
    if (auth.user?.id) {
      localStorage.removeItem(stateKeyForUser(auth.user.id));
      await fetch(`${API_BASE}/session`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    }
  }

  // Clear the conversation and generated notes for a fresh start, while keeping
  // the uploaded source and saved flashcards. Lets a student wipe what they have
  // finished without losing their material.
  function clearConversation() {
    if (!chat.length && !notes) return;
    if (!window.confirm('Clear the conversation and generated notes? Your source and saved flashcards stay.')) return;
    stopSpeech(false);
    setChat([]);
    setNotes('');
    setMessage('');
    setError('');
  }

  function deleteMessage(id) {
    setChat((items) => items.filter((m) => m.id !== id));
  }

  function applySourceListResponse(data) {
    const nextSources = Array.isArray(data.sources) ? data.sources : [];
    setSources(nextSources);
    applyActiveSourceId(nextSources.some((source) => source.id === data.activeSourceId) ? data.activeSourceId : nextSources[0]?.id || null);
    setSourceData((current) => {
      const validKeys = new Set([...nextSources.map((source) => source.id), 'unassigned']);
      return Object.fromEntries(Object.entries(current).filter(([key]) => validKeys.has(key)));
    });
    if (!nextSources.length) setPage('library');
  }

  async function activateSource(sourceId) {
    if (!sourceId || sourceId === activeSourceId) return;
    stopSpeech(false);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/source/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not switch the source.');
      applySourceListResponse(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteWholeSource(sourceId) {
    if (!window.confirm('Remove this source and everything saved with it, including its chat and flashcards?')) return;
    setError('');
    try {
      const response = await fetch(`${API_BASE}/source/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove the source.');
      applySourceListResponse(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSource(fileId) {
    if (!studySet?.vectorStoreId) return;
    if (!window.confirm('Remove this file from the source?')) return;
    setError('');
    try {
      const response = await fetch(`${API_BASE}/source/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectorStoreId: studySet.vectorStoreId, fileId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove the source.');
      applySourceListResponse(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleCard(cardId) {
    setRevealedCards((items) => ({ ...items, [cardId]: !items[cardId] }));
  }

  function removeCard(cardId) {
    const next = flashcards.filter((card) => card.id !== cardId);
    setFlashcards(next);
    setActiveCardIndex((index) => Math.max(0, Math.min(index, next.length - 1)));
    setLearning((state) => {
      const reviews = { ...(state.reviews || {}) };
      delete reviews[cardId];
      return { ...state, reviews };
    });
  }

  function reviewCard(cardId, grade) {
    const days = spacedIntervals[grade] ?? spacedIntervals.good;
    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    setLearning((state) => ({
      ...state,
      reviews: {
        ...(state.reviews || {}),
        [cardId]: {
          grade,
          reviewedAt: new Date().toISOString(),
          dueAt,
          streak: grade === 'again' ? 0 : ((state.reviews?.[cardId]?.streak || 0) + 1)
        }
      }
    }));
    setRevealedCards((items) => ({ ...items, [cardId]: true }));
    setActiveCardIndex((index) => (flashcards.length ? (index + 1) % flashcards.length : 0));
  }

  function bumpUsage(field, amount = 1) {
    setAuth((current) => {
      if (!current.user) return current;
      const usage = current.user.usage || { aiCalls: 0, uploads: 0, dailyAiBudget: 120 };
      return {
        ...current,
        user: {
          ...current.user,
          usage: {
            ...usage,
            [field]: Number(usage[field] || 0) + amount
          }
        }
      };
    });
  }

  async function uploadSelectedPdfs(selectedFiles) {
    const pdfs = Array.from(selectedFiles || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) {
      setError('Please choose at least one PDF file.');
      return;
    }

    busyRef.current = 'upload';
    setBusy('upload');
    setError('');
    const body = new FormData();
    pdfs.forEach((file) => body.append('pdfs', file));

    try {
      const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body, credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'PDF upload failed');
      const addedTitle = (Array.isArray(data.sources) && data.sources.find((source) => source.id === data.activeSourceId)?.title) || pdfs[0].name;
      applySourceListResponse(data);
      setPage('dashboard');
      setMode('answer');
      setChat([
        {
          role: 'assistant',
          text: `Added ${addedTitle} to your library and made it the active source. Ask a question, request a summary, or switch to Test mode for an oral exam.`,
          mode: 'answer',
          id: makeId()
        }
      ]);
      setVoiceStatus('PDF ready');
      bumpUsage('uploads', pdfs.length);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      busyRef.current = '';
      setBusy('');
      setDragActive(false);
    }
  }

  async function indexTextSource(event) {
    event.preventDefault();
    if (textSource.trim().length < 80) {
      setError('Paste at least a short paragraph of dental study material.');
      return;
    }

    busyRef.current = 'upload';
    setBusy('upload');
    setError('');

    try {
      const response = await fetch(`${API_BASE}/text-source`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: textSourceTitle || 'Pasted dental study notes',
          text: textSource
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Text indexing failed');
      const addedTitle = (Array.isArray(data.sources) && data.sources.find((source) => source.id === data.activeSourceId)?.title) || textSourceTitle || 'your pasted notes';
      applySourceListResponse(data);
      setTextSourceTitle('');
      setTextSource('');
      setPage('dashboard');
      setMode('answer');
      setChat([
        {
          role: 'assistant',
          text: `Added ${addedTitle} to your library and made it the active source. Ask questions, generate a summary, or start an OSCE-style drill.`,
          mode: 'answer',
          id: makeId()
        }
      ]);
      setVoiceStatus('Text ready');
      bumpUsage('uploads');
    } catch (sourceError) {
      setError(sourceError.message);
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  }

  function handleDashboardDrop(event) {
    event.preventDefault();
    setDragActive(false);
    uploadSelectedPdfs(event.dataTransfer.files);
  }

  async function createArtifact(type, source = '') {
    if (!studySet?.vectorStoreId) return;

    // Bind writes to the source generated from, not whichever is active when
    // the (slow) call returns.
    const key = activeSourceId || 'unassigned';
    const writer = sourceWriters(key);
    const cardsAtCall = flashcards;
    stopSpeech(false);
    busyRef.current = 'artifact';
    setBusy('artifact');
    setError('');

    try {
      const response = await fetch(`${API_BASE}/artifact`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: activeSourceId,
          type,
          source,
          history: chat.slice(-8).map(({ role, text }) => ({ role, text })),
          persona: voicePersona,
          existingQuestions: type === 'flashcards' ? flashcards.map((card) => card.question).slice(0, 120) : undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Artifact request failed');
      bumpUsage('aiCalls');

      if (type === 'flashcards') {
        const parsed = Array.isArray(data.cards)
          ? data.cards
              .filter((card) => card?.question && card?.answer)
              .map((card) => ({ id: makeId(), question: stripMarkdown(card.question), answer: stripMarkdown(card.answer) }))
          : parseFlashcards(data.text);
        // Drop any card whose question already exists, so asking for more never
        // shows the student duplicates even if the model repeats itself.
        const seen = new Set(cardsAtCall.map((card) => card.question.toLowerCase().trim()));
        const cards = parsed.filter((card) => {
          const q = card.question.toLowerCase().trim();
          if (seen.has(q)) return false;
          seen.add(q);
          return true;
        });
        writer.setFlashcards((items) => [...cards, ...items]);
        setActiveCardIndex(0);
        setRevealedCards({});
        setPage('practice');
        setPracticeTab('flashcards');
        const skipped = parsed.length - cards.length;
        writer.setChat((items) => [
          ...items,
          {
            role: 'assistant',
            text: cards.length
              ? `Added ${cards.length} new flashcard${cards.length > 1 ? 's' : ''} to your deck${skipped ? `, and skipped ${skipped} that repeated cards you already have.` : '.'}`
              : parsed.length
                ? 'Those all matched flashcards you already have. Try a different part of the source, or add another source.'
                : 'I could not format those as flashcards. Tap Make cards to try again.',
            mode: 'summary',
            id: makeId()
          }
        ]);
        return;
      }

      const testArtifacts = ['weakQuiz', 'caseStudy', 'osce', 'examinerQuestions', 'clinicalCase'];
      const kitArtifacts = ['notes', 'adaptivePlan', 'curriculumMap', 'clinicalVisionChecklist', 'mnemonics', 'memoryPlan'];
      const visualArtifacts = ['visualLearning', 'differentialDiagnosis', 'treatmentProtocol', 'radiologyChecklist', 'knowledgeGap', 'conceptMap'];
      // The mode tag decides which Learn view the result appears in: quizzes/cases
      // go to Practice, visual aids to Learn > Ask, reading aids to Learn > Summarize.
      let landingMode;
      if (testArtifacts.includes(type)) {
        const kind = (type === 'examinerQuestions' || type === 'weakQuiz') ? 'quiz' : 'cases';
        landingMode = 'test';
        setMode('test');
        setPracticeTab(kind);
        setLastPracticeKind(kind);
        setPage('practice');
      } else if (visualArtifacts.includes(type)) {
        landingMode = 'answer';
        setMode('answer');
        setPage('learn');
      } else {
        if (kitArtifacts.includes(type)) writer.setNotes(data.text);
        landingMode = 'summary';
        setMode('summary');
        setPage('learn');
      }

      writer.setChat((items) => [...items, { role: 'assistant', text: data.text, mode: landingMode, id: makeId() }]);
    } catch (artifactError) {
      setError(artifactError.message);
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  }

  async function uploadPdfs(event) {
    event.preventDefault();
    uploadSelectedPdfs(files);
  }

  async function submitStudy(customMessage = message, options = {}) {
    const trimmed = customMessage.trim();
    if (!studySet?.vectorStoreId || !trimmed) return;

    // The caller can pin the mode for this one message (used by the Learn
    // intent bar, the Home study path, and the Practice quiz) so it does not
    // depend on the async `mode` state landing first.
    const effMode = options.mode || mode;
    // Bind writes to the source the student is asking about, so switching
    // source mid-answer never routes the reply to the wrong deck/chat.
    const key = activeSourceId || 'unassigned';
    const writer = sourceWriters(key);
    stopSpeech(false);
    busyRef.current = 'study';
    setBusy('study');
    setError('');
    setMessage('');
    const userItem = { role: 'user', text: trimmed, mode: effMode, id: makeId() };
    const history = chat.slice(-8).map(({ role, text }) => ({ role, text }));
    writer.setChat((items) => [...items, userItem]);

    try {
      const response = await fetch(`${API_BASE}/study`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: activeSourceId,
          message: trimmed,
          mode: effMode,
          history,
          persona: voicePersona
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Study request failed');
      bumpUsage('aiCalls');
      const assistantItem = { role: 'assistant', text: data.text, mode: effMode, id: makeId() };
      writer.setChat((items) => [...items, assistantItem]);
      if (conversationMode || options.speak) {
        await speak(assistantItem, { force: true });
      }
    } catch (studyError) {
      setError(studyError.message);
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  }

  // Study-path / cross-page shortcuts that pin the mode for the request.
  function startSummary() {
    setMode('summary');
    navigate('learn');
    submitStudy(modeWorkflows.summary.prompt, { mode: 'summary' });
  }

  function startQuiz() {
    setMode('test');
    setPracticeTab('quiz');
    setLastPracticeKind('quiz');
    navigate('practice');
    submitStudy(modeWorkflows.test.prompt, { mode: 'test' });
  }

  async function startRecording() {
    setError('');
    stopSpeech(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await transcribe(blob);
      };

      recorder.start();
      setRecording(true);
      setVoiceStatus('Listening');
    } catch (recordError) {
      setError(recordError.message || 'Microphone permission was not available.');
      setVoiceStatus('Mic blocked');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    setVoiceStatus('Thinking');
  }

  async function transcribe(blob) {
    const key = activeSourceId || 'unassigned';
    const writer = sourceWriters(key);
    busyRef.current = 'voice';
    setBusy('voice');
    const body = new FormData();
    body.append('audio', blob, 'student-question.webm');

    try {
      const response = await fetch(`${API_BASE}/transcribe`, { method: 'POST', body, credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      bumpUsage('aiCalls');
      if (!data.text?.trim()) {
        setVoiceStatus('Ready');
        return;
      }
      if (isStopPhrase(data.text)) {
        stopSpeech();
        writer.setChat((items) => [
          ...items,
          { role: 'user', text: data.text, mode, id: makeId() },
          { role: 'assistant', text: 'Paused. Ask me for the next explanation, summary, or quiz when you are ready.', mode, id: makeId() }
        ]);
        return;
      }
      setMessage(data.text);
      await submitStudy(data.text, { speak: true });
    } catch (voiceError) {
      setError(voiceError.message);
      setVoiceStatus('Voice error');
    } finally {
      busyRef.current = '';
      setBusy('');
    }
  }

  async function speak(item, options = {}) {
    if (speakingId === item.id && !options.force) {
      stopSpeech();
      return;
    }

    stopSpeech(false);
    pauseStudyBuddyForTutor();
    tutorSpeakingRef.current = true;
    setSpeakingId(item.id);
    setVoiceStatus('Preparing voice');
    setError('');
    speechItemRef.current = item.id;
    lastTutorSpeechRef.current = clipSpokenText(item.text);
    const controller = new AbortController();
    speechControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/speak`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lastTutorSpeechRef.current,
          voice: voicePersonas.find((persona) => persona.id === voicePersona)?.voice || 'cedar',
          persona: voicePersona
        }),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Speech failed');
      bumpUsage('aiCalls');

      const audio = new Audio(`${API_BASE.replace(/\/api$/, '')}${data.audioUrl}`);
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.oncanplay = () => setVoiceStatus('Speaking');
      audio.onended = () => {
        if (speechItemRef.current === item.id) {
          window.clearTimeout(speechWatchdogRef.current);
          speechItemRef.current = '';
          resumeStudyBuddyAfterTutor();
        }
      };
      const failSpeech = () => {
        if (speechItemRef.current === item.id) {
          window.clearTimeout(speechWatchdogRef.current);
          speechItemRef.current = '';
          tutorSpeakingRef.current = false;
          pauseRecognitionRef.current = false;
          setVoiceStatus('Voice error');
          setSpeakingId(null);
          if (buddyActiveRef.current) resumeStudyBuddyAfterTutor();
        }
      };
      audio.onerror = failSpeech;
      audio.onabort = failSpeech;
      await audio.play();

      // Watchdog: if the audio stalls and never fires ended or error, force
      // the voice state back to Ready so buttons never stay stuck.
      const spokenWords = lastTutorSpeechRef.current.split(/\s+/).length;
      window.clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = window.setTimeout(() => {
        if (speechItemRef.current === item.id) stopSpeech();
      }, Math.min(120000, 15000 + spokenWords * 450));
    } catch (speechError) {
      if (speechError.name !== 'AbortError') {
        setError(speechError.message);
        setVoiceStatus('Voice error');
      }
      tutorSpeakingRef.current = false;
      setSpeakingId(null);
      if (conversationMode) resumeStudyBuddyAfterTutor();
    } finally {
      if (speechControllerRef.current === controller) {
        speechControllerRef.current = null;
      }
    }
  }

  function quickPrompt() {
    const prompts = {
      summary: 'Summarize the uploaded chapter for a dental exam.',
      explanation: 'Explain the most important concept in this source with clinical relevance.',
      test: 'Quiz me orally on the uploaded material.',
      answer: 'What are the highest-yield facts I should know from this source?'
    };
    setMessage(prompts[mode]);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError('');
    const endpoint = authMode === 'signup' ? 'signup' : 'login';

    try {
      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not sign in.');
      setAuth({ status: 'authenticated', user: data.user });
      setAuthForm({ name: '', email: '', password: '' });
      setSessionLoaded(false);
    } catch (loginError) {
      setAuthError(loginError.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    stopSpeech(false);
    stopStudyBuddy();
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    if (auth.user?.id) localStorage.removeItem(stateKeyForUser(auth.user.id));
    applyStudyState({});
    setFiles([]);
    setMessage('');
    setError('');
    setSessionLoaded(false);
    setAuth({ status: 'guest', user: null });
  }

  const ActivePageIcon = activePage.icon;

  // Shared transcript renderer (Learn shows the whole conversation; legacy mode
  // pages and Practice tabs pass a filtered slice).
  function renderMessages(list) {
    return list.map((item) => (
      <article key={item.id} className={`message ${item.role}`}>
        {item.role === 'assistant' ? <ResponseContent text={item.text} mode={item.mode} /> : <p>{item.text}</p>}
        <div className="message-actions">
          {item.role === 'assistant' && (
            <>
              <button type="button" className="listen" onClick={() => speak(item)}>
                {speakingId === item.id ? <Pause size={16} /> : <Volume2 size={16} />}
                {speakingId === item.id ? 'Stop' : 'Listen'}
              </button>
              <button type="button" className="listen" onClick={() => createArtifact('flashcards', item.text)} disabled={!!busy}>
                <BookmarkPlus size={16} />
                Cards
              </button>
            </>
          )}
          <button type="button" className="listen msg-del" onClick={() => deleteMessage(item.id)} title="Delete this message">
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </article>
    ));
  }

  const showComposer = page === 'learn' || page === 'practice' || modes.some((m) => m.id === page);

  if (auth.status === 'loading') {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <div className="brand-mark">
            <GraduationCap size={24} />
          </div>
          <h1>Simav Dental Tutor</h1>
          <p>Preparing your study workspace</p>
          <Loader2 className="spin" size={22} />
        </section>
      </main>
    );
  }

  if (!auth.user) {
    return (
      <main className="app-shell auth-shell">
        <button
          type="button"
          className="ghost-button theme-toggle auth-theme"
          onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <div className="auth-split">
          <aside className="auth-aside">
            <div className="auth-brand">
              <div className="brand-mark"><GraduationCap size={22} /></div>
              <div>
                <strong>DentalOS AI</strong>
                <span>Simav Dental Tutor</span>
              </div>
            </div>
            <h1 className="auth-headline">Study from your own notes, and actually remember them.</h1>
            <p className="auth-sub">Upload your lectures and turn them into summaries, flashcards, quizzes, clinical cases, and X-ray practice. Every answer is grounded in your material.</p>
            <ul className="auth-benefits">
              <li><span className="auth-bic"><BookOpen size={18} /></span><div><strong>Grounded in your source</strong><span>Answers come from the PDFs and notes you upload, not the open internet.</span></div></li>
              <li><span className="auth-bic"><BookmarkPlus size={18} /></span><div><strong>Active recall, built in</strong><span>Flashcards with spaced repetition and interactive quizzes that grade you.</span></div></li>
              <li><span className="auth-bic"><Activity size={18} /></span><div><strong>Radiology practice</strong><span>Read, measure, and interpret X-rays with instant AI feedback.</span></div></li>
            </ul>
          </aside>

          <section className="auth-card">
            <div className="auth-card-head">
              <h2>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
              <p>{authMode === 'signup' ? 'Set up your private workspace in under a minute.' : 'Sign in to pick up where you left off.'}</p>
            </div>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'signup' && (
                <label>
                  Name
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((form) => ({ ...form, password: event.target.value }))}
                  placeholder={authMode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
              {authError && <div className="error auth-error">{authError}</div>}
              <button type="submit" className="auth-submit" disabled={authBusy}>
                {authBusy ? <Loader2 className="spin" size={18} /> : authMode === 'signup' ? <UserPlus size={18} /> : <Sparkles size={18} />}
                {authMode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
            <p className="auth-switch-line">
              {authMode === 'signup' ? 'Already have an account?' : 'New to DentalOS?'}
              <button type="button" className="auth-switch" onClick={() => { setAuthMode((value) => (value === 'signup' ? 'login' : 'signup')); setAuthError(''); }}>
                {authMode === 'signup' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
            <p className="auth-fineprint">Educational study tool. Your uploads stay in your private account.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="study-panel">
          <div className="brand-row">
            <div className="brand-mark">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1>DentalOS AI</h1>
              <p>Learn. Understand. Master.</p>
            </div>
          </div>

          <div className="account-strip">
            <span>Signed in</span>
            <strong>{auth.user.name}</strong>
          </div>

          <div className="account-strip usage-strip">
            <span>Daily AI budget</span>
            <strong>{auth.user.usage?.aiCalls || 0}/{auth.user.usage?.dailyAiBudget || 120} calls</strong>
          </div>

          {sources.length > 0 && (
            <button type="button" className="source-strip source-strip-btn" onClick={() => navigate('library')} title={fileNames}>
              <span>Active source</span>
              <strong>{activeSource?.title || 'None selected'}</strong>
              <small>{sources.length} source{sources.length > 1 ? 's' : ''} · manage in Library</small>
            </button>
          )}

          <button
            type="button"
            className={conversationMode ? 'voice-card active' : 'voice-card'}
            onClick={() => setConversationMode((value) => !value)}
            disabled={!studySet}
          >
            <Headphones size={19} />
            <span className="voice-orb" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span>
              <strong>Study buddy</strong>
              <small>{conversationMode ? 'Always listening' : 'Tap to activate'}</small>
            </span>
            <em>{voiceStatus}</em>
          </button>

          <div className="persona-control">
            <label htmlFor="persona">Voice persona</label>
            <select id="persona" value={voicePersona} onChange={(event) => setVoicePersona(event.target.value)}>
              {voicePersonas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label}
                </option>
              ))}
            </select>
          </div>

          <nav className="mode-group" aria-label="Study pages">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <React.Fragment key={`${item.label}-${item.page}`}>
                  {item.section === 'clinical' && <div className="nav-divider" aria-hidden="true" />}
                  <button
                    className={page === item.page ? 'active' : ''}
                    type="button"
                    onClick={() => navigate(item.page)}
                    title={item.label}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {sources.length > 0 && (
            <div className="study-snapshot" aria-label="Study snapshot">
              <div className="study-snapshot-head">
                <Sparkles size={16} />
                <strong>Study snapshot</strong>
              </div>
              <div className="snapshot-row"><span>Flashcards</span><strong>{studyStats.total}</strong></div>
              <div className="snapshot-row"><span>Reviewed</span><strong>{reviewedCount}</strong></div>
              <div className="snapshot-row"><span>Due now</span><strong>{studyStats.dueCards.length}</strong></div>
              {studyStats.dueCards.length > 0 && (
                <button type="button" className="snapshot-cta" onClick={() => navigate('mastery')}>Review due cards</button>
              )}
            </div>
          )}
        </aside>

        <section className={page === 'dashboard' ? 'chat-panel command-mode' : 'chat-panel'}>
          {page !== 'dashboard' && <div className="chat-header">
            <div>
              <p>{activePage?.label.toUpperCase()}</p>
              <h2>{studySet ? fileNames : 'Waiting for study material'}</h2>
            </div>
            <div className="header-actions">
              {speakingId && (
                <button type="button" className="stop-button" onClick={stopSpeech}>
                  <Square size={16} />
                  Stop
                </button>
              )}
              <button
                type="button"
                className="ghost-button theme-toggle"
                onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
                title="Toggle dark mode"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button type="button" className="ghost-button" onClick={quickPrompt} disabled={!studySet}>
                <Sparkles size={18} />
                Prompt
              </button>
              {(chat.length > 0 || notes) && (
                <button type="button" className="ghost-button clear-button" onClick={clearConversation} title="Clear the conversation and notes">
                  <Trash2 size={18} />
                  Clear
                </button>
              )}
              <button type="button" className="ghost-button" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>}

          {page !== 'dashboard' && !RAD_PAGES.includes(page) && <section className="page-intro">
            <div className="page-icon">
              <ActivePageIcon size={20} />
            </div>
            <div>
              <h2>{activePage.label}</h2>
              <p>{activePage.prompt}</p>
            </div>
          </section>}

          <div className="messages">
            {page === 'dashboard' ? (
              <section className="dashboard-page">
                <CommandCenterDashboard
                  user={auth.user}
                  studyStats={studyStats}
                  flashcards={flashcards}
                  chat={chat}
                  studySet={studySet}
                  busy={busy}
                  navigate={navigate}
                  createArtifact={createArtifact}
                  submitStudy={submitStudy}
                  startSummary={startSummary}
                  startQuiz={startQuiz}
                />
                {!studySet && (
                  <div
                    className={dragActive ? 'dashboard-drop active' : 'dashboard-drop'}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDashboardDrop}
                  >
                    <Upload size={34} />
                    <h3>Drop a dental PDF here</h3>
                    <p>Upload a lecture, textbook chapter, handout, or review sheet, or open Library to paste text.</p>
                    <label htmlFor="dashboard-pdfs">Choose PDFs</label>
                    <input
                      id="dashboard-pdfs"
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={(event) => uploadSelectedPdfs(event.target.files)}
                    />
                  </div>
                )}
              </section>
            ) : page === 'library' ? (
              <section className="library-page">
                <div className="library-hero">
                  <div>
                    <p>Source Library</p>
                    <h3>{sources.length ? 'Keep several sources and pick one to study' : 'Add the material you want to study from'}</h3>
                    <span>
                      {sources.length
                        ? 'Each source keeps its own chat, flashcards, and notes. Everything is grounded in the source you make active.'
                        : 'Upload lecture PDFs or paste notes, rubrics, and protocols. The tutor only answers from what you add here.'}
                    </span>
                  </div>
                  {sources.length > 0 && (
                    <button type="button" className="danger-action" onClick={clearSession}>Clear everything</button>
                  )}
                </div>

                <div className="library-intake">
                  <form
                    className={dragActive ? 'upload-zone library-upload drag' : 'upload-zone library-upload'}
                    onSubmit={uploadPdfs}
                    onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => { event.preventDefault(); setDragActive(false); uploadSelectedPdfs(event.dataTransfer.files); }}
                  >
                    <div className="upload-icon"><Upload size={24} /></div>
                    <label htmlFor="pdfs">Drop dental PDFs here, or browse</label>
                    <p className="upload-hint">Lectures, textbook chapters, handouts, review sheets. Up to 8 files.</p>
                    <input
                      id="pdfs"
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={(event) => setFiles(Array.from(event.target.files || []))}
                    />
                    {files.length > 0 && (
                      <p className="upload-selected">{files.length} file{files.length > 1 ? 's' : ''} ready: {files.map((file) => file.name).join(', ')}</p>
                    )}
                    <button type="submit" disabled={!files.length || busy === 'upload'}>
                      {busy === 'upload' ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                      Index {files.length || ''} PDF{files.length > 1 ? 's' : ''}
                    </button>
                  </form>

                  <form className="upload-zone text-source-zone" onSubmit={indexTextSource}>
                    <div className="upload-icon"><FileText size={24} /></div>
                    <label htmlFor="text-source">Paste study text</label>
                    <input
                      id="text-source-title"
                      value={textSourceTitle}
                      onChange={(event) => setTextSourceTitle(event.target.value)}
                      placeholder="Title, e.g. Caries prevention lecture"
                    />
                    <textarea
                      id="text-source"
                      rows={6}
                      value={textSource}
                      onChange={(event) => setTextSource(event.target.value)}
                      placeholder="Paste lecture notes, a rubric, a professor handout, or a clinic protocol..."
                    />
                    <div className="textarea-meta">
                      <span>{textSource.trim().length} characters</span>
                      <span className={textSource.trim().length >= 80 ? 'ok' : ''}>min 80</span>
                    </div>
                    <button type="submit" disabled={textSource.trim().length < 80 || busy === 'upload'}>
                      {busy === 'upload' ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                      Index text
                    </button>
                  </form>
                </div>

                <div className="kit-section">
                  <div className="section-title">
                    <Library size={18} />
                    <h3>Your sources</h3>
                    <span className="source-count-tag">{sources.length} of 10</span>
                  </div>
                  {sources.length ? (
                    <div className="source-list">
                      {sources.map((source) => (
                        <article key={source.id} className={source.id === activeSourceId ? 'source-card active' : 'source-card'}>
                          <div className="source-card-row">
                            <button type="button" className="source-main" onClick={() => activateSource(source.id)} title="Study from this source">
                              <span className="source-radio" aria-hidden="true"></span>
                              <span className="source-info">
                                <strong>{source.title}</strong>
                                <small>
                                  {source.sourceType === 'text' ? 'Pasted text' : `PDF · ${source.files?.length || 0} file${(source.files?.length || 0) > 1 ? 's' : ''}`}
                                  {source.textChars ? ` · ${Math.max(1, Math.round(source.textChars / 1000))}k characters` : ''}
                                </small>
                              </span>
                              {source.id === activeSourceId && <em className="source-active-tag">Active</em>}
                            </button>
                            <button type="button" className="file-del" onClick={() => deleteWholeSource(source.id)} title="Remove this source" aria-label="Remove this source">
                              <Trash2 size={15} />
                            </button>
                          </div>
                          {source.sourceType !== 'text' && (source.files?.length || 0) > 1 && source.id === activeSourceId && (
                            <div className="file-list source-files">
                              {source.files.map((file) => (
                                <div key={file.fileId} className="file-row">
                                  <span className="file-ic"><FileText size={17} /></span>
                                  <span className="file-name">{file.originalName}</span>
                                  <span className="file-badge pdf">PDF</span>
                                  <button type="button" className="file-del" onClick={() => deleteSource(file.fileId)} title="Remove this file" aria-label="Remove this file">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Upload PDFs or paste text to add your first source.</p>
                  )}
                </div>

                {studySet && (
                  <div className="kit-section">
                    <div className="section-title">
                      <Sparkles size={18} />
                      <h3>What would you like to do next?</h3>
                    </div>
                    <div className="next-grid">
                      <button type="button" onClick={() => navigate('summary')}>
                        <BookOpen size={20} /><strong>Summary</strong><small>High-yield recap</small>
                      </button>
                      <button type="button" onClick={() => createArtifact('flashcards')} disabled={!!busy}>
                        <BookmarkPlus size={20} /><strong>Flashcards</strong><small>Active recall</small>
                      </button>
                      <button type="button" onClick={() => navigate('test')}>
                        <FileQuestion size={20} /><strong>Oral test</strong><small>Examiner mode</small>
                      </button>
                      <button type="button" onClick={() => navigate('engines')}>
                        <Brain size={20} /><strong>Engines</strong><small>Specialized tools</small>
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : page === 'mastery' ? (
              <section className="mastery-page">
                <div className="engines-hero-bar">
                  <p>Progress</p>
                  <h3>Your study activity for {activeSource ? activeSource.title : 'this source'}</h3>
                  <small>These numbers come from what you actually do: questions asked, flashcards made, and cards reviewed.</small>
                </div>
                {!studySet && (
                  <div className="engines-need-source">
                    <span>Add a study source and build some flashcards to start tracking your progress.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                )}
                <div className="stat-tiles wide">
                  <div className="stat-tile"><strong>{studyStats.total}</strong><span>Flashcards made</span></div>
                  <div className="stat-tile"><strong>{studyStats.newCount}</strong><span>New, not studied yet</span></div>
                  <div className="stat-tile"><strong>{studyStats.reviewed}</strong><span>Cards studied</span></div>
                  <div className="stat-tile"><strong>{studyStats.dueCount}</strong><span>Due for another look</span></div>
                </div>
                <div className="kit-section">
                  <div className="section-title">
                    <BookmarkPlus size={18} />
                    <h3>Cards to study now</h3>
                  </div>
                  <p className="review-note">
                    New cards are ready to study right away, that is why they appear here. Once you grade a card it comes back on a spaced schedule: Again shows it soon, Easy pushes it days out. {studyStats.newCount} new and {studyStats.dueCount} due for another look.
                  </p>
                  {studyStats.dueCards.length ? (
                    <div className="review-list">
                      {studyStats.dueCards.slice(0, 12).map((card) => {
                        const isNew = !learning.reviews?.[card.id];
                        return (
                          <article key={card.id}>
                            <div className="review-head">
                              <em className={isNew ? 'review-badge new' : 'review-badge due'}>{isNew ? 'New' : 'Due'}</em>
                              <strong>{card.question}</strong>
                            </div>
                            <span>{card.answer}</span>
                            <div className="review-grade">
                              <button type="button" className="grade-again" onClick={() => reviewCard(card.id, 'again')}>Again</button>
                              <button type="button" className="grade-hard" onClick={() => reviewCard(card.id, 'hard')}>Hard</button>
                              <button type="button" className="grade-good" onClick={() => reviewCard(card.id, 'good')}>Good</button>
                              <button type="button" className="grade-easy" onClick={() => reviewCard(card.id, 'easy')}>Easy</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">Nothing to study right now. {studyStats.total ? 'Nice work, come back when cards are due.' : 'Make some flashcards to start a review schedule.'}</p>
                  )}
                  {studySet && (
                    <button type="button" className="kit-inline-cta" onClick={() => createArtifact('flashcards')} disabled={!!busy}>
                      <BookmarkPlus size={16} /> Make more flashcards
                    </button>
                  )}
                </div>
              </section>
            ) : page === 'engines' ? (
              <section className="engines-page">
                <div className="engines-hero-bar">
                  <p>Study tools</p>
                  <h3>Pick how you want to study this source.</h3>
                </div>
                {!studySet ? (
                  <div className="engines-need-source">
                    <span>Add a study source first so these tools can work from your material.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                ) : (
                  <div className="study-picker">
                    <label htmlFor="study-way">Way of study</label>
                    <div className="study-picker-row">
                      <select id="study-way" value={selectedEngine} onChange={(event) => setSelectedEngine(event.target.value)}>
                        {engineGroups.map((group) => (
                          <optgroup key={group.key} label={group.key}>
                            {dentalosEngines.filter((engine) => engine.group === group.key).map((engine) => (
                              <option key={engine.id} value={engine.id}>{engine.title}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <button type="button" className="primary-chip" onClick={() => createArtifact(selectedEngine)} disabled={!studySet || !!busy}>
                        {busy === 'artifact' ? <><Loader2 size={16} className="spin" /> Generating…</> : <><Sparkles size={16} /> Generate {selectedEngineObj.produces.toLowerCase()}</>}
                      </button>
                    </div>
                    <p className="study-picker-desc">{selectedEngineObj.copy}</p>
                  </div>
                )}
                <p className="safety-note">
                  <ShieldCheck size={14} />
                  Educational support only, grounded in your source. Answers can be wrong, so verify against your material.
                </p>
              </section>
            ) : page === 'clinic' ? (
              <section className="clinic-page">
                <div className="engines-hero-bar">
                  <p>Clinical cases</p>
                  <h3>Practice with patient scenarios from your notes.</h3>
                  <small>Pick a format below. Each one is built only from the source you uploaded.</small>
                </div>
                {!studySet && (
                  <div className="engines-need-source">
                    <span>Add a study source first so these can be built from your material.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                )}
                <div className="clinic-grid">
                  {clinicTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <article key={tool.id} className={`clinic-card${tool.featured ? ' featured' : ''}`}>
                        <span className="clinic-ic"><Icon size={20} /></span>
                        <div className="clinic-card-body">
                          <strong>{tool.title}</strong>
                          <span>{tool.desc}</span>
                        </div>
                        <button type="button" className="clinic-go" onClick={() => createArtifact(tool.artifact)} disabled={!studySet || !!busy}>
                          {busy === 'artifact' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                          {tool.cta}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : page === 'kit' ? (
              <section className="kit-page">
                <div className="kit-toolbar">
                  <div className="kit-make">
                    <button type="button" onClick={() => createArtifact('notes')} disabled={!studySet || !!busy}>
                      <FileText size={17} />
                      Make notes
                    </button>
                    <button type="button" onClick={() => createArtifact('flashcards')} disabled={!studySet || !!busy}>
                      <BookmarkPlus size={17} />
                      Make cards
                    </button>
                    <button type="button" className="kit-link" onClick={() => navigate('engines')}>
                      More study tools
                    </button>
                  </div>
                  <div className="kit-export">
                    <button type="button" onClick={exportMarkdown} disabled={!chat.length && !notes && !flashcards.length}>
                      <Download size={16} />
                      Markdown
                    </button>
                    <button type="button" onClick={exportAnki} disabled={!flashcards.length}>
                      <Download size={16} />
                      Anki
                    </button>
                    <button type="button" className="danger-action" onClick={clearSession}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="kit-section">
                  <div className="section-title">
                    <FileText size={18} />
                    <h3>Study Notes</h3>
                  </div>
                  {notes ? <ResponseContent text={notes} mode="summary" /> : <p className="muted">No notes yet. Generate notes from the Study Kit or quick actions.</p>}
                </div>

                <div className="kit-section">
                  <div className="section-title">
                    <BookmarkPlus size={18} />
                    <h3>Flashcards</h3>
                  </div>
                  {flashcards.length ? (
                    <div className="flash-study">
                      <article className="flash-trainer">
                        <div className="flash-trainer-top">
                          <span>Card {activeCardIndex + 1} of {flashcards.length}</span>
                          <strong>{studyStats.dueCards.length} due now</strong>
                        </div>
                        <div
                          className={revealedCards[activeCard.id] ? 'flip-card is-flipped' : 'flip-card'}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleCard(activeCard.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleCard(activeCard.id);
                            } else if (event.key === 'ArrowRight') {
                              event.preventDefault();
                              setActiveCardIndex((index) => (index + 1) % flashcards.length);
                            } else if (event.key === 'ArrowLeft') {
                              event.preventDefault();
                              setActiveCardIndex((index) => (index - 1 + flashcards.length) % flashcards.length);
                            }
                          }}
                        >
                          <div className="flip-inner">
                            <div className="flip-face flip-front">
                              <span className="flip-tag">Question</span>
                              <h4>{activeCard.question}</h4>
                              <small>Tap to flip · ← → to move</small>
                            </div>
                            <div className="flip-face flip-back">
                              <span className="flip-tag">Answer</span>
                              <p>{activeCard.answer}</p>
                            </div>
                          </div>
                        </div>
                        <div className="trainer-actions">
                          <button type="button" onClick={() => setActiveCardIndex((index) => Math.max(0, index - 1))}>Previous</button>
                          <button type="button" onClick={() => toggleCard(activeCard.id)}>
                            {revealedCards[activeCard.id] ? 'Show question' : 'Flip card'}
                          </button>
                          <button type="button" onClick={() => setActiveCardIndex((index) => (index + 1) % flashcards.length)}>Next</button>
                        </div>
                        <div className="review-grade-bar">
                          <button type="button" onClick={() => reviewCard(activeCard.id, 'again')}>Again</button>
                          <button type="button" onClick={() => reviewCard(activeCard.id, 'hard')}>Hard</button>
                          <button type="button" onClick={() => reviewCard(activeCard.id, 'good')}>Good</button>
                          <button type="button" onClick={() => reviewCard(activeCard.id, 'easy')}>Easy</button>
                        </div>
                        {activeCardReview?.dueAt && (
                          <span className="review-status">Next review: {new Date(activeCardReview.dueAt).toLocaleDateString()}</span>
                        )}
                      </article>
                      <aside className="flash-stats">
                        <div>
                          <strong>{flashcards.length}</strong>
                          <span>Total cards</span>
                        </div>
                        <div>
                          <strong>{reviewedCount}</strong>
                          <span>Reviewed</span>
                        </div>
                        <div>
                          <strong>{studyStats.dueCards.length}</strong>
                          <span>Due now</span>
                        </div>
                        <button type="button" onClick={exportAnki}>Export Anki TSV</button>
                      </aside>
                    </div>
                  ) : (
                    <p className="muted">No flashcards yet. Use Make cards or the Cards button under a tutor answer.</p>
                  )}
                </div>
              </section>
            ) : page === 'cases' ? (
              <CasesPage caseId={radCaseId} setCaseId={setRadCaseId} navigate={navigate} />
            ) : page === 'radiology' ? (
              <RadiologyPage caseId={radCaseId} navigate={navigate} />
            ) : page === 'interpreter' ? (
              <InterpreterPage caseId={radCaseId} setCaseId={setRadCaseId} />
            ) : page === 'learn' ? (
              !studySet ? (
                <div className="engines-need-source">
                  <span>Add a study source first, then ask, explain, or summarize from your own material.</span>
                  <button type="button" onClick={() => navigate('library')}>Add a source</button>
                </div>
              ) : (
                <section className="learn-page">
                  <div className="learn-intent-bar" role="tablist" aria-label="How should the tutor answer">
                    {[['answer', 'Ask'], ['explanation', 'Explain'], ['summary', 'Summarize']].map(([m, label]) => (
                      <button key={m} type="button" className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>{label}</button>
                    ))}
                  </div>
                  {(() => {
                    const learnChat = chat.filter((item) => (item.mode || 'answer') === mode);
                    if (mode === 'answer') {
                      return (
                        <>
                          <div className="learn-aids-row">
                            <span className="learn-aids-label">Study aids</span>
                            <button type="button" onClick={() => createArtifact('visualLearning')} disabled={!!busy}>Concept map</button>
                            <button type="button" onClick={() => createArtifact('differentialDiagnosis')} disabled={!!busy}>Key differences</button>
                            <button type="button" onClick={() => createArtifact('knowledgeGap')} disabled={!!busy}>Knowledge gaps</button>
                            <button type="button" onClick={() => createArtifact('treatmentProtocol')} disabled={!!busy}>Treatment protocol</button>
                            <button type="button" onClick={() => createArtifact('radiologyChecklist')} disabled={!!busy}>Radiology checklist</button>
                          </div>
                          {learnChat.length === 0 && (
                            <p className="learn-hint">Ask a question and get it back as a table or diagram, or tap a study aid. This is the visual mode. Switching modes never deletes anything.</p>
                          )}
                          {renderMessages(learnChat)}
                        </>
                      );
                    }
                    if (mode === 'explanation') {
                      return (
                        <>
                          {learnChat.length === 0 && (
                            <p className="learn-hint">Have a back-and-forth with your tutor, like a normal chat. Ask anything about your source.</p>
                          )}
                          {renderMessages(learnChat)}
                        </>
                      );
                    }
                    return (
                      <>
                        <div className="learn-summary-head">
                          <div>
                            <strong>Summary</strong>
                            <span>A full, structured summary of your active source.</span>
                          </div>
                          <button type="button" className="primary-chip" onClick={startSummary} disabled={!!busy}>
                            {busy === 'study' ? <Loader2 size={15} className="spin" /> : <BookOpen size={15} />}
                            {learnChat.some((item) => item.role === 'assistant') ? 'Regenerate summary' : 'Generate full summary'}
                          </button>
                        </div>
                        {learnChat.length === 0 && (
                          <p className="learn-hint">Generate a full summary above, or type a specific topic below to summarize just that part.</p>
                        )}
                        {renderMessages(learnChat)}
                      </>
                    );
                  })()}
                </section>
              )
            ) : page === 'practice' ? (
              <section className="practice-page">
                <div className="practice-tabs" role="tablist">
                  <button type="button" role="tab" className={practiceTab === 'flashcards' ? 'active' : ''} onClick={() => setPracticeTab('flashcards')}>Flashcards</button>
                  <button type="button" role="tab" className={practiceTab === 'quiz' ? 'active' : ''} onClick={() => setPracticeTab('quiz')}>Quiz me</button>
                  <button type="button" role="tab" className={practiceTab === 'cases' ? 'active' : ''} onClick={() => setPracticeTab('cases')}>Clinical cases</button>
                </div>
                {!studySet && (
                  <div className="engines-need-source">
                    <span>Add a study source first so these are built from your own material.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                )}
                {practiceTab === 'flashcards' && (
                  <div className="kit-section">
                    <div className="practice-actions">
                      <button type="button" className="primary-chip" onClick={() => createArtifact('flashcards')} disabled={!studySet || !!busy}>
                        {busy === 'artifact' ? <Loader2 size={15} className="spin" /> : <BookmarkPlus size={15} />} Make cards
                      </button>
                      <button type="button" onClick={exportAnki} disabled={!flashcards.length}><Download size={15} /> Export Anki</button>
                    </div>
                    {flashcards.length ? (
                      <div className="flash-study">
                        <article className="flash-trainer">
                          <div className="flash-trainer-top">
                            <span>Card {activeCardIndex + 1} of {flashcards.length}</span>
                            <strong>{studyStats.dueCards.length} due now</strong>
                          </div>
                          <div
                            className={revealedCards[activeCard.id] ? 'flip-card is-flipped' : 'flip-card'}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleCard(activeCard.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCard(activeCard.id); }
                              else if (event.key === 'ArrowRight') { event.preventDefault(); setActiveCardIndex((index) => (index + 1) % flashcards.length); }
                              else if (event.key === 'ArrowLeft') { event.preventDefault(); setActiveCardIndex((index) => (index - 1 + flashcards.length) % flashcards.length); }
                            }}
                          >
                            <div className="flip-inner">
                              <div className="flip-face flip-front">
                                <span className="flip-tag">Question</span>
                                <h4>{activeCard.question}</h4>
                                <small>Tap to flip · ← → to move</small>
                              </div>
                              <div className="flip-face flip-back">
                                <span className="flip-tag">Answer</span>
                                <p>{activeCard.answer}</p>
                              </div>
                            </div>
                          </div>
                          <div className="trainer-actions">
                            <button type="button" onClick={() => setActiveCardIndex((index) => Math.max(0, index - 1))}>Previous</button>
                            <button type="button" onClick={() => toggleCard(activeCard.id)}>{revealedCards[activeCard.id] ? 'Show question' : 'Flip card'}</button>
                            <button type="button" onClick={() => setActiveCardIndex((index) => (index + 1) % flashcards.length)}>Next</button>
                          </div>
                          <div className="review-grade-bar">
                            <button type="button" onClick={() => reviewCard(activeCard.id, 'again')}>Again</button>
                            <button type="button" onClick={() => reviewCard(activeCard.id, 'hard')}>Hard</button>
                            <button type="button" onClick={() => reviewCard(activeCard.id, 'good')}>Good</button>
                            <button type="button" onClick={() => reviewCard(activeCard.id, 'easy')}>Easy</button>
                          </div>
                          {activeCardReview?.dueAt && (
                            <span className="review-status">Next review: {new Date(activeCardReview.dueAt).toLocaleDateString()}</span>
                          )}
                        </article>
                        <aside className="flash-stats">
                          <div><strong>{flashcards.length}</strong><span>Total cards</span></div>
                          <div><strong>{reviewedCount}</strong><span>Reviewed</span></div>
                          <div><strong>{studyStats.dueCards.length}</strong><span>Due now</span></div>
                          <button type="button" onClick={() => navigate('mastery')}>Open Progress</button>
                        </aside>
                      </div>
                    ) : (
                      <p className="muted">No flashcards yet. Tap Make cards to build a deck from your source.</p>
                    )}
                  </div>
                )}
                {practiceTab === 'quiz' && (
                  <div className="kit-section">
                    <div className="practice-actions">
                      <button type="button" className="primary-chip" onClick={() => { setLastPracticeKind('quiz'); createArtifact('examinerQuestions'); }} disabled={!studySet || !!busy}>
                        {busy === 'artifact' ? <Loader2 size={15} className="spin" /> : <FileQuestion size={15} />} Generate a quiz
                      </button>
                      <button type="button" onClick={startQuiz} disabled={!studySet || !!busy}>Quick oral quiz</button>
                    </div>
                    <p className="muted small-note">Answer in the box below. The tutor grades you and asks a follow-up.</p>
                    {renderMessages(chat.filter((item) => item.mode === 'test'))}
                  </div>
                )}
                {practiceTab === 'cases' && (
                  <div className="kit-section">
                    <div className="clinic-grid">
                      {clinicTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <article key={tool.id} className={`clinic-card${tool.featured ? ' featured' : ''}`}>
                            <span className="clinic-ic"><Icon size={20} /></span>
                            <div className="clinic-card-body">
                              <strong>{tool.title}</strong>
                              <span>{tool.desc}</span>
                            </div>
                            <button type="button" className="clinic-go" onClick={() => { setLastPracticeKind('cases'); createArtifact(tool.artifact); }} disabled={!studySet || !!busy}>
                              {busy === 'artifact' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                              {tool.cta}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                    {renderMessages(chat.filter((item) => item.mode === 'test'))}
                  </div>
                )}
              </section>
            ) : page === 'radiologyHub' ? (
              <section className="radiology-hub">
                <div className="rad-tabs" role="tablist">
                  <button type="button" role="tab" className={radTab === 'cases' ? 'active' : ''} onClick={() => setRadTab('cases')}>Case library</button>
                  <button type="button" role="tab" className={radTab === 'interpreter' ? 'active' : ''} onClick={() => setRadTab('interpreter')}>X-ray interpreter</button>
                </div>
                {radTab === 'cases'
                  ? <CasesPage caseId={radCaseId} setCaseId={setRadCaseId} navigate={navigate} />
                  : <InterpreterPage caseId={radCaseId} setCaseId={setRadCaseId} />}
              </section>
            ) : visibleChat.length === 0 && !modes.some((modeItem) => modeItem.id === page) ? (
              <div className="empty-state">
                <ActivePageIcon size={30} />
                <h3>{studySet ? `Start the ${activePage.label} page.` : 'Upload a textbook, paste notes, or add a dental anatomy handout.'}</h3>
              </div>
            ) : null}
            {modes.some((modeItem) => modeItem.id === page) && (
              <ModeWorkspace
                page={page}
                studySet={studySet}
                busy={busy}
                submitStudy={submitStudy}
                createArtifact={createArtifact}
                navigate={navigate}
              />
            )}
            {modes.some((modeItem) => modeItem.id === page) && visibleChat.map((item) => (
              <article key={item.id} className={`message ${item.role}`}>
                {item.role === 'assistant' ? <ResponseContent text={item.text} mode={item.mode} /> : <p>{item.text}</p>}
                <div className="message-actions">
                  {item.role === 'assistant' && (
                    <>
                      <button type="button" className="listen" onClick={() => speak(item)}>
                        {speakingId === item.id ? <Pause size={16} /> : <Volume2 size={16} />}
                        {speakingId === item.id ? 'Stop' : 'Listen'}
                      </button>
                      <button type="button" className="listen" onClick={() => createArtifact('flashcards', item.text)} disabled={!!busy}>
                        <BookmarkPlus size={16} />
                        Cards
                      </button>
                    </>
                  )}
                  <button type="button" className="listen msg-del" onClick={() => deleteMessage(item.id)} title="Delete this message">
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {busy === 'study' && (
              <article className="message assistant loading">
                <Loader2 className="spin" size={18} />
                Studying the source
              </article>
            )}
            {busy === 'voice' && (
              <article className="message assistant loading">
                <Loader2 className="spin" size={18} />
                Transcribing your voice
              </article>
            )}
            {busy === 'artifact' && (
              <article className="message assistant loading">
                <Loader2 className="spin" size={18} />
                Building your study kit
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="error">{error}</div>}

          {showComposer && (
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitStudy();
            }}
          >
            <button
              type="button"
              className={recording ? 'recording icon-button' : 'icon-button'}
              onClick={conversationMode ? () => setConversationMode(false) : recording ? stopRecording : startRecording}
              disabled={conversationMode ? false : !studySet || !!busy}
              title={conversationMode ? 'Stop study buddy' : recording ? 'Stop recording' : 'Record question'}
            >
              {conversationMode ? <Square size={20} /> : recording ? <Pause size={20} /> : <Mic size={20} />}
            </button>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                mode === 'test'
                  ? 'Answer a quiz question, ask for a harder case, or say "test me on caries"...'
                  : mode === 'summary'
                    ? 'Or summarize a specific topic, like "summarize periodontal risk"...'
                    : mode === 'explanation'
                      ? 'Ask the tutor to explain a topic, like a normal chat...'
                      : 'Ask for a table, map, or diagram of any topic from your source...'
              }
              rows={2}
              disabled={!studySet}
            />
            <button type="submit" className="icon-button send" disabled={!studySet || !message.trim() || !!busy}>
              {busy ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
          )}
        </section>
      </section>
    </main>
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = window.__SIMAV_DENTAL_ROOT__ || createRoot(rootElement);
  window.__SIMAV_DENTAL_ROOT__ = root;
  root.render(<App />);
}
