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
  Zap
} from 'lucide-react';
import './styles.css';
import './radiology/app-polish.css';

const Tooth3D = React.lazy(() => import('./Tooth3D.jsx'));
const Radiology = React.lazy(() => import('./Radiology.jsx'));
import { CasesPage, RadiologyPage, InterpreterPage } from './radiology/index.jsx';

// Radiology routes render their own dark clinical chrome, so the generic
// page-intro header is suppressed for them.
const RAD_PAGES = ['cases', 'radiology', 'interpreter'];

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
  { id: 'mastery', label: 'Mastery', icon: CheckCircle2, hint: 'adaptive', prompt: 'Track readiness, spaced review, curriculum progress, and weak-spot remediation.' },
  { id: 'engines', label: 'Study Tools', icon: Brain, hint: 'from your notes', prompt: 'Turn your uploaded source into focused study outputs: gap checks, differentials, protocols, cases, visuals, mnemonics, and more.' },
  { id: 'clinic', label: 'Clinical Cases', icon: Stethoscope, hint: 'practice', prompt: 'Generate patient cases, OSCE stations, and exam checklists from your uploaded source.' },
  { id: 'cases', label: 'Case Library', icon: Layers, hint: 'x-ray cases', prompt: 'Browse and filter teaching radiographs, then open one in the viewer.' },
  { id: 'radiology', label: 'Radiology Viewer', icon: Activity, hint: 'viewer', prompt: 'Zoom, window, measure, and study annotated structures on an X-ray.' },
  { id: 'interpreter', label: 'X-ray Interpreter', icon: Sparkles, hint: 'AI feedback', prompt: 'Write your reading of a film and get instant AI feedback.' },
  { id: 'kit', label: 'Study Kit', icon: Library, hint: 'notes & cards', prompt: 'Saved notes, generated flashcards, exports, and review material.' }
];

