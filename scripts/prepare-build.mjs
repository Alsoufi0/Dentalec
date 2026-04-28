import fs from 'node:fs';

const mainPath = 'src/main.jsx';
const stylesPath = 'src/styles.css';
let main = fs.readFileSync(mainPath, 'utf8');

if (main.includes('const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];') && !main.includes('const ActiveIcon = active.icon;')) {
  main = main.replace(
    'const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];\n  return <main',
    'const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];\n  const ActiveIcon = active.icon;\n  return <main'
  );
}

main = main.replaceAll('<active.icon />', '<ActiveIcon />');

main = main.replace(
  '<div className="guide"><span>1. Upload dental PDFs</span><span>2. Create a visual summary</span><span>3. Add flashcards, concept maps, and checklists</span><span>4. Finish with test mode or teach-back</span></div>',
  '<div className="guide clear-guide"><span><b>1</b><strong>Upload</strong><em>Add one chapter, lecture, or handout PDF.</em></span><span><b>2</b><strong>Understand</strong><em>Open Visual Summary or Explain for the main ideas.</em></span><span><b>3</b><strong>Memorize</strong><em>Create flashcards, mnemonics, and a checklist.</em></span><span><b>4</b><strong>Perform</strong><em>Use Case Study or Oral Test until you can answer aloud.</em></span></div>'
);

main = main.replace(
  '<section className="stats"><span>{stats.questions}<b>Questions</b></span><span>{stats.answers}<b>Tutor answers</b></span><span>{stats.cards}<b>Flashcards</b></span></section><section className="card"><h3>Premium Add-ons</h3>',
  '<section className="stats"><span>{stats.questions}<b>Questions</b></span><span>{stats.answers}<b>Tutor answers</b></span><span>{stats.cards}<b>Flashcards</b></span></section><section className="smart-guide-panel"><div><strong>Best study path</strong><span>1. Visual Summary</span><span>2. Concept Map</span><span>3. Flashcards</span><span>4. Oral Test</span></div><p>Use Q&A for exact PDF questions, Study Kit for saved review material, and the microphone when you want to explain out loud.</p></section><section className="card"><h3>Premium Add-ons</h3>'
);

