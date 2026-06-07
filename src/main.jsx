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
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Stethoscope,
  Sun,
  Timer,
  Upload,
  UserPlus,
  Volume2,
  Zap
} from 'lucide-react';
import './styles.css';

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
  { id: 'engines', label: 'Engines', icon: Brain, hint: 'DentalOS', prompt: 'Run specialized DentalOS engines for gaps, differentials, protocols, cases, visuals, memory, radiology, and professor workflows.' },
  { id: 'clinic', label: 'Clinic Lab', icon: ClipboardList, hint: 'future', prompt: 'Prototype professor and clinic workflows for observation, feedback, OSCEs, and clinical issue identification.' },
  { id: 'kit', label: 'Study Kit', icon: Library, hint: 'notes & cards', prompt: 'Saved notes, generated flashcards, exports, and review material.' }
];

const sidebarItems = [
  { page: 'dashboard', label: 'Home', icon: Home, hint: 'command' },
  { page: 'explanation', label: 'Study', icon: BookOpen, hint: 'learn' },
  { page: 'mastery', label: 'Subjects', icon: Layers, hint: 'maps' },
  { page: 'clinic', label: 'Cases', icon: Stethoscope, hint: 'simulator' },
  { page: 'engines', label: 'Questions', icon: CircleHelp, hint: 'engines' },
  { page: 'kit', label: 'Flashcards', icon: BookmarkPlus, hint: 'review' },
  { page: 'engines', label: 'Radiology', icon: Activity, hint: 'x-rays' },
  { page: 'library', label: 'Notes & Books', icon: Library, hint: 'sources' },
  { page: 'mastery', label: 'Progress', icon: LineChart, hint: 'analytics' },
  { page: 'test', label: 'Exams', icon: FileQuestion, hint: 'practice' },
  { page: 'answer', label: 'AI Tutor', icon: Brain, hint: 'professor' },
  { page: 'summary', label: 'Dictionary', icon: FileText, hint: 'terms' },
  { page: 'clinic', label: 'Settings', icon: Settings, hint: 'studio' }
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
  { id: 'knowledgeGap', title: 'Knowledge Gap Detector', icon: Brain, copy: 'Find missing prerequisites, misconceptions, and confused concepts before they become exam errors.' },
  { id: 'differentialDiagnosis', title: 'Differential Diagnosis', icon: ClipboardList, copy: 'Compare similar conditions by clinical, radiographic, histologic, and exam-distinguishing features.' },
  { id: 'treatmentProtocol', title: 'Treatment Protocol', icon: CheckCircle2, copy: 'Build safe educational protocols with steps, materials, errors, contraindications, complications, and follow-up.' },
  { id: 'examinerQuestions', title: 'Examiner Engine', icon: FileQuestion, copy: 'Generate MCQs, oral questions, board-style prompts, practical stations, and marking rubrics.' },
  { id: 'clinicalCase', title: 'Case Simulator', icon: MessageCircleQuestion, copy: 'Practice anamnesis, findings, imaging clues, differentials, treatment discussion, prognosis, and debrief.' },
  { id: 'visualLearning', title: 'Visual Learning', icon: LayoutDashboard, copy: 'Turn topics into flowcharts, decision trees, diagnostic pathways, comparison tables, and memory maps.' },
  { id: 'memoryPlan', title: 'Memory Engine', icon: BookmarkPlus, copy: 'Create spaced repetition schedules, flashcard clusters, mnemonics, pearls, and retention checklists.' },
  { id: 'radiologyChecklist', title: 'Radiology Learning', icon: FileText, copy: 'Train interpretation checklists for periapicals, bitewings, OPG, CBCT, and clinical photos.' },
  { id: 'professorStudio', title: 'Professor Studio', icon: GraduationCap, copy: 'Create objectives, OSCEs, rubrics, class misconception maps, and remediation activities.' }
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

  return (
    <div className={mode === 'test' ? 'answer-content test-answer' : 'answer-content'}>
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return <ResponseTable key={`table-${index}`} lines={block.lines} />;
        }

        const line = block.line;
        const heading = line.replace(/^#{1,6}\s*/, '');
        const numbered = heading.match(/^(\d+)\.\s+(.*)/);
        const bullet = heading.match(/^[-*]\s+(.*)/);
        const isHeading =
          /^#{1,6}\s/.test(line) ||
          (/^[A-Z][^.!?]{2,48}:$/.test(heading) && !numbered) ||
          (mode === 'test' && /question|answer|rubric|explanation|challenge|case|vignette/i.test(heading));

        if (numbered) {
          return (
            <div className="answer-row numbered" key={`${line}-${index}`}>
              <span>{numbered[1]}</span>
              <p>
                <InlineText text={numbered[2]} />
              </p>
            </div>
          );
        }

        if (bullet) {
          return (
            <div className="answer-row bullet" key={`${line}-${index}`}>
              <span></span>
              <p>
                <InlineText text={bullet[1]} />
              </p>
            </div>
          );
        }

        if (isHeading) {
          return (
            <h3 key={`${line}-${index}`}>
              <InlineText text={heading.replace(/:$/, '')} />
            </h3>
          );
        }

        return (
          <p key={`${line}-${index}`}>
            <InlineText text={heading} />
          </p>
        );
      })}
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
    prompt: 'Answer this like a dental professor: include the direct answer, source-grounded reasoning, knowledge gaps, related concepts, common mistakes, and exam pearls.'
  },
  summary: {
    title: 'Structured Study Builder',
    subtitle: 'Convert the source into high-yield notes, tables, clinical checklists, and active recall.',
    cards: [
      ['Core map', 'Build the topic hierarchy without deleting classifications or criteria.'],
      ['Tables', 'Use comparison tables for diseases, tests, materials, criteria, and protocols.'],
      ['Recall', 'End with active-recall prompts and a 60-second recap.']
    ],
    prompt: 'Create a structured dental study summary with tables, clinical relevance, exam traps, active recall, and a 60-second recap.'
  },
  explanation: {
    title: 'Seven-Level Explanation Lab',
    subtitle: 'Move from simple explanation to clinical reasoning without cutting important details.',
    cards: [
      ['Level 1-2', 'Plain explanation and dental student version.'],
      ['Level 3-4', 'Detailed textbook mechanism and clinical application.'],
      ['Level 5-7', 'Examiner answer, board review, and expert decision-making.']
    ],
    prompt: 'Explain this topic at levels 1 through 7: simple, student, detailed textbook, clinical application, examiner answer, board review, and expert clinical reasoning.'
  },
  test: {
    title: 'Examiner Simulation',
    subtitle: 'Practice oral exams, MCQs, OSCE tasks, grading rubrics, and remediation.',
    cards: [
      ['Oral exam', 'Ask sequential questions and wait for the student answer.'],
      ['Rubric', 'Grade with criteria, marks, feedback, and critical errors.'],
      ['Remediation', 'Generate targeted drills for weak points.']
    ],
    prompt: 'Start an examiner-style dental test with oral questions, a clinical vignette, a marking rubric table, critical errors, and adaptive remediation.'
  }
};