const sidebarItems = [
  { page: 'dashboard', label: 'Home', icon: Home, hint: 'command' },
  { page: 'explanation', label: 'Study', icon: BookOpen, hint: 'learn' },
  { page: 'library', label: 'Notes & Books', icon: Library, hint: 'your sources' },
  { page: 'answer', label: 'AI Tutor', icon: Brain, hint: 'ask anything' },
  { page: 'engines', label: 'Study Tools', icon: CircleHelp, hint: 'from notes' },
  { page: 'kit', label: 'Flashcards', icon: BookmarkPlus, hint: 'review' },
  { page: 'clinic', label: 'Clinical Cases', icon: Stethoscope, hint: 'practice' },
  { page: 'test', label: 'Exams', icon: FileQuestion, hint: 'oral practice' },
  { page: 'cases', label: 'Radiology', icon: Activity, hint: 'x-ray cases' },
  { page: 'interpreter', label: 'X-ray Interpreter', icon: ScanSearch, hint: 'AI feedback' },
  { page: 'mastery', label: 'Progress', icon: LineChart, hint: 'mastery maps' },
  { page: 'summary', label: 'Summary', icon: FileText, hint: 'recaps' }
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

const topicKeywords = [
  { topic: 'Dental Caries', terms: ['caries', 'decay', 'demineralization', 'plaque', 'enamel', 'dentin'] },
  { topic: 'Endodontics', terms: ['pulp', 'root canal', 'periapical', 'apex', 'endodontic'] },
  { topic: 'Periodontics', terms: ['periodontal', 'gingiva', 'pocket', 'calculus', 'attachment'] },
  { topic: 'Anatomy', terms: ['nerve', 'foramen', 'mandibular', 'maxillary', 'cranial', 'canal'] },
  { topic: 'Pharmacology', terms: ['drug', 'anesthetic', 'antibiotic', 'dose', 'contraindication'] },
  { topic: 'Radiology', terms: ['radiograph', 'x-ray', 'radiolucent', 'radiopaque', 'cbct'] }
];

const curriculumTracks = [
  {
    name: 'Foundations',
    domains: ['Anatomy', 'Dental Caries', 'Radiology'],
    goal: 'Build the map of tooth structure, landmarks, and disease language.'
  },
  {
    name: 'Clinical Reasoning',
    domains: ['Endodontics', 'Periodontics', 'Pharmacology'],
    goal: 'Connect symptoms, findings, mechanisms, and safe next questions.'
  },
  {
    name: 'Performance',
    domains: ['Dental Caries', 'Endodontics', 'Periodontics'],
    goal: 'Convert knowledge into OSCE answers, chairside checklists, and teach-back.'
  }
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
  const cleaned = lines.filter((line) => !isMarkdownSeparatorLine(line));
  if (!cleaned.length) return null;
  const rows = cleaned.map(parseTableRow).filter((row) => row.some(Boolean));
  if (!rows.length) return null;
  const [header, ...body] = rows;
  const likelyHeader = header.some((cell) => /criteria|marks|score|comments|finding|feature|step|task|rubric|domain/i.test(cell));
  const dataRows = likelyHeader ? body : rows;
  const headers = likelyHeader ? header : rows[0].map((_, index) => `Column ${index + 1}`);
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
function RenderBlock({ block, mode }) {
  if (block.type === 'table') return <ResponseTable lines={block.lines} />;

  const line = block.line;
  const heading = line.replace(/^#{1,6}\s*/, '');
  const numbered = heading.match(/^(\d+)\.\s+(.*)/);
  const bullet = heading.match(/^[-*]\s+(.*)/);

  // Turn ASCII arrow chains (A -> B -> C) into a real visual flow map.
  const flowSource = bullet ? bullet[1] : numbered ? numbered[2] : heading;
  const flowNodes = flowSource.split(/\s*(?:->|=>|→)\s*/).map((node) => node.trim()).filter(Boolean);
  if (flowNodes.length >= 2 && flowNodes.length <= 8 && /(?:->|=>|→)/.test(flowSource) && flowSource.length <= 220) {
    return (
      <div className="flow-map">
        {flowNodes.map((node, nodeIndex) => (
          <React.Fragment key={`${node}-${nodeIndex}`}>
            <span className="flow-node"><InlineText text={node} /></span>
            {nodeIndex < flowNodes.length - 1 && <span className="flow-arrow" aria-hidden="true">→</span>}
          </React.Fragment>
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

// A collapsible section of an answer. Lets a student scan headings and open
// only what they need instead of reading everything at once.
function AnswerSection({ title, blocks, mode, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const preview = blocks.length;
  return (
    <section className={`answer-section${open ? ' open' : ''}`}>
      <button type="button" className="answer-section-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={16} className="sec-caret" />
        <span><InlineText text={title} /></span>
        {!open && preview > 0 && <em className="sec-count">{preview}</em>}
      </button>
      {open && (
        <div className="answer-section-body">
          {blocks.map((block, index) => <RenderBlock key={index} block={block} mode={mode} />)}
        </div>
      )}
    </section>
  );
}

function ResponseContent({ text, mode }) {
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

  return (
    <div className={wrapClass}>
      {intro.map((block, index) => <RenderBlock key={`intro-${index}`} block={block} mode={mode} />)}
      {sections.map((section, index) => (
        <AnswerSection key={`sec-${index}`} title={section.title} blocks={section.blocks} mode={mode} defaultOpen={index === 0} />
      ))}
    </div>
  );
}

const commandActions = [
  { title: 'Study a Topic', subtitle: 'Deepen your understanding', icon: BookOpen, page: 'explanation', prompt: 'Teach this topic using the seven-level dental learning ladder.' },
  { title: 'Clinical Cases', subtitle: 'Solve patient scenarios', icon: Stethoscope, artifact: 'clinicalCase', prompt: 'Create a step-by-step clinical case simulator from this subject.' },
  { title: 'X-Ray Interpreter', subtitle: 'Read radiology step-by-step', icon: Activity, artifact: 'radiologyChecklist', prompt: 'Create a radiology interpretation checklist for this subject.' },
  { title: 'Flashcards', subtitle: 'Review with spaced repetition', icon: BookmarkPlus, artifact: 'flashcards', prompt: 'Create source-grounded flashcards for this subject.' },
  { title: 'MCQ Practice', subtitle: 'Timed questions and weak spots', icon: CircleHelp, artifact: 'examinerQuestions', prompt: 'Create board-style MCQs and mark schemes for this subject.' },
  { title: 'Oral Exam Practice', subtitle: 'Train examiner answers', icon: FileQuestion, page: 'test', prompt: 'Start an oral exam on this subject.' },
  { title: 'AI Tutor', subtitle: 'Ask anything, learn better', icon: Brain, page: 'answer', prompt: 'Open the professor tutor for this subject.' },
  { title: 'Treatment Planning', subtitle: 'Protocols and decisions', icon: ClipboardList, artifact: 'treatmentProtocol', prompt: 'Build an educational treatment protocol for this subject.' }
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

function RingProgress({ value, label, className = '' }) {
  return (
    <div className={`ring-progress ${className}`} style={{ '--value': value }}>
      <strong>{value}%</strong>
      <span>{label}</span>
    </div>
  );
}

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

// Dependency-free SVG radar of per-topic mastery so progress reads as a graph,
// not just a row of meters.
function MasteryRadar({ domains }) {
  const items = (domains || []).slice(0, 6);
  if (items.length < 3) return null;
  const count = items.length;
  const cx = 110;
  const cy = 110;
  const radius = 80;
  const angleFor = (index) => (Math.PI * 2 * index) / count - Math.PI / 2;
  const pointAt = (index, distance) => [
    cx + Math.cos(angleFor(index)) * distance,
    cy + Math.sin(angleFor(index)) * distance
  ];
  const rings = [0.25, 0.5, 0.75, 1];
  const valuePoints = items
    .map((domain, index) => pointAt(index, radius * Math.max(0.08, Math.min(1, domain.score / 100))).join(','))
    .join(' ');

  return (
    <svg className="radar-chart" viewBox="0 0 220 220" role="img" aria-label="Mastery radar by topic">
      {rings.map((ring, ringIndex) => (
        <polygon
          key={ring}
          className={ringIndex === rings.length - 1 ? 'radar-ring radar-ring-edge' : 'radar-ring'}
          points={items.map((_, index) => pointAt(index, radius * ring).join(',')).join(' ')}
        />
      ))}
      {items.map((_, index) => {
        const [x, y] = pointAt(index, radius);
        return <line key={`spoke-${index}`} className="radar-spoke" x1={cx} y1={cy} x2={x} y2={y} />;
      })}
      <polygon className="radar-area" points={valuePoints} />
      {items.map((domain, index) => {
        const [x, y] = pointAt(index, radius * Math.max(0.08, Math.min(1, domain.score / 100)));
        return <circle key={`dot-${domain.topic}`} className="radar-dot" cx={x} cy={y} r="3.4" />;
      })}
      {items.map((domain, index) => {
        const [lx, ly] = pointAt(index, radius + 20);
        const anchor = lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle';
        return (
          <text key={`label-${domain.topic}`} className="radar-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
            {domain.topic.split(' ')[0]}
          </text>
        );
      })}
    </svg>
  );
}

function SourceIntakePanel({ selectedSubject, setSelectedSubject, selectedIntent, navigate }) {
  return (
    <article className="source-intake glass-panel">
      <div className="panel-title">
        <div>
          <strong>Build your study source first</strong>
          <span>DentalOS should not invent cases, MCQs, or protocols before you choose material.</span>
        </div>
      </div>
      <div className="subject-picker">
        {dentalSubjects.map((subject) => (
          <button key={subject} type="button" className={selectedSubject === subject ? 'active' : ''} onClick={() => setSelectedSubject(subject)}>
            {subject}
          </button>
        ))}
      </div>
      <div className="intake-brief">
        <strong>{selectedSubject ? `Selected path: ${selectedSubject}` : 'Select a subject or ask the AI to help choose'}</strong>
        <p>{selectedIntent || 'Choose a study mode above, then upload a PDF or paste lecture notes. The AI will build from your real source instead of a placeholder.'}</p>
        <div>
          <button type="button" className="primary-chip" onClick={() => navigate('library')}>Upload or paste source</button>
          <button type="button" onClick={() => navigate('answer')}>Ask what to upload</button>
        </div>
      </div>
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

function CommandCenterDashboard({ user, masteryModel, flashcards, chat, studySet, busy, navigate, createArtifact, submitStudy }) {
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
  const weakAreas = masteryModel.domains.slice(0, 4).map((domain, index) => ({
    label: domain.topic,
    score: Math.max(34, Math.min(78, 100 - domain.score + index * 8))
  }));
  const topSubjects = masteryModel.domains.slice(0, 5).map((domain, index) => ({
    label: domain.topic,
    score: Math.max(58, Math.min(92, domain.score + 12 - index * 4))
  }));
  const weakAverage = Math.round(weakAreas.reduce((total, area) => total + area.score, 0) / Math.max(1, weakAreas.length));
  const activityMetrics = [
    { label: 'Questions', value: chat.filter((item) => item.role === 'user').length },
    { label: 'Answers', value: chat.filter((item) => item.role === 'assistant').length },
    { label: 'Cards', value: flashcards.length },
    { label: 'Due', value: masteryModel.dueCards.length }
  ];
  const activityPeak = Math.max(1, ...activityMetrics.map((metric) => metric.value));
  const hasActivity = activityMetrics.some((metric) => metric.value > 0);

  function runAction(action) {
    setSelectedIntent(`${action.title}: ${action.prompt}`);
    if (!hasSource) return;
    if (!selectedSubject && action.artifact) {
      submitStudy(`Before creating ${action.title}, inspect my active source and ask me to choose a focus area. Offer 3 useful dental focus options with one sentence explaining why each would be high-yield.`);
      navigate('answer');
      return;
    }
    if (action.page) {
      navigate(action.page);
      return;
    }
    if (action.artifact) createArtifact(action.artifact);
  }

  return (
    <section className="command-center" aria-label="DentalOS AI command center">
      <div className="command-topbar">
        <label className="command-search">
          <Search size={17} />
          <input
            placeholder="Ask about any dental topic, then press Enter"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                submitStudy(`Teach me about ${event.currentTarget.value.trim()} with exam pearls, clinical relevance, and common mistakes.`);
                event.currentTarget.value = '';
              }
            }}
          />
        </label>
        {hasSource && masteryModel.dueCards.length > 0 && (
          <button type="button" className="topbar-due" onClick={() => navigate('mastery')}>
            <Bell size={16} />
            {masteryModel.dueCards.length} due
          </button>
        )}
      </div>

      <div className="command-greeting">
        <div>
          <h2>Good morning, {firstName}.</h2>
          <p>{hasSource ? 'Pick up where you left off, or explore the tooth model below.' : 'Add a study source to begin.'}</p>
        </div>
        <button type="button" onClick={() => navigate(studySet ? 'answer' : 'library')}>
          <Sparkles size={17} />
          {studySet ? 'Continue studying' : 'Add study source'}
        </button>
      </div>

      {!hasSource && (
        <SourceIntakePanel
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          selectedIntent={selectedIntent}
          navigate={navigate}
        />
      )}

      {hasSource && (
        <div className="active-source-strip">
          <FileText size={16} />
          <span>Studying from {sourceName}</span>
        </div>
      )}

      {hasSource && <div className="dash-feature-grid">
        <article className="anatomy-panel glass-panel">
          <div className="panel-title">
            <div>
              <strong>Interactive Tooth Anatomy</strong>
              <span>Tap any layer of the cross-section to study it</span>
            </div>
            <button type="button" onClick={() => setSelectedStructure('dentin')}>Reset</button>
          </div>
          <div className="anatomy-workspace">
            <div className="anatomy-tabs">
              {anatomyStructures.map((item) => (
                <button key={item.id} type="button" className={selectedStructure === item.id ? 'active' : ''} onClick={() => setSelectedStructure(item.id)}>
                  <span className="layer-swatch" style={{ background: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>
            <React.Suspense fallback={<div className="tooth3d-stage loading"><span>Loading 3D model…</span></div>}>
              <Tooth3D
                selected={selectedStructure}
                onSelect={setSelectedStructure}
                label={structure.label}
                color={structure.color}
              />
            </React.Suspense>
            <div className="structure-card">
              <strong>{structure.label}</strong>
              <span className="structure-tissue">{structure.tissue}</span>
              <p>{structure.detail}</p>
              <h4>Key Points</h4>
              {structure.points.map((point) => <span key={point}><CheckCircle2 size={14} />{point}</span>)}
              <h4>Related Topics</h4>
              <div className="related-pills">
                {structure.related.map((topic) => (
                  <button type="button" key={topic} onClick={() => submitStudy(`Teach me ${topic} from my active source. Include prerequisite concepts, clinical relevance, common misconceptions, and exam pearls.`)}>
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="analytics-panel stacked glass-panel">
            <div className="panel-title">
              <strong>Your Progress</strong>
              <button type="button" className="panel-link" onClick={() => navigate('mastery')}>View all</button>
            </div>
            <RingProgress value={Math.max(12, masteryModel.average)} label="Overall progress" />
            <div className="trend-card">
              <strong>This study set</strong>
              {hasActivity ? (
                <>
                  <div className="trend-bars">
                    {activityMetrics.map((metric) => (
                      <i
                        key={metric.label}
                        style={{ height: `${Math.max(6, Math.round((metric.value / activityPeak) * 100))}%` }}
                        title={`${metric.label}: ${metric.value}`}
                      />
                    ))}
                  </div>
                  <div className="trend-labels">
                    {activityMetrics.map((metric) => (
                      <span key={metric.label}>{metric.label} {metric.value}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="trend-empty">Ask questions and build cards to see your activity here.</p>
              )}
            </div>
            <div className="radar-card">
              <strong>Topic mastery map</strong>
              <MasteryRadar domains={masteryModel.domains} />
            </div>
        </div>
      </div>}

      {hasSource && <article className="rad-panel glass-panel">
        <div className="panel-title">
          <div>
            <strong>Radiograph Reader</strong>
            <span>Pan, zoom, and tap findings to learn how to read a periapical x-ray</span>
          </div>
        </div>
        <React.Suspense fallback={<div className="rad-viewer loading"><span>Loading radiograph…</span></div>}>
          <Radiology onStudy={submitStudy} />
        </React.Suspense>
      </article>}

      {hasSource && <div className="dash-tools">
        <div className="dash-tools-head">
          <strong>Study tools</strong>
          <span>Generate grounded material from your source</span>
        </div>
        <div className="command-actions">
          {commandActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.title} type="button" onClick={() => runAction(action)} disabled={!!busy}>
                <span><Icon size={22} /></span>
                <strong>{action.title}</strong>
                <small>{action.subtitle}</small>
              </button>
            );
          })}
        </div>
      </div>}
    </section>
  );
}

function App() {
  const [files, setFiles] = useState([]);
  const [studySet, setStudySet] = useState(null);
  const [mode, setMode] = useState('answer');
  const [page, setPage] = useState('dashboard');
  const [radCaseId, setRadCaseId] = useState(null);
  const [message, setMessage] = useState('');
  const [textSourceTitle, setTextSourceTitle] = useState('');
  const [textSource, setTextSource] = useState('');
  const [chat, setChat] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [notes, setNotes] = useState('');
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
  const visibleChat = useMemo(() => {
    if (!modes.some((item) => item.id === page)) return [];
    return chat.filter((item) => item.mode === page || (page === 'answer' && !item.mode));
  }, [chat, page]);
  const progress = useMemo(() => {
    const answers = chat.filter((item) => item.role === 'assistant').length;
    const questions = chat.filter((item) => item.role === 'user').length;
    return { answers, questions, cards: flashcards.length };
  }, [chat, flashcards.length]);
  const topicHeatmap = useMemo(() => {
    const corpus = chat.map((item) => item.text).join(' ').toLowerCase();
    return topicKeywords.map((item) => {
      const mentions = item.terms.reduce((count, term) => count + (corpus.match(new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'g'))?.length || 0), 0);
      const testMentions = chat
        .filter((entry) => entry.mode === 'test')
        .map((entry) => entry.text.toLowerCase())
        .join(' ');
      const weakSignals = item.terms.reduce((count, term) => count + (testMentions.match(new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'g'))?.length || 0), 0);
      const strength = Math.max(8, Math.min(96, mentions * 16 - weakSignals * 5 + (flashcards.length ? 10 : 0)));
      return { ...item, mentions, strength };
    });
  }, [chat, flashcards.length]);
  const masteryModel = useMemo(() => {
    const now = Date.now();
    const dueCards = flashcards.filter((card) => {
      const review = learning.reviews?.[card.id];
      return !review?.dueAt || new Date(review.dueAt).getTime() <= now;
    });
    const domains = topicHeatmap.map((topic) => {
      const relatedCards = flashcards.filter((card) => {
        const text = `${card.question} ${card.answer}`.toLowerCase();
        return topic.terms.some((term) => text.includes(term));
      }).length;
      const reviewed = flashcards.filter((card) => {
        const text = `${card.question} ${card.answer}`.toLowerCase();
        return learning.reviews?.[card.id] && topic.terms.some((term) => text.includes(term));
      }).length;
      const confidence = learning.confidence?.[topic.topic] || 0;
      const score = Math.max(5, Math.min(100, topic.strength + relatedCards * 4 + reviewed * 8 + confidence * 8));
      return { ...topic, relatedCards, reviewed, confidence, score };
    });
    const average = Math.round(domains.reduce((total, item) => total + item.score, 0) / Math.max(1, domains.length));
    const weakest = [...domains].sort((a, b) => a.score - b.score).slice(0, 2);
    const tracks = curriculumTracks.map((track) => {
      const trackDomains = domains.filter((domain) => track.domains.includes(domain.topic));
      const readiness = Math.round(trackDomains.reduce((total, item) => total + item.score, 0) / Math.max(1, trackDomains.length));
      return { ...track, readiness };
    });
    return { average, domains, dueCards, weakest, tracks };
  }, [flashcards, learning, topicHeatmap]);
  const reviewedCount = flashcards.filter((card) => learning.reviews?.[card.id]).length;
  const activeCard = flashcards[Math.min(activeCardIndex, Math.max(0, flashcards.length - 1))];
  const activeCardReview = activeCard ? learning.reviews?.[activeCard.id] : null;

  useEffect(() => {
    if (activeCardIndex >= flashcards.length) {
      setActiveCardIndex(Math.max(0, flashcards.length - 1));
    }
  }, [activeCardIndex, flashcards.length]);

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
    setStudySet(saved.studySet || null);
    setChat(Array.isArray(saved.chat) ? saved.chat : []);
    setFlashcards(Array.isArray(saved.flashcards) ? saved.flashcards : []);
    setNotes(typeof saved.notes === 'string' ? saved.notes : '');
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

    const body = {
      studySet,
      chat,
      flashcards,
      notes,
      page,
      voicePersona,
      learning
    };
    localStorage.setItem(stateKeyForUser(auth.user.id), JSON.stringify(body));

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
  }, [auth.user?.id, sessionLoaded, studySet, chat, flashcards, notes, page, voicePersona, learning]);

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
    recognition.start();
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
      navigate('kit');
      return true;
    }
    if (normalized.includes('summarize')) {
      navigate('summary');
      submitStudy('Summarize this study source for a dental exam.', { speak: true });
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
      navigate('test');
      submitStudy('Start a 5-minute oral quiz on the highest-yield material in this study source.', { speak: true });
      return true;
    }
    return false;
  }

  function parseFlashcards(text) {
    const cards = [];
    const blocks = text.split(/\n\s*\n/);
    for (const block of blocks) {
      const q = block.match(/Q:\s*(.+)/i)?.[1]?.trim();
      const a = block.match(/A:\s*([\s\S]+)/i)?.[1]?.trim();
      if (q && a) {
        cards.push({ id: crypto.randomUUID(), question: stripMarkdown(q), answer: stripMarkdown(a) });
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
    const rows = flashcards.map((card) => `${card.question.replace(/\t/g, ' ')}\t${card.answer.replace(/\t/g, ' ')}`);
    downloadFile('dental-flashcards.tsv', rows.join('\n'), 'text/tab-separated-values');
  }

  async function clearSession() {
    stopSpeech(false);
    stopStudyBuddy();
    setStudySet(null);
    setChat([]);
    setFlashcards([]);
    setNotes('');
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

  async function deleteSource(fileId) {
    if (!studySet?.vectorStoreId) return;
    if (!window.confirm('Remove this source from your study set?')) return;
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
      setStudySet(data.studySet);
      if (!data.studySet) setPage('library');
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleCard(cardId) {
    setRevealedCards((items) => ({ ...items, [cardId]: !items[cardId] }));
  }

  function removeCard(cardId) {
    setFlashcards((items) => items.filter((card) => card.id !== cardId));
    setActiveCardIndex((index) => Math.max(0, Math.min(index, flashcards.length - 2)));
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

  function markConfidence(topic, direction) {
    setLearning((state) => ({
      ...state,
      confidence: {
        ...(state.confidence || {}),
        [topic]: Math.max(-3, Math.min(3, (state.confidence?.[topic] || 0) + direction))
      }
    }));
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
      setStudySet(data);
      setPage('dashboard');
      setMode('answer');
      setChat([
        {
          role: 'assistant',
          text: 'Your PDF set is indexed. You can ask a question, request a summary, or switch to Test mode for an oral exam.',
          mode: 'answer',
          id: crypto.randomUUID()
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
      setStudySet(data);
      setTextSourceTitle('');
      setTextSource('');
      setPage('dashboard');
      setMode('answer');
      setChat([
        {
          role: 'assistant',
          text: 'Your pasted dental material is indexed. Ask questions, generate a study plan, or start an OSCE-style drill.',
          mode: 'answer',
          id: crypto.randomUUID()
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
          vectorStoreId: studySet.vectorStoreId,
          type,
          source,
          history: chat.slice(-8).map(({ role, text }) => ({ role, text })),
          persona: voicePersona
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Artifact request failed');
      bumpUsage('aiCalls');

      if (type === 'flashcards') {
        const cards = Array.isArray(data.cards)
          ? data.cards
              .filter((card) => card?.question && card?.answer)
              .map((card) => ({ id: crypto.randomUUID(), question: stripMarkdown(card.question), answer: stripMarkdown(card.answer) }))
          : parseFlashcards(data.text);
        setFlashcards((items) => [...cards, ...items]);
        setPage('kit');
        setChat((items) => [
          ...items,
          {
            role: 'assistant',
            text: cards.length
              ? `Created ${cards.length} flashcards and saved them in the Study Kit.`
              : data.text,
            mode: 'summary',
            id: crypto.randomUUID()
          }
        ]);
        return;
      }

      const testArtifacts = ['weakQuiz', 'caseStudy', 'osce', 'examinerQuestions', 'clinicalCase'];
      const kitArtifacts = ['notes', 'adaptivePlan', 'curriculumMap', 'clinicalVisionChecklist', 'mnemonics', 'memoryPlan'];
      if (kitArtifacts.includes(type)) {
        setNotes(data.text);
        setPage('kit');
      }
      if (testArtifacts.includes(type)) {
        setPage('test');
        setMode('test');
      }
      if (!kitArtifacts.includes(type) && !testArtifacts.includes(type)) {
        setPage('summary');
        setMode('summary');
      }

      setChat((items) => [...items, { role: 'assistant', text: data.text, mode: testArtifacts.includes(type) ? 'test' : 'summary', id: crypto.randomUUID() }]);
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

    stopSpeech(false);
    busyRef.current = 'study';
    setBusy('study');
    setError('');
    setMessage('');
    const userItem = { role: 'user', text: trimmed, mode, id: crypto.randomUUID() };
    const history = chat.slice(-8).map(({ role, text }) => ({ role, text }));
    setChat((items) => [...items, userItem]);

    try {
      const response = await fetch(`${API_BASE}/study`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectorStoreId: studySet.vectorStoreId,
          message: trimmed,
          mode,
          history,
          persona: voicePersona
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Study request failed');
      bumpUsage('aiCalls');
      const assistantItem = { role: 'assistant', text: data.text, mode, id: crypto.randomUUID() };
      setChat((items) => [...items, assistantItem]);
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
        setChat((items) => [
          ...items,
          { role: 'user', text: data.text, mode, id: crypto.randomUUID() },
          { role: 'assistant', text: 'Paused. Ask me for the next explanation, summary, or quiz when you are ready.', mode, id: crypto.randomUUID() }
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
          speechItemRef.current = '';
          resumeStudyBuddyAfterTutor();
        }
      };
      audio.onerror = () => {
        if (speechItemRef.current === item.id) {
          speechItemRef.current = '';
          tutorSpeakingRef.current = false;
          setVoiceStatus('Voice error');
          setSpeakingId(null);
        }
      };
      await audio.play();
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
        <section className="auth-panel">
          <div className="auth-topbar">
            <div className="brand-mark">
              <GraduationCap size={24} />
            </div>
            <button
              type="button"
              className="ghost-button theme-toggle"
              onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
          <div className="auth-copy">
            <p>Private dental study workspace</p>
            <h1>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
            <span>Simav Dental Tutor turns dental PDFs, notes, rubrics, and protocols into summaries, explanations, oral tests, flashcards, and voice study sessions.</span>
          </div>
          <div className="guide-list" aria-label="How to use Simav Dental Tutor">
            <article>
              <strong>1. Create your private account</strong>
              <span>Your study history, notes, and flashcards stay saved across devices.</span>
            </article>
            <article>
              <strong>2. Add study material</strong>
              <span>Use a lecture PDF, textbook chapter, pasted notes, rubric, or exam review file.</span>
            </article>
            <article>
              <strong>3. Pick a study mode</strong>
              <span>Ask questions, request a summary, generate a case, or start an oral test.</span>
            </article>
            <article>
              <strong>4. Turn on Study Buddy</strong>
              <span>Speak naturally, listen to answers, and study hands-free when microphone access is available.</span>
            </article>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm((form) => ({ ...form, name: event.target.value }))}
                  placeholder="Dental student"
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
                placeholder="At least 8 characters"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
            {authError && <div className="error auth-error">{authError}</div>}
            <button type="submit" className="auth-submit">
              {authMode === 'signup' ? <UserPlus size={18} /> : <Sparkles size={18} />}
              {authMode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <button type="button" className="auth-switch" onClick={() => setAuthMode((value) => (value === 'signup' ? 'login' : 'signup'))}>
            {authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </section>
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

          {studySet && (
            <div className="source-strip" title={fileNames}>
              <span>Current set</span>
              <strong>{sourceCountLabel}</strong>
            </div>
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
                <button
                  key={`${item.label}-${item.page}`}
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
              );
            })}
          </nav>

          <div className="system-card" aria-label="DentalOS system status">
            <div className="system-card-header">
              <span>
                <Sparkles size={17} />
              </span>
              <div>
                <strong>DentalOS Core</strong>
                <small>Learning engine status</small>
              </div>
            </div>
            <div className="system-meter">
              <div>
                <span>Readiness</span>
                <strong>{masteryModel.average}%</strong>
              </div>
              <meter min="0" max="100" value={masteryModel.average}>
                {masteryModel.average}%
              </meter>
            </div>
            <div className="system-chips">
              <span>
                <CheckCircle2 size={14} />
                Source grounded
              </span>
              <span>
                <LayoutDashboard size={14} />
                Tables + charts
              </span>
              <span>
                <Brain size={14} />
                Adaptive memory
              </span>
              <span>
                <FileText size={14} />
                Review required
              </span>
            </div>
          </div>
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
                  masteryModel={masteryModel}
                  flashcards={flashcards}
                  chat={chat}
                  studySet={studySet}
                  busy={busy}
                  navigate={navigate}
                  createArtifact={createArtifact}
                  submitStudy={submitStudy}
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
                    <h3>{studySet ? 'Your study set is indexed and ready' : 'Add the material you want to study from'}</h3>
                    <span>
                      {studySet
                        ? `${sourceCountLabel} active. Everything DentalOS generates is grounded in this material.`
                        : 'Upload lecture PDFs or paste notes, rubrics, and protocols. The tutor only answers from what you add here.'}
                    </span>
                  </div>
                  {studySet && (
                    <button type="button" className="danger-action" onClick={clearSession}>Remove source</button>
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
                    <h3>Indexed material</h3>
                  </div>
                  {studySet ? (
                    <div className="file-list">
                      {studySet.files.map((file) => (
                        <div key={file.fileId} className="file-row">
                          <span className="file-ic"><FileText size={17} /></span>
                          <span className="file-name">{file.originalName}</span>
                          <span className={file.sourceType === 'text' ? 'file-badge text' : 'file-badge pdf'}>
                            {file.sourceType === 'text' ? 'Text' : 'PDF'}
                          </span>
                          <button type="button" className="file-del" onClick={() => deleteSource(file.fileId)} title="Remove this source" aria-label="Remove this source">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Upload PDFs or paste text to create a study set.</p>
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
                <div className="mastery-hero">
                  <div>
                    <p>Your progress</p>
                    <h3>{masteryModel.average}% readiness</h3>
                    <span>{masteryModel.weakest.length ? `${masteryModel.weakest.map((item) => item.topic).join(' and ')} are least covered right now.` : 'Study and review to start building your readiness map.'}</span>
                    <button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>
                      Build rescue plan
                    </button>
                  </div>
                  <div className="mastery-hero-radar">
                    <MasteryRadar domains={masteryModel.domains} />
                  </div>
                </div>
                {!studySet && (
                  <div className="engines-need-source">
                    <span>Add a study source and review some flashcards to start tracking your progress.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                )}
                <div className="mastery-grid">
                  {masteryModel.domains.map((domain) => (
                    <article key={domain.topic} className="mastery-card">
                      <div>
                        <strong>{domain.topic}</strong>
                        <span>{domain.relatedCards || domain.reviewed ? `${domain.relatedCards} related cards, ${domain.reviewed} reviewed` : 'Not started yet'}</span>
                      </div>
                      <meter min="0" max="100" value={domain.score}></meter>
                      <div className="confidence-row">
                        <button type="button" onClick={() => markConfidence(domain.topic, -1)}>Weak</button>
                        <span>Confidence {domain.confidence}</span>
                        <button type="button" onClick={() => markConfidence(domain.topic, 1)}>Strong</button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="kit-section">
                  <div className="section-title">
                    <BookmarkPlus size={18} />
                    <h3>Due Review</h3>
                  </div>
                  {masteryModel.dueCards.length ? (
                    <div className="review-list">
                      {masteryModel.dueCards.slice(0, 6).map((card) => (
                        <article key={card.id}>
                          <strong>{card.question}</strong>
                          <span>{card.answer}</span>
                          <div>
                            <button type="button" onClick={() => reviewCard(card.id, 'again')}>Again</button>
                            <button type="button" onClick={() => reviewCard(card.id, 'hard')}>Hard</button>
                            <button type="button" onClick={() => reviewCard(card.id, 'good')}>Good</button>
                            <button type="button" onClick={() => reviewCard(card.id, 'easy')}>Easy</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No cards are due. Generate flashcards or keep studying to grow the review queue.</p>
                  )}
                </div>
                <div className="kit-section">
                  <div className="section-title">
                    <Brain size={18} />
                    <h3>Curriculum Tracks</h3>
                  </div>
                  <div className="track-grid">
                    {masteryModel.tracks.map((track) => (
                      <article key={track.name}>
                        <strong>{track.name}</strong>
                        <meter min="0" max="100" value={track.readiness}></meter>
                        <span>{track.readiness}% ready</span>
                        <p>{track.goal}</p>
                      </article>
                    ))}
                  </div>
                  <button type="button" onClick={() => createArtifact('curriculumMap')} disabled={!studySet || !!busy}>
                    Generate curriculum map from source
                  </button>
                </div>
              </section>
            ) : page === 'engines' ? (
              <section className="engines-page">
                <div className="engines-hero-bar">
                  <p>Study tools</p>
                  <h3>Turn your own notes into one focused study output.</h3>
                  <small>Each tool reads only the source you uploaded and gives you something specific back: a gap check, a comparison table, a practice case, mnemonics, and more. Pick what you need for today.</small>
                </div>
                {!studySet && (
                  <div className="engines-need-source">
                    <span>Add a study source first so these tools can work from your material.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                )}
                {engineGroups.map((group) => (
                  <div key={group.key} className="engine-group">
                    <div className="engine-group-head">
                      <strong>{group.key}</strong>
                      <span>{group.caption}</span>
                    </div>
                    <div className="engine-grid">
                      {dentalosEngines.filter((engine) => engine.group === group.key).map((engine) => {
                        const Icon = engine.icon;
                        return (
                          <article key={engine.id} className="engine-card">
                            <div className="engine-card-top">
                              <span className="engine-ic"><Icon size={20} /></span>
                              <span className="engine-produces">{engine.produces}</span>
                            </div>
                            <strong>{engine.title}</strong>
                            <span>{engine.copy}</span>
                            <button type="button" onClick={() => createArtifact(engine.id)} disabled={!studySet || !!busy}>
                              Generate
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="safety-note">
                  <ShieldCheck size={14} />
                  Educational support only. Source-grounded, with no autonomous diagnosis or treatment planning.
                </p>
              </section>
            ) : page === 'clinic' ? (
              <section className="clinic-page">
                <div className="clinic-hero">
                  <div>
                    <p>Clinical cases</p>
                    <h3>Practice with patient scenarios built from your notes.</h3>
                    <span>Generate a case to reason through, an OSCE station to rehearse, or a checklist to structure your exam. Each one is grounded in the source you uploaded.</span>
                  </div>
                </div>
                {!studySet && (
                  <div className="engines-need-source">
                    <span>Add a study source first so these can be built from your material.</span>
                    <button type="button" onClick={() => navigate('library')}>Add a source</button>
                  </div>
                )}
                <div className="clinic-grid">
                  <article>
                    <span className="clinic-ic"><Stethoscope size={22} /></span>
                    <strong>Clinical case</strong>
                    <span>A step-by-step patient scenario with history, findings, and decisions to reason through.</span>
                    <small className="produces">Produces: interactive case</small>
                    <button type="button" onClick={() => createArtifact('caseStudy')} disabled={!studySet || !!busy}>Generate case</button>
                  </article>
                  <article>
                    <span className="clinic-ic"><ClipboardList size={22} /></span>
                    <strong>OSCE station</strong>
                    <span>An exam-style station with a patient script, tasks, and a marking rubric to rehearse against.</span>
                    <small className="produces">Produces: OSCE + rubric</small>
                    <button type="button" onClick={() => createArtifact('osce')} disabled={!studySet || !!busy}>Generate OSCE</button>
                  </article>
                  <article>
                    <span className="clinic-ic"><CheckCircle2 size={22} /></span>
                    <strong>Exam checklist</strong>
                    <span>Turn a topic into observable signs, red flags, and a structured way to present your findings.</span>
                    <small className="produces">Produces: checklist</small>
                    <button type="button" onClick={() => createArtifact('clinicalVisionChecklist')} disabled={!studySet || !!busy}>Build checklist</button>
                  </article>
                  <article>
                    <span className="clinic-ic"><Brain size={22} /></span>
                    <strong>Rescue plan</strong>
                    <span>Turn your weak spots into targeted drills, confidence checks, and a spaced review plan.</span>
                    <small className="produces">Produces: study plan</small>
                    <button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>Create plan</button>
                  </article>
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
                          <strong>{masteryModel.dueCards.length} due now</strong>
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
                            }
                          }}
                        >
                          <div className="flip-inner">
                            <div className="flip-face flip-front">
                              <span className="flip-tag">Question</span>
                              <h4>{activeCard.question}</h4>
                              <small>Click or press space to flip</small>
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
                          <strong>{masteryModel.dueCards.length}</strong>
                          <span>Due now</span>
                        </div>
                        <button type="button" onClick={exportAnki}>Export Anki TSV</button>
                      </aside>
                      <div className="flashcard-grid compact">
                        {flashcards.map((card, index) => (
                          <article className={activeCard?.id === card.id ? 'flashcard active' : 'flashcard'} key={card.id}>
                            <button type="button" className="card-select" onClick={() => setActiveCardIndex(index)}>
                              <span>Card {index + 1}</span>
                              <strong>{card.question}</strong>
                            </button>
                            {revealedCards[card.id] && <p>{card.answer}</p>}
                            <div className="card-actions">
                              <button type="button" onClick={() => toggleCard(card.id)}>
                                {revealedCards[card.id] ? 'Hide' : 'Show'}
                              </button>
                              <button type="button" onClick={() => reviewCard(card.id, 'good')}>Good</button>
                              <button type="button" onClick={() => removeCard(card.id)}>Remove</button>
                            </div>
                          </article>
                        ))}
                      </div>
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
                {item.role === 'assistant' && (
                  <div className="message-actions">
                    <button type="button" className="listen" onClick={() => speak(item)}>
                      {speakingId === item.id ? <Pause size={16} /> : <Volume2 size={16} />}
                      {speakingId === item.id ? 'Stop' : 'Listen'}
                    </button>
                    <button type="button" className="listen" onClick={() => createArtifact('flashcards', item.text)} disabled={!!busy}>
                      <BookmarkPlus size={16} />
                      Cards
                    </button>
                  </div>
                )}
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
              disabled={!studySet || (!!busy && busy !== 'voice') || busy === 'voice'}
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
                  : 'Ask about caries, mental foramen landmarks, enamel formation, cavity classes...'
              }
              rows={2}
              disabled={!studySet}
            />
            <button type="submit" className="icon-button send" disabled={!studySet || !message.trim() || !!busy}>
              {busy ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
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