const visualFmt = String.raw`function fmt(text = '') {
  const sectionTitles = /^(Core Idea|Visual Structure Map|High-Yield Facts|Clinical Relevance|Key Terms|Common Confusions|Exam Traps|Chairside Checklist|Active-Recall Questions|60-Second Recap|Patient Snapshot|Chief Complaint|Key Findings|Diagnostic Clues|Three Questions|Answer Key|Teaching Pearl|Center Concept|Branches|Mechanism Flow|Clinical Links|What To Memorize|Concept Map(?:\s*\([^)]*\))?|Before You Start|Look For|Decision Points|Red Flags|Common Mistakes|Similar Terms|False Friends|Rapid Review|30-Second Version|2-Minute Version|Self-Check|Questions A Professor May Ask|Whiteboard Flow|Follow-Up Questions)$/i;
  const normalize = (line) => clean(line)
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^\|+\s*/, '')
    .replace(/^[-|\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const isHeading = (line) => {
    const title = line.replace(/:$/, '').trim();
    if (sectionTitles.test(title)) return true;
    if (/[→]|->|=/.test(title)) return false;
    return /:$/.test(line) && title.length <= 42 && title.split(' ').length <= 6;
  };
  const displayTitle = (line) => line.replace(/:$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  const lines = clean(text).split('\n').map(normalize).filter(Boolean);
  const sections = [];
  let current = { title: 'Study Snapshot', items: [] };
  for (const line of lines) {
    if (isHeading(line)) {
      if (current.items.length) sections.push(current);
      current = { title: displayTitle(line), items: [] };
    } else {
      current.items.push(line);
    }
  }
  if (current.items.length) sections.push(current);

  const kindFor = (title) => {
    const t = title.toLowerCase();
    if (t.includes('flow') || t.includes('map') || t.includes('branches')) return 'flow';
    if (t.includes('checklist') || t.includes('before') || t.includes('look for') || t.includes('decision') || t.includes('red flag')) return 'check';
    if (t.includes('trap') || t.includes('mistake') || t.includes('false') || t.includes('confusion') || t.includes('similar')) return 'trap';
    if (t.includes('recall') || t.includes('question') || t.includes('self-check')) return 'recall';
    if (t.includes('clinical') || t.includes('patient') || t.includes('chief') || t.includes('findings')) return 'clinical';
    if (t.includes('center concept') || t.includes('core idea')) return 'core';
    return 'note';
  };
  const hasArrow = (item) => item.includes('->') || item.includes('→');

  const renderFlowRows = (items, keyPrefix) => {
    const rows = items.filter(hasArrow).slice(0, 5);
    return <div className="flow-stack">{rows.map((row, rowIndex) => {
      const parts = row.split(/\s*(?:->|→)\s*/).map((part) => part.replace(/^\|+\s*/, '').trim()).filter(Boolean).slice(0, 8);
      return <div className="flow-lane" key={keyPrefix + '-flow-' + rowIndex}>{parts.map((part, index) => <React.Fragment key={keyPrefix + '-' + rowIndex + '-' + part + '-' + index}><span>{part}</span>{index < parts.length - 1 && <b>→</b>}</React.Fragment>)}</div>;
    })}</div>;
  };

  const renderCards = (items, keyPrefix, limit = 6) => {
    const cleanItems = items.filter((item) => !hasArrow(item)).slice(0, 18);
    const visible = cleanItems.slice(0, limit);
    const hidden = cleanItems.slice(limit);
    return <>{visible.length > 0 && <div className="study-card-grid">{visible.map((item, itemIndex) => <article key={keyPrefix + '-card-' + itemIndex}><p>{item}</p></article>)}</div>}{hidden.length > 0 && <details className="more-details"><summary>{hidden.length} more study points</summary><div className="study-card-grid compact-cards">{hidden.map((item, itemIndex) => <article key={keyPrefix + '-more-' + itemIndex}><p>{item}</p></article>)}</div></details>}</>;
  };

  return <div className="visual-output">{sections.map((section, index) => {
    const kind = kindFor(section.title);
    const flowItems = section.items.filter(hasArrow);
    const cardItems = section.items.filter((item) => !hasArrow(item));
    return <section key={section.title + '-' + index} className={'study-block ' + kind}><div className="study-block-head"><span>{index + 1}</span><h4>{section.title}</h4></div>{flowItems.length > 0 && renderFlowRows(flowItems, section.title + '-' + index)}{cardItems.length > 0 && renderCards(cardItems, section.title + '-' + index, kind === 'core' || kind === 'clinical' ? 4 : 6)}</section>;
  })}</div>;
}
`;

const fmtStart = main.indexOf('function fmt(text = \'\') {');
const fmtEnd = main.indexOf('function key(user)', fmtStart);
if (fmtStart !== -1 && fmtEnd !== -1) {
  main = `${main.slice(0, fmtStart)}${visualFmt}${main.slice(fmtEnd)}`;
}

fs.writeFileSync(mainPath, main);

