import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Brain, Download, FileQuestion, FileText, GraduationCap, Headphones, Library, Loader2, Mic, Moon, Send, Sparkles, Square, Sun, Upload, UserPlus, Volume2 } from 'lucide-react';
import './styles.css';

const API = '/api';
const STORE = 'simav-dental-tutor-state-v1';
const THEME = 'simav-dental-tutor-theme-v1';
const modes = [
  { id: 'answer', label: 'Q&A', icon: Library, prompt: 'Ask an exact question from your uploaded dental PDFs.' },
  { id: 'summary', label: 'Summary', icon: BookOpen, prompt: 'Create a high-yield exam summary.' },
  { id: 'explanation', label: 'Explain', icon: Brain, prompt: 'Explain a concept with clinical relevance and memory hooks.' },
  { id: 'test', label: 'Test', icon: FileQuestion, prompt: 'Start an oral exam with rubrics and follow-up questions.' }
];
const personas = [
  ['peer', 'Supportive Peer'],
  ['professor', 'Stern Professor'],
  ['clinic', 'Clinical Mentor']
];

function clean(text = '') {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/#{1,6}\s*/g, '').trim();
}
function fmt(text = '') {
  return clean(text).split('\n').filter(Boolean).map((line, i) => <p key={i}>{line.replace(/^[-*]\s*/, '')}</p>);
}
function key(user) { return `${STORE}:${user?.id || 'guest'}`; }

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME) || 'light');
  const [auth, setAuth] = useState({ status: 'loading', user: null });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('dashboard');
  const [mode, setMode] = useState('answer');
  const [files, setFiles] = useState([]);
  const [studySet, setStudySet] = useState(null);
  const [chat, setChat] = useState([]);
  const [notes, setNotes] = useState('');
  const [cards, setCards] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [persona, setPersona] = useState('peer');
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState('');
  const recorder = useRef(null);
  const chunks = useRef([]);
  const audio = useRef(null);

  const fileNames = useMemo(() => studySet?.files?.map((f) => f.originalName).join(', ') || 'No PDFs indexed yet', [studySet]);
  const stats = useMemo(() => ({ questions: chat.filter((x) => x.role === 'user').length, answers: chat.filter((x) => x.role === 'assistant').length, cards: cards.length }), [chat, cards]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME, theme); }, [theme]);
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' }).then(async (r) => {
      if (!r.ok) throw new Error('guest');
      return r.json();
    }).then((d) => setAuth({ status: 'ready', user: d.user })).catch(() => setAuth({ status: 'ready', user: null }));
  }, []);
  useEffect(() => {
    if (!auth.user) return;
    fetch(`${API}/session`, { credentials: 'include' }).then((r) => r.json()).then((d) => {
      const local = JSON.parse(localStorage.getItem(key(auth.user)) || '{}');
      const s = d.studyState || local || {};
      setStudySet(s.studySet || null); setChat(s.chat || []); setCards(s.flashcards || []); setNotes(s.notes || ''); setPage(s.page || 'dashboard'); setPersona(s.voicePersona || 'peer');
    }).catch(() => {});
  }, [auth.user?.id]);
  useEffect(() => {
    if (!auth.user) return;
    const body = { studySet, chat, flashcards: cards, notes, page, voicePersona: persona };
    localStorage.setItem(key(auth.user), JSON.stringify(body));
    const t = setTimeout(() => fetch(`${API}/session`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [auth.user?.id, studySet, chat, cards, notes, page, persona]);

  async function submitAuth(e) {
    e.preventDefault(); setAuthError('');
    try {
      const r = await fetch(`${API}/auth/${authMode === 'signup' ? 'signup' : 'login'}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not sign in.');
      setAuth({ status: 'ready', user: d.user }); setAuthForm({ name: '', email: '', password: '' });
    } catch (err) { setAuthError(err.message); }
  }
  async function logout() {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuth({ status: 'ready', user: null }); setStudySet(null); setChat([]); setCards([]); setNotes('');
  }
  async function upload(e) {
    e.preventDefault(); if (!files.length) return;
    setBusy('upload'); setError('');
    const body = new FormData(); files.forEach((f) => body.append('pdfs', f));
    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', credentials: 'include', body });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Upload failed.');
      setStudySet(d); setPage('dashboard'); setChat([{ id: crypto.randomUUID(), role: 'assistant', mode: 'answer', text: 'Your PDFs are indexed. Ask a question, request a summary, or start an oral test.' }]);
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  async function ask(text = message, nextMode = mode, speak = false) {
    const q = text.trim(); if (!q || !studySet) return;
    stopAudio(); setBusy('study'); setError(''); setMessage(''); setMode(nextMode); setPage(nextMode);
    const userItem = { id: crypto.randomUUID(), role: 'user', mode: nextMode, text: q };
    setChat((x) => [...x, userItem]);
    try {
      const r = await fetch(`${API}/study`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vectorStoreId: studySet.vectorStoreId, message: q, mode: nextMode, persona, history: chat.slice(-8).map(({ role, text }) => ({ role, text })) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Study request failed.');
      const item = { id: crypto.randomUUID(), role: 'assistant', mode: nextMode, text: d.text };
      setChat((x) => [...x, item]); if (speak) talk(item);
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  async function artifact(type, source = '') {
    if (!studySet) return; setBusy('artifact'); setError('');
    try {
      const r = await fetch(`${API}/artifact`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vectorStoreId: studySet.vectorStoreId, type, source, persona, history: chat.slice(-8) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not create study material.');
      if (type === 'flashcards') { setCards((x) => [...(d.cards || []).map((c) => ({ ...c, id: crypto.randomUUID() })), ...x]); setPage('kit'); }
      else { setNotes(d.text); setPage(type === 'caseStudy' || type === 'weakQuiz' ? 'test' : 'kit'); setChat((x) => [...x, { id: crypto.randomUUID(), role: 'assistant', mode: type === 'caseStudy' ? 'test' : 'summary', text: d.text }]); }
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  function stopAudio() { if (audio.current) { audio.current.pause(); audio.current = null; } setSpeaking(''); }
  async function talk(item) {
    if (speaking === item.id) return stopAudio(); stopAudio(); setSpeaking(item.id);
    try {
      const text = clean(item.text).slice(0, 1400);
      const r = await fetch(`${API}/speak`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, persona }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Speech failed.');
      const a = new Audio(d.audioUrl); audio.current = a; a.onended = stopAudio; await a.play();
    } catch (err) { setError(err.message); stopAudio(); }
  }
  async function toggleRecord() {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); recorder.current = rec; chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); const body = new FormData(); body.append('audio', new Blob(chunks.current, { type: 'audio/webm' }), 'question.webm'); setBusy('voice'); const r = await fetch(`${API}/transcribe`, { method: 'POST', credentials: 'include', body }); const d = await r.json(); setBusy(''); if (d.text) ask(d.text, mode, true); };
      rec.start(); setRecording(true);
    } catch (err) { setError('Microphone permission is required for voice study.'); }
  }
  function download() {
    const body = `# Simav Dental Tutor Session\n\n## Notes\n${notes}\n\n## Flashcards\n${cards.map((c, i) => `${i + 1}. ${c.question}\n${c.answer}`).join('\n\n')}`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown' })); const a = document.createElement('a'); a.href = url; a.download = 'simav-dental-study-session.md'; a.click(); URL.revokeObjectURL(url);
  }

  if (auth.status === 'loading') return <main className="auth"><Loader2 className="spin" /><h1>Simav Dental Tutor</h1></main>;
  if (!auth.user) return <main className="auth"><section className="auth-card"><div className="top"><div className="mark"><GraduationCap /></div><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button></div><p className="eyebrow">Private dental study workspace</p><h1>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h1><p>Upload PDFs, ask questions, generate summaries and tests, save flashcards, and study by voice from any device.</p><div className="guide"><span>1. Create an account</span><span>2. Upload dental PDFs</span><span>3. Pick Q&A, Summary, Explain, or Test</span><span>4. Use Study Buddy voice when needed</span></div><form onSubmit={submitAuth}>{authMode === 'signup' && <input placeholder="Name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} />}<input type="email" placeholder="Email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /><input type="password" placeholder="Password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />{authError && <div className="error small">{authError}</div>}<button className="primary">{authMode === 'signup' ? <UserPlus /> : <Sparkles />} {authMode === 'signup' ? 'Create account' : 'Sign in'}</button></form><button className="link" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>{authMode === 'signup' ? 'Already have an account?' : 'New here? Create an account'}</button></section></main>;

  const active = modes.find((m) => m.id === page || m.id === mode) || modes[0];
  return <main className="shell"><aside><div className="brand"><div className="mark"><GraduationCap /></div><div><h1>Simav Dental Tutor</h1><p>ChatGPT PDF study assistant</p></div></div><div className="signed">Signed in <strong>{auth.user.name}</strong></div><select value={persona} onChange={(e) => setPersona(e.target.value)}>{personas.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><nav><button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button><button className={page === 'library' ? 'active' : ''} onClick={() => setPage('library')}>Library</button>{modes.map((m) => <button key={m.id} className={page === m.id ? 'active' : ''} onClick={() => { setPage(m.id); setMode(m.id); }}>{m.label}</button>)}<button className={page === 'kit' ? 'active' : ''} onClick={() => setPage('kit')}>Study Kit</button></nav></aside><section className="panel"><header><div><p>{page.toUpperCase()}</p><h2>{fileNames}</h2></div><div className="actions"><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? 'Light' : 'Dark'}</button><button onClick={logout}>Sign out</button></div></header><div className="quick"><button onClick={() => setPage('library')}>Upload</button><button disabled={!studySet} onClick={() => ask('Summarize this PDF for a dental exam.', 'summary')}>Summary</button><button disabled={!studySet} onClick={() => artifact('flashcards')}>Flashcards</button><button disabled={!studySet} onClick={() => artifact('caseStudy')}>Case Study</button><button disabled={!studySet} onClick={() => ask('Start a creative oral exam from this PDF.', 'test', true)}>Oral Test</button></div><div className="content">{page === 'dashboard' && <div className="stack"><section className="hero"><div><p>Current Study Set</p><h2>{fileNames}</h2></div><button onClick={() => setPage(studySet ? 'answer' : 'library')}>{studySet ? 'Continue studying' : 'Upload PDF'}</button></section><section className="card"><h3>Start Here</h3><div className="steps"><span>Upload a lecture or textbook PDF.</span><span>Ask Q&A for direct grounded answers.</span><span>Use Summary, Explain, and Test for active recall.</span><span>Use the mic button to study by voice.</span></div></section><section className="stats"><span>{stats.questions}<b>Questions</b></span><span>{stats.answers}<b>Answers</b></span><span>{stats.cards}<b>Flashcards</b></span></section></div>}{page === 'library' && <form className="card upload" onSubmit={upload}><Upload /><h3>Upload dental PDFs</h3><input type="file" accept="application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /><button className="primary" disabled={!files.length || busy === 'upload'}>{busy === 'upload' ? <Loader2 className="spin" /> : <Sparkles />} Index PDFs</button></form>}{page === 'kit' && <div className="stack"><div className="tools"><button disabled={!studySet} onClick={() => artifact('notes')}>Make notes</button><button disabled={!studySet} onClick={() => artifact('mnemonics')}>Mnemonics</button><button disabled={!studySet} onClick={() => artifact('weakQuiz')}>Weak quiz</button><button onClick={download}><Download /> Export</button></div><section className="card"><h3>Notes</h3>{notes ? fmt(notes) : <p>No notes yet.</p>}</section><section className="cards">{cards.map((c) => <article key={c.id}><h4>{c.question}</h4><p>{c.answer}</p></article>)}</section></div>}{modes.some((m) => m.id === page) && <div className="stack"><section className="card"><h3>{active.label}</h3><p>{active.prompt}</p></section>{chat.filter((x) => x.mode === page || (page === 'answer' && !x.mode)).map((item) => <article key={item.id} className={`msg ${item.role}`}>{item.role === 'assistant' ? fmt(item.text) : <p>{item.text}</p>}{item.role === 'assistant' && <button onClick={() => talk(item)}><Volume2 /> {speaking === item.id ? 'Stop' : 'Listen'}</button>}</article>)}</div>}{busy && <div className="msg assistant"><Loader2 className="spin" /> Working...</div>}</div>{error && <div className="error">{error}</div>}<form className="composer" onSubmit={(e) => { e.preventDefault(); ask(); }}><button type="button" onClick={toggleRecord} disabled={!studySet || !!busy}>{recording ? <Square /> : <Mic />}</button><textarea disabled={!studySet} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask about caries, anatomy landmarks, enamel formation, cavity classes..." /><button className="primary" disabled={!studySet || !message.trim() || !!busy}><Send /></button></form></section></main>;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
createRoot(document.getElementById('root')).render(<App />);