const anatomyStructures = [
  { id: 'crown', label: 'Crown', detail: 'Visible tooth structure above the gingival margin. It protects inner tissues and carries occlusal forces.', points: ['Includes enamel-covered functional surfaces', 'Shape guides mastication and contacts', 'Common site for caries and fractures'], related: ['Occlusion', 'Caries progression', 'Crown fractures'] },
  { id: 'enamel', label: 'Enamel', detail: 'Highly mineralized outer tissue that resists wear but cannot regenerate once lost.', points: ['Hardest tissue in the body', 'Demineralizes during early caries', 'Bonding depends on etched prism structure'], related: ['White spot lesions', 'Fluoride', 'Etch and bond'] },
  { id: 'dentin', label: 'Dentin', detail: 'Dentin forms the bulk of the tooth and contains tubules extending toward the pulp.', points: ['Less mineralized than enamel', 'Contains dentinal tubules', 'Sensitive to stimuli'], related: ['Pulp anatomy', 'Dentin hypersensitivity', 'Caries progression'] },
  { id: 'pulp', label: 'Pulp Chamber', detail: 'Neurovascular core responsible for vitality, pain signaling, and reparative dentin formation.', points: ['Contains vessels and nerves', 'Inflammation causes pulpitis', 'Requires careful endodontic access'], related: ['Pulpitis', 'Endodontics', 'Pain diagnosis'] },
  { id: 'root', label: 'Root Canal', detail: 'Canal pathway carrying pulp tissue through the root to the apical foramen.', points: ['Complex anatomy is common', 'Cleaning and shaping require length control', 'Missed canals cause failure'], related: ['Working length', 'Irrigation', 'Obturation'] },
  { id: 'cementum', label: 'Cementum', detail: 'Root surface tissue that anchors periodontal ligament fibers.', points: ['Covers root dentin', 'Supports attachment fibers', 'Exposed surfaces are vulnerable to root caries'], related: ['Root caries', 'Periodontium', 'Attachment loss'] },
  { id: 'periodontal', label: 'Periodontal Ligament', detail: 'Fibrous ligament between cementum and alveolar bone that absorbs forces and provides proprioception.', points: ['Suspends the tooth in bone', 'Widening may indicate inflammation or trauma', 'Essential for mobility assessment'], related: ['Periapical lesions', 'Mobility', 'Periodontitis'] },
  { id: 'apex', label: 'Apical Foramen', detail: 'Opening at the root apex where neurovascular supply enters and exits.', points: ['Key landmark for endodontic length', 'Periapical disease often centers here', 'Anatomy may vary'], related: ['Apical periodontitis', 'Working length', 'Radiographic apex'] }
];

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
        <button type="button" onClick={() => submitStudy(workflow.prompt)} disabled={!studySet || !!busy}>
          Start workflow
        </button>
      </div>
      <div className="mode-workflow-grid">
        {workflow.cards.map(([title, copy]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{copy}</span>
          </article>
        ))}
      </div>
      <div className="mode-action-strip">
        <button type="button" onClick={() => createArtifact('conceptMap')} disabled={!studySet || !!busy}>Concept map</button>
        <button type="button" onClick={() => createArtifact('weakQuiz')} disabled={!studySet || !!busy}>Weak quiz</button>
        <button type="button" onClick={() => createArtifact('flashcards')} disabled={!studySet || !!busy}>Flashcards</button>
        <button type="button" onClick={() => navigate('library')}>Source library</button>
      </div>
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
            placeholder="Search topics, questions, cases..."
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                submitStudy(`Teach me about ${event.currentTarget.value.trim()} with exam pearls, clinical relevance, and common mistakes.`);
                event.currentTarget.value = '';
              }
            }}
          />
        </label>
        <div className="mode-switch" aria-label="Study role">
          <span>Study Mode</span>
          <button type="button" className="active">Professor</button>
          <button type="button" onClick={() => navigate('test')}>Examiner</button>
        </div>
        <div className="top-icons">
          <button type="button" title="Notifications"><Bell size={17} /></button>
          <button type="button" title="Settings"><Settings size={17} /></button>
        </div>
      </div>

      <div className="command-greeting">
        <div>
          <h2>Good morning, {firstName}.</h2>
          <p>What would you like to master today?</p>
        </div>
        <button type="button" onClick={() => navigate(studySet ? 'answer' : 'library')}>
          <Sparkles size={17} />
          {studySet ? 'Continue source' : 'Add study source'}
        </button>
      </div>

      {!hasSource && (
        <div className="command-actions intake-actions">
          {commandActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.title} type="button" onClick={() => runAction(action)}>
                <span><Icon size={23} /></span>
                <strong>{action.title}</strong>
                <small>{action.subtitle}</small>
              </button>
            );
          })}
        </div>
      )}

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
          <span>Building from: {sourceName}</span>
        </div>
      )}

      {hasSource && (
        <article className="focus-picker glass-panel">
          <div className="panel-title">
            <div>
              <strong>Choose the study focus</strong>
              <span>Actions use the selected subject. Or let the professor suggest focus areas from the source.</span>
            </div>
            <button type="button" onClick={() => submitStudy('Inspect this source and suggest 3 high-yield dental study focus areas. Ask me which one to use next.')} disabled={!studySet || !!busy}>
              AI choose
            </button>
          </div>
          <div className="subject-picker compact">
            {dentalSubjects.map((subject) => (
              <button key={subject} type="button" className={selectedSubject === subject ? 'active' : ''} onClick={() => setSelectedSubject(subject)}>
                {subject}
              </button>
            ))}
          </div>
        </article>
      )}

      {hasSource && <div className="command-layout">
        <div className="command-main">
          <div className="command-actions">
            {commandActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.title} type="button" onClick={() => runAction(action)}>
                  <span><Icon size={23} /></span>
                  <strong>{action.title}</strong>
                  <small>{action.subtitle}</small>
                </button>
              );
            })}
          </div>

          <div className="analytics-panel glass-panel">
            <div className="panel-title">
              <strong>Your Progress</strong>
              <span>View all</span>
            </div>
            <RingProgress value={Math.max(12, masteryModel.average)} label="Overall progress" />
            <div className="trend-card">
              <strong>Progress Over Time</strong>
              <div className="trend-bars">
                {[28, 41, 36, 52, 67, 58, 77, 90].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
              </div>
              <div className="trend-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
            </div>
            <div className="subject-stack">
              <strong>Top Subjects</strong>
              {topSubjects.map((subject) => (
                <div key={subject.label} className="subject-row">
                  <span>{subject.label}</span>
                  <meter min="0" max="100" value={subject.score}></meter>
                  <em>{subject.score}%</em>
                </div>
              ))}
            </div>
          </div>
        </div>

        <article className="anatomy-panel glass-panel">
          <div className="panel-title">
            <div>
              <strong>Interactive Tooth Anatomy</strong>
              <span>Explore every part in 3D-style layers</span>
            </div>
            <button type="button" onClick={() => setSelectedStructure('dentin')}>Reset</button>
          </div>
          <div className="anatomy-workspace">
            <div className="anatomy-tabs">
              {anatomyStructures.map((item) => (
                <button key={item.id} type="button" className={selectedStructure === item.id ? 'active' : ''} onClick={() => setSelectedStructure(item.id)}>
                  <Layers size={15} />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="tooth-stage">
              <img src="/dentalos/tooth-anatomy.svg" alt="Cross-section illustration of molar tooth anatomy" />
              <span className={`anatomy-hotspot hotspot-${structure.id}`}>{structure.label}</span>
            </div>
            <div className="structure-card">
              <strong>{structure.label}</strong>
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
      </div>}

      {hasSource && <div className="command-lower">
        <article className="case-simulator glass-panel">
          <div className="panel-title">
            <div><strong>Clinical Case Simulator</strong><span>Learn by solving real-life cases</span></div>
            <button type="button" onClick={() => createArtifact('clinicalCase')} disabled={!studySet || !!busy}>Generate</button>
          </div>
          <div className="case-steps">
            {caseSteps.map((step, index) => (
              <button type="button" key={step} className={activeCaseStep === index ? 'active' : ''} onClick={() => setActiveCaseStep(index)}>
                {index + 1}. {step}
              </button>
            ))}
          </div>
          <div className="case-body">
            <img src="/dentalos/patient-avatar.svg" alt="Dental case patient avatar" />
            <div>
              <h3>{caseStageCopy[activeCaseStep][0]}</h3>
              <p>{caseStageCopy[activeCaseStep][1]}</p>
              <p><strong>Current focus:</strong> {focusSubject}</p>
            </div>
            <div className="case-actions">
              <button type="button" onClick={() => submitStudy(`Give hints for the ${caseSteps[activeCaseStep]} stage of a ${focusSubject} clinical case. Do not reveal the final answer.`)}>Ask for hints</button>
              <button type="button" onClick={() => createArtifact('differentialDiagnosis')}>Differential diagnosis</button>
              <button type="button" onClick={() => submitStudy(`For the ${caseSteps[activeCaseStep]} stage, list the next questions a dental student should ask and why.`)}>What to ask next?</button>
            </div>
          </div>
          <button type="button" className="primary-chip" onClick={() => createArtifact('clinicalCase')} disabled={!studySet || !!busy}>Next step</button>
        </article>

        <article className="xray-panel glass-panel">
          <div className="panel-title">
            <div><strong>X-Ray Interpreter</strong><span>Step-by-step interpretation</span></div>
            <button type="button" onClick={() => createArtifact('radiologyChecklist')} disabled={!studySet || !!busy}>Checklist</button>
          </div>
          <div className="xray-body">
            <img src="/dentalos/bitewing-xray.svg" alt="Educational bitewing radiograph illustration" />
            <div className="xray-checklist">
              {xraySteps.map((item, index) => (
                <button key={item} type="button" className={activeXrayStep === index ? 'active' : ''} onClick={() => setActiveXrayStep(index)}>
                  {index + 1}. {item}<CheckCircle2 size={13} />
                </button>
              ))}
            </div>
          </div>
          <div className="pathology-findings">
            <strong>{xraySteps[activeXrayStep]} checklist</strong>
            <p>Use this step to describe observable radiographic signs, then ask for differential diagnosis guidance. Final clinical diagnosis requires dentist review.</p>
          </div>
        </article>

        <article className="topic-panel glass-panel">
          <div className="topic-nav">
            {topicTabs.map((tab) => <button key={tab.id} type="button" className={selectedTab === tab.id ? 'active' : ''} onClick={() => setSelectedTab(tab.id)}>{tab.label}</button>)}
          </div>
          <div className="topic-heading">
            <h3>{selectedSubject || 'Source'} Knowledge Engine</h3>
            <div className="level-switch">
              {explanationLevels.map((level, index) => <button key={level} type="button" title={level} className={learningLevel === index + 1 ? 'active' : ''} onClick={() => setLearningLevel(index + 1)}>{index + 1}</button>)}
            </div>
          </div>
          <div className="topic-content">
            <strong>{explanationLevels[learningLevel - 1]} explanation</strong>
            <p>{topicTab.body}</p>
          </div>
          <div className="treatment-path">
            {treatmentSteps.map((step, index) => (
              <button key={step} type="button" className={activeTreatmentStep === index ? 'active' : ''} onClick={() => setActiveTreatmentStep(index)}>
                <ShieldCheck size={16} />{step}
              </button>
            ))}
          </div>
          <div className="protocol-note">
            <strong>{treatmentSteps[activeTreatmentStep]}</strong>
            <span>Ask the protocol engine to expand this section with source-grounded criteria, materials, contraindications, complications, and follow-up.</span>
          </div>
          <div className="topic-actions">
            <button type="button" onClick={() => createArtifact('differentialDiagnosis')} disabled={!studySet || !!busy}>Differential diagnosis</button>
            <button type="button" onClick={() => createArtifact('radiologyChecklist')} disabled={!studySet || !!busy}>Radiographic findings</button>
            <button type="button" onClick={() => createArtifact('examinerQuestions')} disabled={!studySet || !!busy}>Exam pearls</button>
          </div>
        </article>
      </div>}

      {hasSource && <div className="command-bottom">
        <article className="flash-panel glass-panel">
          <div className="panel-title"><strong>Flashcards</strong><span>{flashcards.length ? `1/${flashcards.length}` : 'Create cards'}</span></div>
          <div className={previewCardRevealed ? 'flash-preview revealed' : 'flash-preview'} role="button" tabIndex={0} onClick={() => setPreviewCardRevealed((value) => !value)}>
            <strong>{previewCard?.question || 'No real cards yet. Generate source-grounded flashcards first.'}</strong>
            <span>{previewCardRevealed && previewCard ? previewCard.answer : 'Click to reveal answer'}</span>
          </div>
          <button type="button" onClick={() => createArtifact('flashcards')} disabled={!studySet || !!busy}>Build cards</button>
        </article>

        <article className="mcq-panel glass-panel">
          <div className="panel-title"><strong>MCQ Practice</strong><span><Timer size={14} /> Exam mode</span></div>
          <p>{mcqData ? mcqData.question : 'No generated MCQ is loaded here yet. Generate an examiner set from the active source, then answer it in this panel.'}</p>
          {mcqData?.options.map((option) => (
            <button key={option.key} type="button" className={selectedMcq === option.key ? 'selected' : ''} onClick={() => setSelectedMcq(option.key)}>
              {option.key}. {option.text}
            </button>
          ))}
          {selectedMcq && <span className="mcq-feedback">Selected: {selectedMcq}. Use the examiner result below to compare your reasoning, not just the letter.</span>}
          <button type="button" className="primary-chip" onClick={() => createArtifact('examinerQuestions')} disabled={!studySet || !!busy}>Generate MCQs</button>
        </article>

        <article className="weak-panel glass-panel">
          <div className="panel-title"><strong>Weak Areas</strong><button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>Plan</button></div>
          {weakAreas.map((area) => (
            <div key={area.label} className="weak-row">
              <span>{area.label}</span>
              <meter min="0" max="100" value={area.score}></meter>
              <em>{area.score}%</em>
            </div>
          ))}
          <RingProgress value={45} label="Focus more" className="danger-ring" />
        </article>

        <article className="professor-panel glass-panel">
          <div className="panel-title"><strong>AI Tutor</strong><span>Professor mode</span></div>
          <div className="professor-message"><p>Ask a source-grounded professor question, then request tables, common mistakes, and exam pearls.</p></div>
          <div className="professor-answer">
            <strong>Expected answer structure</strong>
            <p>Direct answer, diagnostic criteria, differentials, treatment protocol, complications, prognosis, and board-style traps. No critical information should be removed.</p>
          </div>
          <button type="button" onClick={() => submitStudy(`Explain ${focusSubject} with comparison tables where useful, diagnostic criteria, clinical clues, treatment logic, complications, prognosis, common mistakes, and exam pearls.`)} disabled={!studySet || !!busy}>
            <Send size={16} />
            Ask professor
          </button>
        </article>
      </div>}
    </section>
  );
}

function App() {
  const [files, setFiles] = useState([]);
  const [studySet, setStudySet] = useState(null);
  const [mode, setMode] = useState('answer');
  const [page, setPage] = useState('dashboard');
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

          {page !== 'dashboard' && <section className="page-intro">
            <div className="page-icon">
              <ActivePageIcon size={20} />
            </div>
            <div>
              <h2>{activePage.label}</h2>
              <p>{activePage.prompt}</p>
            </div>
          </section>}

          {page !== 'dashboard' && <div className="quick-actions">
            {modes.some((item) => item.id === page) && (
              <button type="button" onClick={() => submitStudy(activePage.prompt, { speak: conversationMode })} disabled={!studySet || !!busy}>
                Start {activePage.label}
              </button>
            )}
            <button type="button" onClick={() => navigate('library')}>
              Library
            </button>
            <button type="button" onClick={() => submitStudy('Summarize this source for a dental exam.', { speak: conversationMode })} disabled={!studySet || !!busy}>
              Summarize source
            </button>
            <button type="button" onClick={() => submitStudy('Explain dental caries from this source in a clear study-friendly way.', { speak: conversationMode })} disabled={!studySet || !!busy}>
              Explain caries
            </button>
            <button type="button" onClick={() => createArtifact('flashcards')} disabled={!studySet || !!busy}>
              Make flashcards
            </button>
            <button type="button" onClick={() => createArtifact('caseStudy')} disabled={!studySet || !!busy}>
              Case study
            </button>
            <button type="button" onClick={() => createArtifact('osce')} disabled={!studySet || !!busy}>
              OSCE station
            </button>
            <button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>
              Rescue plan
            </button>
            <button type="button" onClick={() => createArtifact('mnemonics')} disabled={!studySet || !!busy}>
              Mnemonics
            </button>
            <button type="button" onClick={() => submitStudy('Start a creative oral exam from this source. Ask useful questions and include answer rubrics.', { speak: conversationMode })} disabled={!studySet || !!busy}>
              Start oral test
            </button>
          </div>}

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
                <form className="upload-zone library-upload" onSubmit={uploadPdfs}>
                  <Upload size={22} />
                  <label htmlFor="pdfs">Upload dental PDFs</label>
                  <input
                    id="pdfs"
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={(event) => setFiles(Array.from(event.target.files || []))}
                  />
                  <button type="submit" disabled={!files.length || busy === 'upload'}>
                    {busy === 'upload' ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                    Index PDFs
                  </button>
                </form>
                <form className="upload-zone text-source-zone" onSubmit={indexTextSource}>
                  <FileText size={22} />
                  <label htmlFor="text-source">Index pasted study text</label>
                  <input
                    id="text-source-title"
                    value={textSourceTitle}
                    onChange={(event) => setTextSourceTitle(event.target.value)}
                    placeholder="Title, e.g. Caries prevention lecture"
                  />
                  <textarea
                    id="text-source"
                    rows={7}
                    value={textSource}
                    onChange={(event) => setTextSource(event.target.value)}
                    placeholder="Paste lecture notes, a rubric, a professor handout, or a clinic protocol..."
                  />
                  <button type="submit" disabled={textSource.trim().length < 80 || busy === 'upload'}>
                    {busy === 'upload' ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                    Index Text
                  </button>
                </form>
                <div className="kit-section">
                  <div className="section-title">
                    <Library size={18} />
                    <h3>Indexed Material</h3>
                  </div>
                  {studySet ? (
                    <div className="file-list">
                      {studySet.files.map((file) => (
                        <div key={file.fileId}>
                          <FileText size={17} />
                          <span>{file.originalName}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Upload PDFs or paste text to create a study set.</p>
                  )}
                </div>
              </section>
            ) : page === 'mastery' ? (
              <section className="mastery-page">
                <div className="mastery-hero">
                  <div>
                    <p>Adaptive Dentistry Engine</p>
                    <h3>{masteryModel.average}% readiness</h3>
                    <span>{masteryModel.weakest.map((item) => item.topic).join(' and ') || 'Upload material to start the map'} are least covered right now.</span>
                  </div>
                  <button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>
                    Build rescue plan
                  </button>
                </div>
                <div className="mastery-grid">
                  {masteryModel.domains.map((domain) => (
                    <article key={domain.topic} className="mastery-card">
                      <div>
                        <strong>{domain.topic}</strong>
                        <span>{domain.relatedCards} related cards, {domain.reviewed} reviewed</span>
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
                <div className="mastery-hero engines-hero">
                  <div>
                    <p>DentalOS Command Center</p>
                    <h3>Specialized engines for learning, exams, clinical reasoning, and professor workflows.</h3>
                    <span>Each engine preserves critical dental detail and restructures it into tables, rubrics, pathways, charts, and review loops.</span>
                  </div>
                  <button type="button" onClick={() => createArtifact('knowledgeGap')} disabled={!studySet || !!busy}>
                    Run gap scan
                  </button>
                </div>
                <div className="engine-grid">
                  {dentalosEngines.map((engine) => {
                    const Icon = engine.icon;
                    return (
                      <article key={engine.id} className="engine-card">
                        <Icon size={22} />
                        <strong>{engine.title}</strong>
                        <span>{engine.copy}</span>
                        <button type="button" onClick={() => createArtifact(engine.id)} disabled={!studySet || !!busy}>
                          Run engine
                        </button>
                      </article>
                    );
                  })}
                </div>
                <div className="kit-section">
                  <div className="section-title">
                    <CheckCircle2 size={18} />
                    <h3>Safety Contract</h3>
                  </div>
                  <div className="safety-grid">
                    <span>No autonomous diagnosis</span>
                    <span>No autonomous treatment planning</span>
                    <span>Source-grounded educational support</span>
                    <span>Dentist review for future clinical outputs</span>
                  </div>
                </div>
              </section>
            ) : page === 'clinic' ? (
              <section className="clinic-page">
                <div className="clinic-hero">
                  <div>
                    <p>Future Product Line</p>
                    <h3>Student tutor today. Professor and clinic intelligence tomorrow.</h3>
                    <span>Design the system around observable findings, educational feedback, evidence capture, and safe escalation rather than unsupported diagnosis.</span>
                  </div>
                </div>
                <div className="clinic-grid">
                  <article>
                    <ClipboardList size={22} />
                    <strong>Professor OSCE Builder</strong>
                    <span>Create stations, patient scripts, examiner prompts, rubrics, and remediation loops from course material.</span>
                    <button type="button" onClick={() => createArtifact('osce')} disabled={!studySet || !!busy}>Generate OSCE</button>
                  </article>
                  <article>
                    <CheckCircle2 size={22} />
                    <strong>Clinical Observation Checklist</strong>
                    <span>Turn topics into observable signs, evidence requirements, red flags, and teaching feedback.</span>
                    <button type="button" onClick={() => createArtifact('clinicalVisionChecklist')} disabled={!studySet || !!busy}>Build checklist</button>
                  </article>
                  <article>
                    <Brain size={22} />
                    <strong>Adaptive Remediation</strong>
                    <span>Convert weak answers into targeted drills, confidence checks, and spaced review plans.</span>
                    <button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>Create plan</button>
                  </article>
                  <article>
                    <GraduationCap size={22} />
                    <strong>Professor Studio</strong>
                    <span>Generate objectives, rubrics, OSCE stations, weak-concept maps, and remediation activities.</span>
                    <button type="button" onClick={() => createArtifact('professorStudio')} disabled={!studySet || !!busy}>Open studio</button>
                  </article>
                </div>
                <div className="kit-section">
                  <div className="section-title">
                    <Sparkles size={18} />
                    <h3>North Star</h3>
                  </div>
                  <p className="muted">Build a dentistry knowledge operating system: student mastery, professor assessment, and clinic observation tools that translate existing dental knowledge into repeatable, auditable workflows.</p>
                </div>
              </section>
            ) : page === 'kit' ? (
              <section className="kit-page">
                <div className="kit-toolbar">
                  <button type="button" onClick={() => createArtifact('notes')} disabled={!studySet || !!busy}>
                    <FileText size={17} />
                    Make notes
                  </button>
                  <button type="button" onClick={() => createArtifact('flashcards')} disabled={!studySet || !!busy}>
                    <BookmarkPlus size={17} />
                    Make cards
                  </button>
                  <button type="button" onClick={() => createArtifact('weakQuiz')} disabled={!studySet || !!busy}>
                    <FileQuestion size={17} />
                    Weak quiz
                  </button>
                  <button type="button" onClick={() => createArtifact('caseStudy')} disabled={!studySet || !!busy}>
                    <ClipboardList size={17} />
                    Case
                  </button>
                  <button type="button" onClick={() => createArtifact('osce')} disabled={!studySet || !!busy}>
                    <ClipboardList size={17} />
                    OSCE
                  </button>
                  <button type="button" onClick={() => createArtifact('adaptivePlan')} disabled={!studySet || !!busy}>
                    <CheckCircle2 size={17} />
                    Rescue
                  </button>
                  <button type="button" onClick={() => createArtifact('curriculumMap')} disabled={!studySet || !!busy}>
                    <Brain size={17} />
                    Map
                  </button>
                  <button type="button" onClick={() => createArtifact('mnemonics')} disabled={!studySet || !!busy}>
                    <Brain size={17} />
                    Mnemonics
                  </button>
                  <button type="button" onClick={exportMarkdown} disabled={!chat.length && !notes && !flashcards.length}>
                    <Download size={17} />
                    Markdown
                  </button>
                  <button type="button" onClick={exportAnki} disabled={!flashcards.length}>
                    <Download size={17} />
                    Anki TSV
                  </button>
                  <button type="button" className="danger-action" onClick={clearSession}>
                    Clear
                  </button>
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
                      <article className={revealedCards[activeCard.id] ? 'flash-trainer revealed' : 'flash-trainer'}>
                        <div className="flash-trainer-top">
                          <span>Card {activeCardIndex + 1} of {flashcards.length}</span>
                          <strong>{masteryModel.dueCards.length} due now</strong>
                        </div>
                        <h4>{activeCard.question}</h4>
                        {revealedCards[activeCard.id] ? (
                          <p>{activeCard.answer}</p>
                        ) : (
                          <button type="button" className="reveal-card" onClick={() => toggleCard(activeCard.id)}>
                            Reveal answer
                          </button>
                        )}
                        <div className="trainer-actions">
                          <button type="button" onClick={() => setActiveCardIndex((index) => Math.max(0, index - 1))}>Previous</button>
                          <button type="button" onClick={() => toggleCard(activeCard.id)}>
                            {revealedCards[activeCard.id] ? 'Hide' : 'Show'}
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
const root = window.__SIMAV_DENTAL_ROOT__ || createRoot(rootElement);
window.__SIMAV_DENTAL_ROOT__ = root;
root.render(<App />);