let styles = fs.readFileSync(stylesPath, 'utf8');
styles = styles.replace(/\/\* Build-time visual study upgrade \*\/[\s\S]*$/m, '').trimEnd();
const visualCss = String.raw`

/* Build-time visual study upgrade */
.study-hero {
  grid-template-columns: minmax(0, 1fr) 118px !important;
  min-height: 190px;
  background:
    radial-gradient(circle at 86% 22%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 28%),
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, var(--surface)), color-mix(in srgb, var(--blue) 8%, var(--surface))) !important;
}
.study-hero::after { opacity: .35; }
.study-orbit { justify-self: center !important; width: 106px !important; height: 106px !important; padding: 0; border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent); background: radial-gradient(circle, var(--surface) 0 58%, transparent 59%), conic-gradient(var(--primary) 0 var(--score, 74%), color-mix(in srgb, var(--primary) 16%, var(--surface)) var(--score, 74%) 100%) !important; box-shadow: var(--soft-shadow) !important; }
.study-orbit span { margin: 0 !important; color: var(--text) !important; font-size: 1.28rem !important; line-height: 1; }
.study-orbit small { margin-top: -24px; color: var(--muted) !important; font-size: .68rem; }
.learning-lane article, .addon-grid button, .stats span { border-radius: 10px !important; }
.addon-grid button { min-height: 118px !important; align-content: start; }
.clear-guide span { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 3px 9px; align-items: start; }
.clear-guide b { grid-row: span 2; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 999px; color: #fff; background: var(--primary); font-style: normal; }
.clear-guide strong { color: var(--text); }
.clear-guide em { color: var(--muted); font-style: normal; line-height: 1.35; }
.smart-guide-panel { display: grid; grid-template-columns: minmax(0, 1fr) 1.2fr; gap: 14px; align-items: center; padding: 15px 16px; border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border)); border-radius: 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 9%, var(--surface)), var(--surface)); box-shadow: var(--soft-shadow); }
.smart-guide-panel div { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.smart-guide-panel strong { width: 100%; color: var(--text); }
.smart-guide-panel span { display: inline-flex; align-items: center; min-height: 32px; padding: 6px 10px; border-radius: 999px; color: var(--text); background: var(--surface-3); font-weight: 800; }
.smart-guide-panel p { color: var(--muted); line-height: 1.45; }
.study-notes { gap: 18px !important; background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
.study-notes > h3 { padding: 0 4px; font-size: 1.3rem; }
.visual-output { display: grid; gap: 14px; }
.study-block { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, white), color-mix(in srgb, var(--primary) 5%, var(--surface))), var(--surface); box-shadow: var(--soft-shadow); }
.study-block-head { display: flex; align-items: center; gap: 10px; }
.study-block-head span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; color: #fff; background: var(--primary); font-size: .78rem; font-weight: 900; }
.study-block-head h4 { margin: 0 !important; color: var(--text) !important; font-size: 1.05rem !important; }
.study-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.study-card-grid article { min-height: 68px; padding: 12px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); box-shadow: none; }
.study-card-grid p { margin: 0 !important; color: var(--text) !important; line-height: 1.45; }
.study-block.core .study-card-grid, .study-block.clinical .study-card-grid { grid-template-columns: 1fr; }
.study-block.core { border-color: color-mix(in srgb, var(--primary) 34%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), var(--surface)); }
.study-block.trap .study-block-head span { background: var(--accent); }
.study-block.trap { border-color: color-mix(in srgb, var(--accent) 32%, var(--border)); }
.study-block.recall .study-block-head span { background: var(--blue); }
.study-block.check .study-block-head span { background: #237b4b; }
.flow-stack { display: grid; gap: 8px; }
.flow-lane { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 4px 0; }
.flow-lane span { display: inline-flex; align-items: center; max-width: min(100%, 360px); min-height: 34px; padding: 7px 10px; border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border)); border-radius: 999px; color: var(--text); background: color-mix(in srgb, var(--primary) 9%, var(--surface)); line-height: 1.25; overflow-wrap: anywhere; }
.flow-lane b { color: var(--primary); font-size: 1rem; }
.more-details { border: 1px dashed var(--border); border-radius: 10px; padding: 10px; background: color-mix(in srgb, var(--surface) 86%, var(--surface-3)); }
.more-details summary { cursor: pointer; color: var(--primary); font-weight: 850; }
.compact-cards { margin-top: 10px; }
.msg.assistant .visual-output { margin-top: 2px; }
.msg.assistant .study-block { box-shadow: none; }
:root[data-theme='dark'] .study-card-grid article, :root[data-theme='dark'] .study-block { background: #12201b; }
:root[data-theme='dark'] .flow-lane span { background: #17342d; }
@media (max-width: 900px) { .study-hero { grid-template-columns: 1fr !important; } .study-orbit { justify-self: start !important; } .study-card-grid, .smart-guide-panel { grid-template-columns: 1fr; } }
`;
styles += visualCss;
fs.writeFileSync(stylesPath, styles);
