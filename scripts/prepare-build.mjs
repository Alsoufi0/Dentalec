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

const visualFmt = String.raw`function fmt(text = '') {
  const sectionTitles = /^(Core Idea|Visual Structure Map|High-Yield Facts|Clinical Relevance|Key Terms|Common Confusions|Exam Traps|Chairside Checklist|Active-Recall Questions|60-Second Recap|Patient Snapshot|Chief Complaint|Key Findings|Diagnostic Clues|Three Questions|Answer Key|Teaching Pearl|Center Concept|Branches|Mechanism Flow|Clinical Links|What To Memorize|Before You Start|Look For|Decision Points|Red Flags|Common Mistakes|Similar Terms|False Friends|Rapid Review|30-Second Version|2-Minute Version|Self-Check|Questions A Professor May Ask|Whiteboard Flow|Follow-Up Questions)/i;
  const normalize = (line) => clean(line)
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^\|+\s*/, '')
    .replace(/^[-|\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const lines = clean(text).split('\n').map(normalize).filter(Boolean);
  const sections = [];
  let current = { title: 'Study Snapshot', items: [] };
  for (const line of lines) {
    const title = line.replace(/:$/, '');
    if (sectionTitles.test(title)) {
      if (current.items.length) sections.push(current);
      current = { title, items: [] };
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

  const renderFlow = (items, keyPrefix) => {
    const parts = items.join(' -> ').split(/\s*(?:->|→)\s*/).map((part) => part.replace(/^\|+\s*/, '').trim()).filter(Boolean);
    return <div className="flow-lane">{parts.map((part, index) => <React.Fragment key={keyPrefix + '-' + part + '-' + index}><span>{part}</span>{index < parts.length - 1 && <b>→</b>}</React.Fragment>)}</div>;
  };

  return <div className="visual-output">{sections.map((section, index) => {
    const kind = kindFor(section.title);
    const isFlow = kind === 'flow' || section.items.some((item) => item.includes('->') || item.includes('→'));
    return <section key={section.title + '-' + index} className={'study-block ' + kind}><div className="study-block-head"><span>{index + 1}</span><h4>{section.title}</h4></div>{isFlow ? renderFlow(section.items, section.title + '-' + index) : <div className="study-card-grid">{section.items.map((item, itemIndex) => <article key={item + '-' + itemIndex}><p>{item}</p></article>)}</div>}</section>;
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
const visualCss = String.raw`

/* Build-time visual study upgrade */
.study-hero {
  grid-template-columns: minmax(0, 1fr) 118px !important;
  min-height: 190px;
  background:
    radial-gradient(circle at 86% 22%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 28%),
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, var(--surface)), color-mix(in srgb, var(--blue) 8%, var(--surface))) !important;
}
.study-hero::after { opacity: .45; }
.study-orbit {
  justify-self: center !important;
  width: 106px !important;
  height: 106px !important;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
  background: radial-gradient(circle, var(--surface) 0 58%, transparent 59%), conic-gradient(var(--primary) 0 var(--score, 74%), color-mix(in srgb, var(--primary) 16%, var(--surface)) var(--score, 74%) 100%) !important;
  box-shadow: var(--soft-shadow) !important;
}
.study-orbit span { margin: 0 !important; color: var(--text) !important; font-size: 1.28rem !important; line-height: 1; }
.study-orbit small { margin-top: -24px; color: var(--muted) !important; font-size: .68rem; }
.learning-lane article, .addon-grid button, .stats span { border-radius: 10px !important; }
.addon-grid button { min-height: 126px !important; align-content: start; }
.study-notes { gap: 18px !important; background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
.study-notes > h3 { padding: 0 4px; font-size: 1.3rem; }
.visual-output { display: grid; gap: 14px; }
.study-block {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, white), color-mix(in srgb, var(--primary) 5%, var(--surface))), var(--surface);
  box-shadow: var(--soft-shadow);
}
.study-block-head { display: flex; align-items: center; gap: 10px; }
.study-block-head span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; color: #fff; background: var(--primary); font-size: .78rem; font-weight: 900; }
.study-block-head h4 { margin: 0 !important; color: var(--text) !important; font-size: 1.05rem !important; }
.study-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.study-card-grid article { min-height: 72px; padding: 12px 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); box-shadow: none; }
.study-card-grid p { margin: 0 !important; color: var(--text) !important; line-height: 1.45; }
.study-block.core .study-card-grid, .study-block.clinical .study-card-grid { grid-template-columns: 1fr; }
.study-block.core { border-color: color-mix(in srgb, var(--primary) 34%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), var(--surface)); }
.study-block.trap .study-block-head span { background: var(--accent); }
.study-block.trap { border-color: color-mix(in srgb, var(--accent) 32%, var(--border)); }
.study-block.recall .study-block-head span { background: var(--blue); }
.study-block.check .study-block-head span { background: #237b4b; }
.flow-lane { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 4px 0; }
.flow-lane span { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 11px; border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border)); border-radius: 999px; color: var(--text); background: color-mix(in srgb, var(--primary) 9%, var(--surface)); line-height: 1.25; }
.flow-lane b { color: var(--primary); font-size: 1.05rem; }
.msg.assistant .visual-output { margin-top: 2px; }
.msg.assistant .study-block { box-shadow: none; }
:root[data-theme='dark'] .study-card-grid article, :root[data-theme='dark'] .study-block { background: #12201b; }
:root[data-theme='dark'] .flow-lane span { background: #17342d; }
@media (max-width: 900px) {
  .study-hero { grid-template-columns: 1fr !important; }
  .study-orbit { justify-self: start !important; }
  .study-card-grid { grid-template-columns: 1fr; }
}
`;
if (!styles.includes('Build-time visual study upgrade')) {
  styles += visualCss;
}
fs.writeFileSync(stylesPath, styles);
