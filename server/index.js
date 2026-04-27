import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import OpenAI, { toFile } from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8787;
const host = process.env.HOST || '0.0.0.0';
const upload = multer({ dest: path.join(os.tmpdir(), 'simav-dental-tutor') });
const speechSessions = new Map();
const authSessions = new Map();
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dataPath = path.join(dataDir, 'app-data.json');
const distPath = path.join(__dirname, '..', 'dist');
const isProduction = process.env.NODE_ENV === 'production';
const defaultModel = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
let openaiClient;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '4mb' }));

function apiPaths(pathname) {
  return [pathname, pathname.replace(/^\/api/, '')];
}
function emptyStore() { return { users: [] }; }
function loadStore() {
  try {
    if (!fs.existsSync(dataPath)) return emptyStore();
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch { return emptyStore(); }
}
let store = loadStore();
function saveStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  const temp = `${dataPath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, dataPath);
}
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((cookie) => cookie.trim().split('=')).filter(([k, v]) => k && v).map(([k, v]) => [k, decodeURIComponent(v)]));
}
function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return `dst_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${isProduction ? '; Secure' : ''}`;
}
function clearSessionCookie() { return `dst_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`; }
function createAuthSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  authSessions.set(token, { userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  return token;
}
function findUserById(userId) { return store.users.find((user) => user.id === userId); }
function requireAuth(req, res, next) {
  const token = parseCookies(req).dst_session;
  const session = token ? authSessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) authSessions.delete(token);
    res.status(401).json({ error: 'Please sign in.' });
    return;
  }
  const user = findUserById(session.userId);
  if (!user) {
    authSessions.delete(token);
    res.status(401).json({ error: 'Please sign in again.' });
    return;
  }
  req.authToken = token;
  req.user = user;
  next();
}
function requireApiKey(_req, res, next) {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY in Render environment variables.' });
    return;
  }
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  next();
}
function trimForModel(value, limit = 1600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

const tutorInstructions = `You are Simav Dental Tutor, a dental school study tutor. Search the uploaded PDFs before answering. Base your answer on uploaded course material whenever relevant snippets are found. Keep responses concise, high-yield, and useful for active recall. Use short headings and clean numbered or bulleted lines. Do not use decorative symbols or emoji. If the source truly has no relevant content, say what is missing and offer brief general dental-study background clearly labeled as general background. Never present yourself as a licensed clinician.`;
const modePrompts = {
  answer: 'Answer the student question from the uploaded PDF. Keep it under 7 concise bullets unless the student asks for more. Include page/source references when available.',
  summary: 'Create a compact study summary with: Overview, High-yield facts, Terms to memorize, Exam traps, Active-recall checklist. Keep it concise.',
  explanation: 'Explain the topic with plain-language idea, dental-school mechanism, clinical relevance, and one memory hook. Keep it concise.',
  test: 'Act as an oral-exam coach. Ask 4 high-yield questions with a short answer rubric. If the student is answering, grade kindly, correct misconceptions, then ask one follow-up.',
  flashcards: 'Create exam-ready flashcards only. Prefer short front/back cards.',
  notes: 'Create polished concise study notes with key terms, clinical relevance, and an active-recall checklist.',
  weakQuiz: 'Create a targeted 5-question weak-spot quiz with answer rubrics and short remediation notes.',
  caseStudy: 'Create one compact board-style dental case with patient snapshot, findings, diagnostic clues, 3 questions, answer key, and teaching pearl.',
  mnemonics: 'Create memorable but professional mnemonics and a quick recall drill.'
};
const outputLimits = { answer: 750, summary: 950, explanation: 850, test: 1100, flashcards: 900, notes: 950, weakQuiz: 950, caseStudy: 1050, mnemonics: 850 };
const artifactPrompts = {
  flashcards: 'Create 10 concise dental flashcards from the uploaded material. Return only valid JSON: {"cards":[{"question":"...","answer":"..."}]}. No markdown. No commentary.',
  notes: 'Create polished study notes from the uploaded material. Use headings, concise bullets, key terms, clinical relevance, and a final active-recall checklist.',
  weakQuiz: 'Create a targeted weak-spot quiz from the uploaded material. Include 5 questions, answer rubric, and one short remediation note for each.',
  caseStudy: 'Create one compact board-style dental case study from the uploaded material. Use: Patient Snapshot, Chief Complaint, Key Findings, Diagnostic Clues, Three Questions, Answer Key, Teaching Pearl.',
  mnemonics: 'Create memorable mnemonics for the selected dental material. Use: Key Facts, Mnemonics, Why It Works, Quick Recall Drill.'
};
const personaInstructions = {
  peer: 'Tutor persona: supportive peer. Warm, clear, and efficient.',
  professor: 'Tutor persona: stern professor. Formal, concise, exam-focused.',
  clinic: 'Tutor persona: clinical mentor. Practical, precise, and chairside-relevant.'
};
function parseCardsFromText(text) {
  const jsonMatch = String(text || '').match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.cards)) return parsed.cards.filter((c) => c?.question && c?.answer).map((c) => ({ question: String(c.question).trim(), answer: String(c.answer).trim() }));
    } catch {}
  }
  const cards = [];
  for (const block of String(text || '').split(/\n\s*\n/)) {
    const q = block.match(/(?:Q|Question|Front)\s*\d*\s*[:.-]\s*(.+)/i)?.[1]?.trim();
    const a = block.match(/(?:A|Answer|Back)\s*\d*\s*[:.-]\s*([\s\S]+)/i)?.[1]?.trim();
    if (q && a) cards.push({ question: q, answer: a });
  }
  return cards.slice(0, 12);
}
function buildConversationInput(message, history = []) {
  const recent = history.slice(-5).map((item) => `${item.role === 'assistant' ? 'Tutor' : 'Student'}: ${trimForModel(item.text, 550)}`).join('\n\n');
  const current = trimForModel(message, 1500);
  return recent ? `Recent study conversation:\n${recent}\n\nCurrent student message:\n${current}` : current;
}
async function createResponse({ vectorStoreId, input, mode, history, persona = 'peer' }) {
  const response = await openaiClient.responses.create({
    model: defaultModel,
    instructions: `${tutorInstructions}\n\n${personaInstructions[persona] ?? personaInstructions.peer}\n\nMode: ${mode}. ${modePrompts[mode] ?? modePrompts.answer}`,
    input: buildConversationInput(input, history),
    max_output_tokens: outputLimits[mode] ?? 850,
    tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: mode === 'test' || mode === 'caseStudy' ? 4 : 3 }]
  });
  return response.output_text;
}

app.get(apiPaths('/api/health'), (_req, res) => res.json({ ok: true, model: defaultModel }));
app.post(apiPaths('/api/auth/signup'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use at least 8 characters for the password.' });
  if (store.users.some((user) => user.email === email)) return res.status(409).json({ error: 'An account already exists for this email.' });
  const user = { id: crypto.randomUUID(), name, email, passwordHash: hashPassword(password), studyState: null, createdAt: new Date().toISOString() };
  store.users.push(user); saveStore();
  res.setHeader('Set-Cookie', sessionCookie(createAuthSession(user.id)));
  res.json({ user: publicUser(user) });
});
app.post(apiPaths('/api/auth/login'), (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = store.users.find((item) => item.email === email);
  if (!user || !verifyPassword(String(req.body.password || ''), user.passwordHash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.setHeader('Set-Cookie', sessionCookie(createAuthSession(user.id)));
  res.json({ user: publicUser(user) });
});
app.get(apiPaths('/api/auth/me'), requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post(apiPaths('/api/auth/logout'), requireAuth, (req, res) => { authSessions.delete(req.authToken); res.setHeader('Set-Cookie', clearSessionCookie()); res.json({ ok: true }); });
app.get(apiPaths('/api/session'), requireAuth, (req, res) => res.json({ studyState: req.user.studyState || null }));
app.put(apiPaths('/api/session'), requireAuth, (req, res) => {
  const { studySet = null, chat = [], flashcards = [], notes = '', page = 'dashboard', voicePersona = 'peer' } = req.body || {};
  req.user.studyState = { studySet, chat: Array.isArray(chat) ? chat.slice(-120) : [], flashcards: Array.isArray(flashcards) ? flashcards.slice(0, 300) : [], notes: String(notes || '').slice(0, 120000), page, voicePersona, updatedAt: new Date().toISOString() };
  saveStore(); res.json({ ok: true });
});
app.delete(apiPaths('/api/session'), requireAuth, (req, res) => { req.user.studyState = null; saveStore(); res.json({ ok: true }); });

app.post(apiPaths('/api/upload'), requireAuth, requireApiKey, upload.array('pdfs', 8), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one PDF.' });
  try {
    const vectorStore = await openaiClient.vectorStores.create({ name: `Simav Dental Tutor study set ${new Date().toISOString()}` });
    const uploadedFiles = [];
    for (const file of req.files) {
      const openaiFile = await openaiClient.files.create({ file: await toFile(fs.createReadStream(file.path), file.originalname, { type: file.mimetype || 'application/pdf' }), purpose: 'assistants' });
      await openaiClient.vectorStores.files.createAndPoll(vectorStore.id, { file_id: openaiFile.id });
      uploadedFiles.push({ originalName: file.originalname, fileId: openaiFile.id });
    }
    const studySet = { vectorStoreId: vectorStore.id, files: uploadedFiles };
    req.user.studyState = { studySet, chat: [{ role: 'assistant', text: 'Your PDF set is indexed. Ask a question, request a summary, make flashcards, or start an oral test.', mode: 'answer', id: crypto.randomUUID() }], flashcards: [], notes: '', page: 'dashboard', voicePersona: 'peer', updatedAt: new Date().toISOString() };
    saveStore(); res.json(studySet);
  } catch (error) { res.status(500).json({ error: error.message }); }
  finally { for (const file of req.files || []) fs.rm(file.path, { force: true }, () => {}); }
});
app.post(apiPaths('/api/study'), requireAuth, requireApiKey, async (req, res) => {
  const { vectorStoreId, message, mode = 'answer', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId || !message) return res.status(400).json({ error: 'vectorStoreId and message are required.' });
  try { res.json({ text: await createResponse({ vectorStoreId, input: message, mode, history, persona }) }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.post(apiPaths('/api/artifact'), requireAuth, requireApiKey, async (req, res) => {
  const { vectorStoreId, type = 'notes', source = '', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId) return res.status(400).json({ error: 'vectorStoreId is required.' });
  try {
    const prompt = artifactPrompts[type] ?? artifactPrompts.notes;
    const text = await createResponse({ vectorStoreId, mode: type, history, persona, input: `${prompt}\n\nStudent-selected material or request:\n${source || 'Use the uploaded PDF study set.'}` });
    if (type === 'flashcards') {
      const cards = parseCardsFromText(text);
      return res.json({ text: cards.length ? `Created ${cards.length} flashcards.` : 'No flashcards were created from the model output.', cards });
    }
    res.json({ text });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post(apiPaths('/api/transcribe'), requireAuth, requireApiKey, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });
  try {
    const transcription = await openaiClient.audio.transcriptions.create({ file: await toFile(fs.createReadStream(req.file.path), req.file.originalname || 'student-question.webm', { type: req.file.mimetype || 'audio/webm' }), model: 'gpt-4o-mini-transcribe', prompt: 'Dental education audio with terms like enamel, dentin, pulp, mandibular, maxillary, V3, inferior alveolar nerve, odontoblast, cementum, and foramen.' });
    res.json({ text: transcription.text });
  } catch (error) { res.status(500).json({ error: error.message }); }
  finally { fs.rm(req.file.path, { force: true }, () => {}); }
});
app.post(apiPaths('/api/speak'), requireAuth, requireApiKey, (req, res) => {
  const { text, voice = 'cedar', persona = 'peer' } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required.' });
  const id = crypto.randomUUID();
  speechSessions.set(id, { text: String(text).slice(0, 1200), voice, persona, userId: req.user.id, createdAt: Date.now() });
  res.json({ speechId: id, audioUrl: `/api/speak/${id}` });
});
app.get(apiPaths('/api/speak/:id'), requireAuth, requireApiKey, async (req, res) => {
  const session = speechSessions.get(req.params.id);
  if (!session || session.userId !== req.user.id) return res.status(404).json({ error: 'Speech session expired.' });
  speechSessions.delete(req.params.id);
  try {
    const speech = await openaiClient.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: session.voice, input: session.text, instructions: session.persona === 'professor' ? 'Formal, crisp dental professor.' : session.persona === 'clinic' ? 'Calm clinical dental mentor.' : 'Supportive dental school study peer.' });
    res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'no-store');
    if (speech.body) return Readable.fromWeb(speech.body).pipe(res);
    res.end(Buffer.from(await speech.arrayBuffer()));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

setInterval(() => {
  const expiresBefore = Date.now() - 5 * 60 * 1000;
  for (const [id, session] of speechSessions) if (session.createdAt < expiresBefore) speechSessions.delete(id);
}, 60 * 1000).unref();
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.method !== 'GET') return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  next();
});
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}
app.listen(port, host, () => console.log(`Simav Dental Tutor API running on http://${host}:${port}`));
