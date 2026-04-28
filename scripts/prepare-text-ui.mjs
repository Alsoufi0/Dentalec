import fs from 'node:fs';

const mainPath = 'src/main.jsx';
const stylesPath = 'src/styles.css';
let main = fs.readFileSync(mainPath, 'utf8');

if (!main.includes('textSource, setTextSource')) {
  main = main.replace(
    'const [files, setFiles] = useState([]);',
    "const [files, setFiles] = useState([]);\n  const [textTitle, setTextTitle] = useState('');\n  const [textSource, setTextSource] = useState('');"
  );

  const uploadTextFunction = `
  async function uploadTextSource(e) {
    e.preventDefault();
    const text = textSource.trim();
    if (text.length < 80) { setError('Paste at least a short paragraph of study text.'); return; }
    stopAudio(); setBusy('upload'); setError('');
    try {
      const r = await fetch(API + '/text-source', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: textTitle || 'Pasted study notes', text }) });
      const d = await readJson(r, 'Text indexing failed.');
      setStudySet(d); setTextSource(''); setTextTitle(''); go('dashboard');
      setChat([{ id: crypto.randomUUID(), role: 'assistant', mode: 'answer', text: 'Your pasted text is indexed. Ask questions, request a complete explanation, or generate study tools.' }]);
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
`;
  main = main.replace('  async function ask(text = message, nextMode = mode, speak = false) {', uploadTextFunction + '\n  async function ask(text = message, nextMode = mode, speak = false) {');

  main = main.replace(
    "const styleInstruction = answerStyle === 'text' ? 'Answer style: concise paragraph text. Explain like a patient tutor for a dental student, use simple language, include must-know details, and end with a one-sentence recap.' : 'Answer style: bullet points. Explain simply, include must-know details, highlight exam-important facts, and end with a quick recap.';",
    "const styleInstruction = answerStyle === 'text' ? 'Answer style: concise paragraph text. Explain in easy language first, then precise dental terms. Include all crucial exam details from the source: mechanism, examples, indications, percentages/concentrations, frequency/how to use, and what it does. If a detail is not in the source, say the source does not specify it. End with a one-sentence recap.' : 'Answer style: bullet points. Explain simply but completely. Include all crucial exam details from the source: mechanism, examples, indications, percentages/concentrations, frequency/how to use, and what it does. If a detail is not in the source, say the source does not specify it. End with a quick recap.';"
  );
}

if (!main.includes('Paste study text')) {
  const pdfForm = `<form className="card upload" onSubmit={upload}><Upload /><h3>Upload dental PDFs</h3><p>Use chapter-sized PDFs for faster answers, richer summaries, and fewer token-limit errors.</p><input type="file" accept="application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /><button className="primary" disabled={!files.length || busy === 'upload'}>{busy === 'upload' ? <Loader2 className="spin" /> : <Sparkles />} Index PDFs</button></form>`;
  const libraryForms = `<div className="source-grid"><form className="card upload" onSubmit={upload}><Upload /><h3>Upload dental PDFs</h3><p>Use chapter-sized PDFs for faster answers, richer summaries, and fewer token-limit errors.</p><input type="file" accept="application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /><button className="primary" disabled={!files.length || busy === 'upload'}>{busy === 'upload' ? <Loader2 className="spin" /> : <Sparkles />} Index PDFs</button></form><form className="card upload paste-source" onSubmit={uploadTextSource}><FileText /><h3>Paste study text</h3><p>Use copied lecture notes, textbook sections, handouts, or prevention protocols without needing a PDF.</p><input placeholder="Title, e.g. Caries prevention notes" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} /><textarea rows={9} placeholder="Paste dental study text here..." value={textSource} onChange={(e) => setTextSource(e.target.value)} /><button className="primary" disabled={textSource.trim().length < 80 || busy === 'upload'}>{busy === 'upload' ? <Loader2 className="spin" /> : <Sparkles />} Index Text</button></form></div>`;
  main = main.replace(pdfForm, libraryForms);
}

fs.writeFileSync(mainPath, main);

let styles = fs.readFileSync(stylesPath, 'utf8');
if (!styles.includes('paste-source')) {
  styles += `
.source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.paste-source textarea {
  min-height: 190px;
}
.paste-source input {
  min-height: 44px;
}
@media (max-width: 900px) {
  .source-grid { grid-template-columns: 1fr; }
}
`;
}
fs.writeFileSync(stylesPath, styles);
