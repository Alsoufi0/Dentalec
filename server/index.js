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
import { dentalosEngines, engineOutputLimitFor, enginePromptFor } from './dentalosEngines.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8787;
const host = process.env.HOST || '0.0.0.0';
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 30);
const maxUploadBytes = maxUploadMb * 1024 * 1024;
const dailyAiBudget = Number(process.env.DAILY_AI_BUDGET || 120);
const uploadDir = path.join(os.tmpdir(), 'simav-dental-tutor');

function ensureUploadDir() {
  fs.mkdirSync(uploadDir, { recursive: true });
}

ensureUploadDir();

const uploadStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    try {
      ensureUploadDir();
      callback(null, uploadDir);
    } catch (error) {
      callback(error);
    }
  },
  filename(_req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const pdfUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: maxUploadBytes, files: 8 },
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    callback(isPdf ? null : new Error('Only PDF files can be uploaded.'), isPdf);
  }
});

const audioUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: Math.min(maxUploadBytes, 25 * 1024 * 1024), files: 1 },
  fileFilter: (_req, file, callback) => {
    const isAudio = /^audio\//.test(file.mimetype || '') || /\.(webm|mp3|m4a|wav|ogg)$/i.test(file.originalname || '');
    callback(isAudio ? null : new Error('Only audio files can be transcribed.'), isAudio);
  }
});
let openaiClient;
let postgresPool;
const speechSessions = new Map();
const authSessions = new Map();
const requestBuckets = new Map();
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dataPath = path.join(dataDir, 'app-data.json');
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed.'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '4mb' }));

const distPath = path.join(__dirname, '..', 'dist');

function createEmptyStore() {
  return { users: [] };
}

function loadJsonStore() {
  try {
    if (!fs.existsSync(dataPath)) return createEmptyStore();
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return createEmptyStore();
  }
}

let store = createEmptyStore();

async function initializePostgresStore() {
  if (!process.env.DATABASE_URL) return false;
  const { Pool } = await import('pg');
  postgresPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await postgresPool.query(`
    create table if not exists users (
      id text primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      study_state jsonb,
      usage jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await postgresPool.query(`
    create table if not exists auth_sessions (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `);
  const result = await postgresPool.query(
    'select id, name, email, password_hash, study_state, usage, created_at from users order by created_at asc'
  );
  store = {
    users: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      studyState: row.study_state,
      usage: row.usage,
      createdAt: row.created_at?.toISOString?.() || row.created_at
    }))
  };
  return true;
}

async function persistPostgresStore() {
  if (!postgresPool) return;
  for (const user of store.users) {
    await postgresPool.query(
      `insert into users (id, name, email, password_hash, study_state, usage, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, now())
       on conflict (id) do update set
         name = excluded.name,
         email = excluded.email,
         password_hash = excluded.password_hash,
         study_state = excluded.study_state,
         usage = excluded.usage,
         updated_at = now()`,
      [user.id, user.name, user.email, user.passwordHash, user.studyState || null, user.usage || null, user.createdAt || new Date().toISOString()]
    );
  }
}

function saveStore() {
  if (postgresPool) {
    persistPostgresStore().catch((error) => console.error('Postgres persistence failed:', error.message));
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const temporaryPath = `${dataPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2));
  fs.renameSync(temporaryPath, dataPath);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, usage: dailyUsage(user) };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailyUsage(user) {
  const today = todayKey();
  const usage = user.usage?.date === today ? user.usage : { date: today, aiCalls: 0, uploads: 0 };
  return {
    date: today,
    aiCalls: Number(usage.aiCalls || 0),
    uploads: Number(usage.uploads || 0),
    dailyAiBudget
  };
}

function incrementUsage(user, field, amount = 1) {
  const usage = dailyUsage(user);
  usage[field] = Number(usage[field] || 0) + amount;
  user.usage = usage;
  saveStore();
  return usage;
}

function requireAiBudget(req, res, next) {
  const usage = dailyUsage(req.user);
  if (usage.aiCalls >= dailyAiBudget) {
    res.status(402).json({
      error: 'Daily AI study budget reached. Continue reviewing saved notes and flashcards, or increase the budget for this deployment.'
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Study sources: multi-source model, lazy migration, and raw-text storage.
// A student can keep several sources (pasted text or PDF sets); each source has
// its own vector store, its own chat/flashcards/notes, and, when we could
// extract it, its raw text on disk for full-coverage generation.
// ---------------------------------------------------------------------------
const MAX_SOURCES = 10;
const MAX_FULLTEXT_CHARS = 300000;
const sourcesDir = path.join(dataDir, 'sources');

function safePathPart(value) {
  return String(value || '').replace(/[^A-Za-z0-9_.-]/g, '_');
}

function emptySourceData() {
  return { chat: [], flashcards: [], notes: '' };
}

function emptyStudyState() {
  return {
    sources: [],
    activeSourceId: null,
    sourceData: {},
    page: 'dashboard',
    voicePersona: 'peer',
    learning: { mastery: {}, reviews: {}, curriculum: [] },
    updatedAt: new Date().toISOString()
  };
}

// Lazily migrate a legacy single-studySet state to the multi-source shape.
// Never touches OpenAI resources, so it is safe to run on every request.
function normalizeStudyState(user) {
  const state = user.studyState;
  if (!state) return null;
  if (Array.isArray(state.sources)) {
    if (!state.sourceData || typeof state.sourceData !== 'object') state.sourceData = {};
    return state;
  }

  const next = emptyStudyState();
  next.page = state.page || next.page;
  next.voicePersona = state.voicePersona || next.voicePersona;
  next.learning = typeof state.learning === 'object' && state.learning ? state.learning : next.learning;
  next.updatedAt = state.updatedAt || next.updatedAt;

  const legacyData = {
    chat: Array.isArray(state.chat) ? state.chat : [],
    flashcards: Array.isArray(state.flashcards) ? state.flashcards : [],
    notes: String(state.notes || '')
  };

  if (state.studySet?.vectorStoreId) {
    const files = (state.studySet.files || []).map((file) => ({ ...file, textExtracted: false }));
    const source = {
      id: crypto.randomUUID(),
      title: files[0]?.originalName || 'My study set',
      sourceType: files.length && files.every((file) => file.sourceType === 'text') ? 'text' : 'pdf',
      vectorStoreId: state.studySet.vectorStoreId,
      files,
      textChars: 0,
      createdAt: state.updatedAt || new Date().toISOString()
    };
    next.sources = [source];
    next.activeSourceId = source.id;
    next.sourceData[source.id] = legacyData;
  } else if (legacyData.chat.length || legacyData.flashcards.length || legacyData.notes) {
    next.sourceData.unassigned = legacyData;
  }

  user.studyState = next;
  saveStore();
  return next;
}

function findSource(user, sourceId) {
  if (!sourceId) return null;
  return (user.studyState?.sources || []).find((source) => source.id === sourceId) || null;
}

function activeSource(user) {
  const state = user.studyState;
  if (!state?.activeSourceId) return null;
  return findSource(user, state.activeSourceId);
}

// Old clients still read a single { vectorStoreId, files } study set; project
// the active source into that shape so open tabs keep working during rollout.
function legacyStudySetProjection(user) {
  const source = activeSource(user);
  if (!source) return null;
  return { vectorStoreId: source.vectorStoreId, files: source.files };
}

function sourceListResponse(user) {
  const state = user.studyState;
  return {
    sources: state?.sources || [],
    activeSourceId: state?.activeSourceId || null,
    studySet: legacyStudySetProjection(user)
  };
}

// The server, not the request body, decides which source an AI call may use.
// A stale or foreign vectorStoreId can never reach OpenAI directly.
function resolveRequestSource(req) {
  normalizeStudyState(req.user);
  const { sourceId, vectorStoreId } = req.body || {};
  const sources = req.user.studyState?.sources || [];
  if (sourceId) return sources.find((source) => source.id === sourceId) || null;
  if (vectorStoreId) {
    const match = sources.find((source) => source.vectorStoreId === vectorStoreId);
    if (match) return match;
  }
  return activeSource(req.user);
}

function sourceTextDir(userId, sourceId) {
  return path.join(sourcesDir, safePathPart(userId), safePathPart(sourceId));
}

function sourceTextPath(userId, sourceId, fileId) {
  return path.join(sourceTextDir(userId, sourceId), `${safePathPart(fileId)}.txt`);
}

function writeSourceText(userId, sourceId, fileId, text) {
  try {
    fs.mkdirSync(sourceTextDir(userId, sourceId), { recursive: true });
    fs.writeFileSync(sourceTextPath(userId, sourceId, fileId), text, 'utf8');
    return true;
  } catch (error) {
    console.error('Raw source text write failed:', error.message);
    return false;
  }
}

// Combined raw text of a source, or null when unavailable or too large for
// direct model input; callers then fall back to file_search retrieval.
function readCombinedSourceText(userId, source, maxChars = MAX_FULLTEXT_CHARS) {
  if (!source) return null;
  const parts = [];
  let total = 0;
  for (const file of source.files || []) {
    if (!file.textExtracted) continue;
    try {
      const text = fs.readFileSync(sourceTextPath(userId, source.id, file.fileId), 'utf8');
      if (!text.trim()) continue;
      total += text.length;
      if (total > maxChars) return null;
      parts.push(`--- ${file.originalName} ---\n${text}`);
    } catch {
      // Missing raw text: this file degrades to retrieval.
    }
  }
  return parts.length ? parts.join('\n\n') : null;
}

function deleteSourceTextFile(userId, sourceId, fileId) {
  fs.rm(sourceTextPath(userId, sourceId, fileId), { force: true }, () => {});
}

function deleteSourceTextDir(userId, sourceId) {
  fs.rm(sourceTextDir(userId, sourceId), { recursive: true, force: true }, () => {});
}

// Best-effort teardown of a source's OpenAI files, vector store, and raw text.
async function deleteRemoteSource(userId, source) {
  for (const file of source.files || []) {
    try { await openaiClient.vectorStores.files.del(source.vectorStoreId, file.fileId); } catch { /* already gone */ }
    try { await openaiClient.files.del(file.fileId); } catch { /* already gone */ }
  }
  try { await openaiClient.vectorStores.del(source.vectorStoreId); } catch { /* already gone */ }
  deleteSourceTextDir(userId, source.id);
}

function removeSourceFromState(state, sourceId) {
  state.sources = (state.sources || []).filter((source) => source.id !== sourceId);
  if (state.sourceData) delete state.sourceData[sourceId];
  if (state.activeSourceId === sourceId) {
    const newest = [...state.sources].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    state.activeSourceId = newest?.id || null;
  }
}

// Extract selectable text from a PDF so document-wide tools can read the whole
// file. Returns '' for scanned/image PDFs; the upload itself never fails here.
let pdfjsModulePromise;
async function extractPdfText(filePath) {
  try {
    pdfjsModulePromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjs = await pdfjsModulePromise;
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false });
    const doc = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    await loadingTask.destroy();
    return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
  } catch (error) {
    console.error('PDF text extraction failed:', error.message);
    return '';
  }
}

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
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((cookie) => cookie.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const secure = isProduction ? '; Secure' : '';
  return `dst_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearSessionCookie() {
  const secure = isProduction ? '; Secure' : '';
  return `dst_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function createAuthSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  authSessions.set(token, {
    userId,
    expiresAt
  });
  if (postgresPool) {
    postgresPool
      .query(
        'insert into auth_sessions (token_hash, user_id, expires_at) values ($1, $2, $3) on conflict (token_hash) do update set expires_at = excluded.expires_at',
        [tokenHash, userId, new Date(expiresAt).toISOString()]
      )
      .catch((error) => console.error('Session persistence failed:', error.message));
  }
  return token;
}

function findUserById(userId) {
  return store.users.find((user) => user.id === userId);
}

async function requireAuth(req, res, next) {
  const token = parseCookies(req).dst_session;
  let session = token ? authSessions.get(token) : null;
  if (!session && token && postgresPool) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await postgresPool.query('select user_id, expires_at from auth_sessions where token_hash = $1', [tokenHash]);
    const row = result.rows[0];
    if (row) {
      session = { userId: row.user_id, expiresAt: new Date(row.expires_at).getTime() };
      authSessions.set(token, session);
    }
  }
  if (!session || session.expiresAt < Date.now()) {
    if (token) authSessions.delete(token);
    if (token && postgresPool) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      postgresPool.query('delete from auth_sessions where token_hash = $1', [tokenHash]).catch(() => {});
    }
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

const requireApiKey = (_req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY in .env' });
    return;
  }
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  next();
};

const defaultModel = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
// Output budgets are generous on purpose: a dental answer must never be cut off
// mid-section. The continuation loop in createResponse is a second safety net
// that finishes any answer that still reaches its cap.
const outputLimits = {
  answer: 1100,
  summary: 2800,
  explanation: 1200,
  test: 1800,
  flashcards: 2600,
  notes: 2800,
  weakQuiz: 1500,
  caseStudy: 1700,
  mnemonics: 1000,
  conceptMap: 1600,
  clinicalChecklist: 1100,
  examTraps: 1400,
  teachBack: 1100,
  osce: 1800,
  adaptivePlan: 1300,
  curriculumMap: 2200,
  clinicalVisionChecklist: 1100,
  ...Object.fromEntries(Object.values(dentalosEngines).map((engine) => [engine.mode, engine.outputLimit]))
};

// Modes that must cover the WHOLE document. When the raw source text is
// available these get it injected directly instead of 25 retrieved chunks,
// and they get a completeness instruction instead of the concise one.
const fullTextModes = new Set([
  'summary',
  'notes',
  'flashcards',
  'curriculumMap',
  'conceptMap',
  'examTraps',
  'mnemonics',
  'teachBack',
  'clinicalChecklist',
  ...Object.keys(dentalosEngines)
]);

const flashcardsSchema = {
  name: 'flashcards',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['cards'],
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['question', 'answer'],
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' }
          }
        }
      }
    }
  }
};

function trimForModel(value, limit = 1800) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

const tutorInstructions = `You are a dental school study tutor. Base your answer on the student's course material whenever relevant content is available. For broad or informal questions, infer the likely dental topic, look for nearby terms, and explain the matching source material in clear student language. Format answers with short section headings and clean numbered or bulleted lines. Use Markdown tables for rubrics, comparison grids, diagnostic criteria, protocols, decision pathways, marking schemes, and feature lists. Preserve important details; simplify by structuring information visually, never by deleting criteria, classifications, differentials, complications, prognosis, or protocol steps. Do not use decorative symbols, emoji, casual filler, or horizontal-rule separator lines (no --- or *** lines). If the source truly has no relevant content, say what is missing and offer a short general dental-study explanation clearly labeled as general background. Be precise with anatomy, pathology, materials, procedures, and terminology. Use professional academic wording, for example children rather than kids. Do not end with motivational filler or praise lines such as good luck or keep up the great work. Never present yourself as a licensed clinician.`;

// Style instruction is mode-dependent: chat answers stay tight and scannable,
// while document-wide tools must cover everything in the source.
const conciseClause =
  'Be concise and scannable: lead with the answer, use short bullets and compact tables, keep each section tight, and avoid repetition, filler, and restating the question. Prefer the shortest response that still covers the essentials.';
const completenessClause =
  'Cover the entire provided source. Do not leave out sections, classifications, criteria, differentials, or protocol steps. Completeness matters more than brevity; structure the information so it stays scannable.';

const modePrompts = {
  summary:
    'Create a clear dental study summary. Use these sections: Core Idea, High-Yield Facts, Key Details, Clinical Relevance, Key Terms, Common Confusions, Exam Traps, Quick Checklist, Active-Recall Questions, 60-Second Recap. In Key Details, include the full classifications, criteria, lists, ages, and steps the source gives (do not compress them away). Use Markdown tables for comparisons, classifications, and criteria. Do not draw horizontal-rule separator lines (no --- or *** lines); separate content with the section headings only. Do not use arrow-chain diagrams. Include page or source references when available.',
  explanation:
    'Have a natural back-and-forth conversation like a friendly dental tutor. Answer in clear, plain-language prose: start with the simple idea, then add the dental-school mechanism, clinical relevance, and a quick memory hook. Keep it conversational and readable, not a document. Avoid heavy tables and diagrams unless one is truly essential. End with a short check-for-understanding or a follow-up question to keep the conversation going.',
  test:
    'Act as a professional oral-exam coach. If the student asks to be tested, use exactly these sections: Overview, Question 1 - Quick Recall, Question 2 - Clinical Vignette, Question 3 - Compare and Contrast, Question 4 - Anatomy or Mechanism, Question 5 - Error Spotting, Question 6 - Challenge Case, Answer Rubric, Next Step. Keep each question clearly separated. Use a Markdown table for Answer Rubric or marking criteria with columns such as Criteria, Marks, Comments. If the student is answering a prior quiz question, grade the answer kindly under Assessment, correct misconceptions under Correction, and ask one focused follow-up under Next Question.',
  answer:
    'Answer the student question VISUALLY from the source material. Lead with the visual and keep prose to a minimum. Use a Markdown table for any comparison, classification, set of criteria, or feature list. For a process, pathway, sequence, or set of relationships, output a diagram inside a fenced ```mermaid code block using valid Mermaid syntax: prefer "flowchart TD" for processes and decision paths, or "mindmap" for how sub-topics branch from a main topic. Keep node labels short (a few words), avoid special characters and parentheses inside node text, and quote labels that need them. Only include a diagram when it genuinely clarifies; a clear table or a short list is fine when a diagram would not help. Include source references when available.'
};

function clientKey(req) {
  return req.user?.id || req.ip || 'anonymous';
}

function rateLimit({ windowMs, max, label }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${label}:${clientKey(req)}`;
    const bucket = requestBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'Too many requests. Pause briefly and try again.' });
      return;
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets) {
    if (bucket.resetAt < now) requestBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

function apiPaths(pathname) {
  return [pathname, pathname.replace(/^\/api/, '')];
}

function multipart(middleware) {
  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) {
        next();
        return;
      }
      const message = error instanceof multer.MulterError
        ? `Upload failed: ${error.message}`
        : error.message || 'Upload failed.';
      res.status(error instanceof multer.MulterError ? 413 : 400).json({ error: message });
    });
  };
}

async function handleUpload(req, res) {
  if (!req.files?.length) {
    res.status(400).json({ error: 'Upload at least one PDF.' });
    return;
  }

  try {
    const state = normalizeStudyState(req.user) || (req.user.studyState = emptyStudyState());
    if ((state.sources || []).length >= MAX_SOURCES) {
      res.status(400).json({ error: `You have reached the limit of ${MAX_SOURCES} sources. Delete one you no longer need, then add this one.` });
      return;
    }

    const sourceId = crypto.randomUUID();
    const vectorStore = await openaiClient.vectorStores.create({
      name: `Simav Dental Tutor study set ${new Date().toISOString()}`
    });

    const uploadedFiles = [];
    let textChars = 0;
    for (const file of req.files) {
      const openaiFile = await openaiClient.files.create({
        file: await toFile(fs.createReadStream(file.path), file.originalname, {
          type: file.mimetype || 'application/pdf'
        }),
        purpose: 'assistants'
      });

      await openaiClient.vectorStores.files.createAndPoll(vectorStore.id, {
        file_id: openaiFile.id
      });

      const extracted = await extractPdfText(file.path);
      const textExtracted = extracted.length >= 200 && writeSourceText(req.user.id, sourceId, openaiFile.id, extracted);
      if (textExtracted) textChars += extracted.length;

      uploadedFiles.push({
        originalName: file.originalname,
        fileId: openaiFile.id,
        textExtracted
      });
    }

    const source = {
      id: sourceId,
      title: uploadedFiles[0]?.originalName || 'PDF study set',
      sourceType: 'pdf',
      vectorStoreId: vectorStore.id,
      files: uploadedFiles,
      textChars,
      createdAt: new Date().toISOString()
    };
    state.sources.push(source);
    state.activeSourceId = source.id;
    state.sourceData[source.id] = emptySourceData();
    state.updatedAt = new Date().toISOString();
    incrementUsage(req.user, 'uploads', req.files.length);
    saveStore();

    res.json({ ...sourceListResponse(req.user), sourceId: source.id, vectorStoreId: vectorStore.id, files: uploadedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    for (const file of req.files || []) {
      fs.rm(file.path, { force: true }, () => {});
    }
  }
}

async function indexTextSource(req, res) {
  const title = trimForModel(req.body.title || 'Pasted dental study notes', 120);
  const text = String(req.body.text || '').trim();
  if (text.length < 80) {
    res.status(400).json({ error: 'Paste at least a short paragraph of dental study material.' });
    return;
  }
  if (text.length > 140000) {
    res.status(413).json({ error: 'Text source is too long. Split it into smaller sections.' });
    return;
  }

  try {
    const state = normalizeStudyState(req.user) || (req.user.studyState = emptyStudyState());
    if ((state.sources || []).length >= MAX_SOURCES) {
      res.status(400).json({ error: `You have reached the limit of ${MAX_SOURCES} sources. Delete one you no longer need, then add this one.` });
      return;
    }

    const sourceId = crypto.randomUUID();
    const vectorStore = await openaiClient.vectorStores.create({
      name: `Simav Dental Tutor text source ${new Date().toISOString()}`
    });
    const openaiFile = await openaiClient.files.create({
      file: await toFile(Buffer.from(text, 'utf8'), `${title.replace(/[^a-z0-9-]+/gi, '-').slice(0, 80)}.txt`, {
        type: 'text/plain'
      }),
      purpose: 'assistants'
    });

    await openaiClient.vectorStores.files.createAndPoll(vectorStore.id, {
      file_id: openaiFile.id
    });

    const textExtracted = writeSourceText(req.user.id, sourceId, openaiFile.id, text);
    const source = {
      id: sourceId,
      title,
      sourceType: 'text',
      vectorStoreId: vectorStore.id,
      files: [{ originalName: title, fileId: openaiFile.id, sourceType: 'text', textExtracted }],
      textChars: textExtracted ? text.length : 0,
      createdAt: new Date().toISOString()
    };
    state.sources.push(source);
    state.activeSourceId = source.id;
    state.sourceData[source.id] = emptySourceData();
    state.updatedAt = new Date().toISOString();
    incrementUsage(req.user, 'uploads');
    saveStore();
    res.json({ ...sourceListResponse(req.user), sourceId: source.id, vectorStoreId: vectorStore.id, files: source.files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const artifactPrompts = {
  flashcards:
    'Create 12 to 20 dental flashcards that together cover the whole provided material, not just its start. Return only valid JSON with this shape: {"cards":[{"question":"...","answer":"..."}]}. Use short, specific question fronts. Answer backs must be exam-complete: include the full list, classification, criteria, ages, or steps the source gives, not a one-line gist. Cover mechanisms, definitions, classifications, risk factors, clinical consequences, and anatomy.',
  notes:
    'Create clear, exam-focused dental study notes from the material. Use these sections: Core Idea, High-Yield Facts, Key Details, Clinical Relevance, Key Terms, Common Confusions, Exam Traps, Quick Checklist, Active-Recall Questions, 60-Second Recap. In Key Details, keep the full classifications, criteria, lists, ages, and protocol steps from the source. Use Markdown tables for comparisons and criteria. Do not draw horizontal-rule separator lines (no --- or *** lines) and do not use arrow-chain diagrams. Keep wording clean and scannable.',
  weakQuiz:
    'Create a targeted weak-spot quiz from the provided material. Include 6 questions, then a Markdown table with Question, Skill Tested, Marks, Common Error, Remediation.',
  caseStudy:
    'Create one compact board-style dental case study from the uploaded material. Use these sections: Patient Snapshot, Chief Complaint, Key Findings, Diagnostic Clues, Three Questions, Answer Key, Teaching Pearl. Use Markdown tables for findings, differential clues, and marking criteria. Make the case realistic and exam-focused.',
  mnemonics:
    'Create memorable mnemonics for the selected dental material. Use these sections: Key Facts, Mnemonics, Why It Works, Quick Recall Drill. Make mnemonics vivid but professional and easy to repeat.',
  conceptMap:
    'Create a text-based concept map from the uploaded material. Use these sections: Center Concept, Branches, Mechanism Flow, Clinical Links, What To Memorize, 3 Recall Prompts. Use a Markdown table for branches and clinical links. Make relationships explicit with arrows using plain ASCII like A -> B -> C.',
  clinicalChecklist:
    'Create a practical clinical checklist from the uploaded dental material. Use these sections: Before You Start, Look For, Decision Points, Red Flags, Chairside Language, Follow-Up. Keep it educational and exam-safe, not patient-specific medical advice.',
  examTraps:
    'Create an exam traps sheet from the uploaded material. Use these sections: Common Mistakes, Similar Terms, False Friends, What Examiners Like To Ask, Correct Reasoning. Explain why each trap is tempting and how to avoid it.',
  teachBack:
    'Create a teach-back drill from the uploaded material. Use these sections: 30-Second Version, 2-Minute Version, Whiteboard Flow, Self-Check, Follow-Up Questions. Make it something a dental student can say aloud while studying.',
  osce:
    'Create an OSCE-style dental station from the uploaded material. Use these sections: Station Brief, Candidate Tasks, Patient Script, Examiner Prompts, Critical Errors, Marking Rubric, Debrief, Next Remediation. Use Markdown tables for Candidate Tasks, Critical Errors, and Marking Rubric with marks. Keep it educational and not patient-specific medical advice.',
  adaptivePlan:
    'Create an adaptive remediation plan from the conversation and uploaded material. Use these sections: Mastery Snapshot, Weak Concepts, Why They Matter Clinically, 20-Minute Rescue Plan, Spaced Review Schedule, Next 5 Questions, Confidence Check.',
  curriculumMap:
    'Create a dental curriculum map from the uploaded material. Use Markdown tables for Module, Prerequisites, Core Concepts, Clinical Links, Assessment Tasks, and Mastery Criteria.',
  clinicalVisionChecklist:
    'Create a future clinical-observation checklist for professors or clinics based on the uploaded topic. Use these sections: Observable Finding, What It May Indicate, Questions To Ask, Evidence To Capture, Red Flags, Teaching Feedback. Keep it educational and avoid diagnosis.',
  ...Object.fromEntries(Object.entries(dentalosEngines).map(([key, engine]) => [key, engine.prompt]))
};

const personaInstructions = {
  peer: 'Tutor persona: supportive peer. Use warm, encouraging language, explain patiently, and keep the pace comfortable.',
  professor: 'Tutor persona: stern professor. Be formal, concise, exam-focused, and use rapid-fire questioning when in test mode.',
  clinic: 'Tutor persona: clinical mentor. Emphasize practical clinical reasoning, chairside relevance, and careful terminology.'
};

function parseCardsFromText(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.cards)) {
        return parsed.cards
          .filter((card) => card?.question && card?.answer)
          .map((card) => ({
            question: String(card.question).trim(),
            answer: String(card.answer).trim()
          }));
      }
    } catch {
      // Fall through to plain-text parsing.
    }
  }

  const cards = [];

  // Markdown table: | question | answer |  (models sometimes ignore the JSON ask)
  const tableRows = text.split('\n').map((l) => l.trim()).filter((l) => /^\|.*\|$/.test(l));
  if (tableRows.length >= 2) {
    const rows = tableRows.map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
    for (const r of rows) {
      if (r.length < 2) continue;
      if (/^[-:\s]+$/.test(r[0])) continue; // separator row
      if (/^(question|front|term|q|card)$/i.test(r[0])) continue; // header row
      const q = r[0].replace(/\*\*/g, '').trim();
      const a = r.slice(1).join(' ').replace(/\*\*/g, '').trim();
      if (q && a) cards.push({ question: q, answer: a });
    }
    if (cards.length) return cards;
  }

  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const question = block.match(/(?:Q|Question)\s*\d*\s*[:.-]\s*(.+)/i)?.[1]?.trim();
    const answer = block.match(/(?:A|Answer)\s*\d*\s*[:.-]\s*([\s\S]+)/i)?.[1]?.trim();
    if (question && answer) cards.push({ question, answer });
  }
  if (cards.length) return cards;

  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 18);

  for (let index = 0; index < lines.length - 1 && cards.length < 12; index += 2) {
    const first = lines[index].replace(/^(front|question):\s*/i, '').trim();
    const second = lines[index + 1].replace(/^(back|answer):\s*/i, '').trim();
    if (first && second) cards.push({ question: first, answer: second });
  }
  return cards;
}

function buildConversationInput(message, history = []) {
  const recentHistory = history
    .slice(-8)
    .map((item) => `${item.role === 'assistant' ? 'Tutor' : 'Student'}: ${trimForModel(item.text, 600)}`)
    .join('\n\n');

  if (!recentHistory) return trimForModel(message, 6000);
  return `Recent study conversation:\n${recentHistory}\n\nCurrent student message:\n${trimForModel(message, 6000)}`;
}

function isOpenAIVectorStoreId(value) {
  return typeof value === 'string' && /^vs[_-]/.test(value);
}

function joinContinuation(soFar, next) {
  if (!soFar) return next;
  if (!next) return soFar;
  // The continuation resumes mid-thought, so avoid inserting a space inside a
  // word while still keeping paragraph and list breaks readable.
  if (/\s$/.test(soFar) || /^\s/.test(next)) return soFar + next;
  return `${soFar} ${next}`;
}

async function createResponse({ source, input, mode, history, persona = 'peer', rawText = null, jsonSchema = null }) {
  const vectorStoreId = source?.vectorStoreId;
  const hasSearchableSource = !rawText && isOpenAIVectorStoreId(vectorStoreId);
  const maxOutputTokens = outputLimits[mode] ?? engineOutputLimitFor(mode) ?? 1800;
  const styleClause = fullTextModes.has(mode) ? completenessClause : conciseClause;
  const sourceStatus = rawText
    ? 'The complete source text is included in the message. Base the answer on it and cover it fully.'
    : hasSearchableSource
      ? 'A searchable uploaded source is available. Use file search before answering.'
      : 'No valid searchable source is attached for this local/test session. Use only the conversation and prompt context; if source context is missing, say so briefly instead of inventing citations.';
  const baseOptions = {
    model: defaultModel,
    instructions: `${tutorInstructions}\n\n${styleClause}\n\n${personaInstructions[persona] ?? personaInstructions.peer}\n\nSource status: ${sourceStatus}\n\nMode: ${mode}. ${modePrompts[mode] ?? modePrompts.answer}`,
    max_output_tokens: maxOutputTokens
  };

  if (hasSearchableSource) {
    // Retrieve more passages so classifications, criteria, and protocol steps
    // are not dropped before the model even sees them.
    baseOptions.tools = [
      {
        type: 'file_search',
        vector_store_ids: [vectorStoreId],
        max_num_results: 25
      }
    ];
  }

  if (jsonSchema) {
    baseOptions.text = {
      format: { type: 'json_schema', name: jsonSchema.name, strict: true, schema: jsonSchema.schema }
    };
  }

  // The raw source block sits outside trimForModel on purpose: it must reach
  // the model whole, never whitespace-collapsed or sliced.
  const conversation = buildConversationInput(input, history);
  const composedInput = rawText
    ? `Full study source text (use all of it, it is the complete material):\n<<<SOURCE\n${rawText}\nSOURCE>>>\n\n${conversation}`
    : conversation;

  let response = await openaiClient.responses.create({
    ...baseOptions,
    input: composedInput
  });
  let combined = response.output_text || '';

  // Structured JSON cannot be stitched across continuations; if the first try
  // was cut off at the cap, regenerate once with a smaller ask instead.
  if (jsonSchema) {
    if (response.status === 'incomplete') {
      try {
        response = await openaiClient.responses.create({
          ...baseOptions,
          input: `${composedInput}\n\nReturn at most 8 cards with shorter answers.`
        });
        if (response.output_text) combined = response.output_text;
      } catch (retryError) {
        console.error('Structured retry failed:', retryError.message);
      }
    }
    return combined;
  }

  // Safety net: if the answer was cut off at the token cap, transparently ask
  // the model to keep going from where it stopped so the student still gets
  // every section, table row, differential, and protocol step.
  let continuations = 0;
  try {
    while (
      response.status === 'incomplete' &&
      response.incomplete_details?.reason === 'max_output_tokens' &&
      continuations < 3
    ) {
      continuations += 1;
      response = await openaiClient.responses.create({
        ...baseOptions,
        previous_response_id: response.id,
        input:
          'Continue the previous answer from the exact word where it stopped. Do not repeat earlier text, do not restate the introduction, and finish every remaining section, table row, and list item.'
      });
      const next = response.output_text || '';
      if (!next.trim()) break;
      combined = joinContinuation(combined, next);
    }
  } catch (continuationError) {
    // Keep whatever we have rather than failing the whole request.
    console.error('Answer continuation failed:', continuationError.message);
  }

  return combined;
}

app.get(apiPaths('/api/health'), (_req, res) => {
  res.json({
    ok: true,
    model: defaultModel,
    storage: postgresPool ? 'postgres' : 'json-file',
    maxUploadMb,
    features: ['pdf-rag', 'text-source', 'voice', 'osce', 'adaptive-remediation', 'curriculum-map']
  });
});

app.post(apiPaths('/api/auth/signup'), rateLimit({ windowMs: 15 * 60 * 1000, max: 20, label: 'signup' }), (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (name.length < 2) {
    res.status(400).json({ error: 'Enter your name.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Use at least 8 characters for the password.' });
    return;
  }
  if (store.users.some((user) => user.email === email)) {
    res.status(409).json({ error: 'An account already exists for this email.' });
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
      passwordHash: hashPassword(password),
      studyState: null,
      usage: { date: todayKey(), aiCalls: 0, uploads: 0, dailyAiBudget },
      createdAt: new Date().toISOString()
  };
  store.users.push(user);
  saveStore();

  const token = createAuthSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ user: publicUser(user) });
});

app.post(apiPaths('/api/auth/login'), rateLimit({ windowMs: 15 * 60 * 1000, max: 30, label: 'login' }), (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = store.users.find((item) => item.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Email or password is incorrect.' });
    return;
  }

  const token = createAuthSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ user: publicUser(user) });
});

app.get(apiPaths('/api/auth/me'), requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post(apiPaths('/api/auth/logout'), requireAuth, (req, res) => {
  authSessions.delete(req.authToken);
  if (postgresPool) {
    const tokenHash = crypto.createHash('sha256').update(req.authToken).digest('hex');
    postgresPool.query('delete from auth_sessions where token_hash = $1', [tokenHash]).catch(() => {});
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.get(apiPaths('/api/session'), requireAuth, (req, res) => {
  const state = normalizeStudyState(req.user);
  if (!state) {
    res.json({ studyState: null });
    return;
  }
  res.json({ studyState: { ...state, studySet: legacyStudySetProjection(req.user) } });
});

// Sources and the active source are server-owned; the client can only write
// its per-source study data, page, persona, and learning progress. A stale tab
// can never resurrect a deleted or replaced source.
app.put(apiPaths('/api/session'), requireAuth, (req, res) => {
  const { sourceData, page, voicePersona, learning } = req.body || {};
  const state = normalizeStudyState(req.user) || (req.user.studyState = emptyStudyState());

  if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
    const validIds = new Set([...(state.sources || []).map((source) => source.id), 'unassigned']);
    const nextData = {};
    for (const [key, value] of Object.entries(sourceData)) {
      if (!validIds.has(key) || !value || typeof value !== 'object') continue;
      nextData[key] = {
        chat: Array.isArray(value.chat) ? value.chat.slice(-200) : [],
        flashcards: Array.isArray(value.flashcards) ? value.flashcards.slice(0, 300) : [],
        notes: String(value.notes || '').slice(0, 120000)
      };
    }
    state.sourceData = nextData;
  }

  if (typeof page === 'string') state.page = page;
  if (typeof voicePersona === 'string') state.voicePersona = voicePersona;
  if (learning && typeof learning === 'object' && !Array.isArray(learning)) state.learning = learning;
  state.updatedAt = new Date().toISOString();
  saveStore();
  res.json({ ok: true });
});

app.delete(apiPaths('/api/session'), requireAuth, async (req, res) => {
  const state = normalizeStudyState(req.user);
  if (state && process.env.OPENAI_API_KEY) {
    openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    for (const source of state.sources || []) {
      try { await deleteRemoteSource(req.user.id, source); } catch { /* best effort */ }
    }
  }
  req.user.studyState = null;
  saveStore();
  res.json({ ok: true });
});

app.post(apiPaths('/api/source/activate'), requireAuth, (req, res) => {
  const state = normalizeStudyState(req.user);
  const source = state ? findSource(req.user, String(req.body?.sourceId || '')) : null;
  if (!source) {
    res.status(404).json({ error: 'Source not found.' });
    return;
  }
  state.activeSourceId = source.id;
  state.updatedAt = new Date().toISOString();
  saveStore();
  res.json(sourceListResponse(req.user));
});

app.post(apiPaths('/api/upload'), requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 24, label: 'upload' }), requireAiBudget, requireApiKey, multipart(pdfUpload.array('pdfs', 8)), handleUpload);

app.post(apiPaths('/api/text-source'), requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 30, label: 'text-source' }), requireAiBudget, requireApiKey, indexTextSource);

// Remove a whole source ({ sourceId }) or a single file within one (legacy
// { vectorStoreId, fileId }). Only sources owned by the signed-in user can be
// touched. Deletes the OpenAI files/vector store and the raw text on disk.
app.post(apiPaths('/api/source/delete'), requireAuth, requireApiKey, async (req, res) => {
  const { sourceId, vectorStoreId, fileId } = req.body || {};
  const state = normalizeStudyState(req.user);
  if (!state) {
    res.status(400).json({ error: 'Nothing to delete.' });
    return;
  }
  try {
    if (sourceId) {
      const source = findSource(req.user, String(sourceId));
      if (!source) {
        res.status(404).json({ error: 'Source not found.' });
        return;
      }
      await deleteRemoteSource(req.user.id, source);
      removeSourceFromState(state, source.id);
    } else if (vectorStoreId && fileId) {
      const source = (state.sources || []).find((item) => item.vectorStoreId === vectorStoreId);
      if (!source) {
        res.status(404).json({ error: 'Source not found.' });
        return;
      }
      try { await openaiClient.vectorStores.files.del(source.vectorStoreId, fileId); } catch { /* already gone */ }
      try { await openaiClient.files.del(fileId); } catch { /* already gone */ }
      deleteSourceTextFile(req.user.id, source.id, fileId);
      source.files = (source.files || []).filter((file) => file.fileId !== fileId);
      source.textChars = (source.files || []).reduce((sum, file) => {
        if (!file.textExtracted) return sum;
        try { return sum + fs.readFileSync(sourceTextPath(req.user.id, source.id, file.fileId), 'utf8').length; } catch { return sum; }
      }, 0);
      if (!source.files.length) {
        try { await openaiClient.vectorStores.del(source.vectorStoreId); } catch { /* already gone */ }
        deleteSourceTextDir(req.user.id, source.id);
        removeSourceFromState(state, source.id);
      }
    } else {
      res.status(400).json({ error: 'sourceId, or vectorStoreId and fileId, are required.' });
      return;
    }
    state.updatedAt = new Date().toISOString();
    saveStore();
    res.json(sourceListResponse(req.user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(apiPaths('/api/study'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 18, label: 'study' }), requireAiBudget, requireApiKey, async (req, res) => {
  const { message, mode = 'answer', history = [], persona = 'peer' } = req.body;
  if (!message) {
    res.status(400).json({ error: 'message is required.' });
    return;
  }
  const studySource = resolveRequestSource(req);
  if (!studySource) {
    res.status(400).json({ error: 'Add a study source first.' });
    return;
  }

  try {
    const rawText = mode === 'summary' ? readCombinedSourceText(req.user.id, studySource) : null;
    const text = await createResponse({ source: studySource, input: message, mode, history, persona, rawText });
    incrementUsage(req.user, 'aiCalls');
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(apiPaths('/api/artifact'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 12, label: 'artifact' }), requireAiBudget, requireApiKey, async (req, res) => {
  const { type = 'notes', source: selection = '', history = [], persona = 'peer' } = req.body;
  const studySource = resolveRequestSource(req);
  if (!studySource) {
    res.status(400).json({ error: 'Add a study source first.' });
    return;
  }

  try {
    const prompt = artifactPrompts[type] ?? enginePromptFor(type) ?? artifactPrompts.notes;
    const rawText = fullTextModes.has(type) ? readCombinedSourceText(req.user.id, studySource) : null;
    const jsonSchema = type === 'flashcards' ? flashcardsSchema : null;

    // When the student asks for more flashcards, tell the model which cards
    // already exist so it makes new ones instead of repeating the old set.
    let avoidRepeats = '';
    if (type === 'flashcards') {
      const bodyExisting = Array.isArray(req.body.existingQuestions) ? req.body.existingQuestions : [];
      const savedExisting = (req.user.studyState?.sourceData?.[studySource.id]?.flashcards || []).map((card) => card?.question);
      const existing = [...new Set([...bodyExisting, ...savedExisting].map((question) => String(question || '').trim()).filter(Boolean))].slice(0, 120);
      if (existing.length) {
        avoidRepeats = `\n\nThe student already has flashcards for these questions. Do not repeat or lightly rephrase them. Create new cards from parts of the material not yet covered:\n- ${existing.join('\n- ')}`;
      }
    }

    const text = await createResponse({
      source: studySource,
      mode: type,
      history,
      persona,
      rawText,
      jsonSchema,
      input: `${prompt}\n\nStudent-selected material or request:\n${selection || 'Use the uploaded study source.'}${avoidRepeats}`
    });
    incrementUsage(req.user, 'aiCalls');
    if (type === 'flashcards') {
      let cards = [];
      try {
        const parsed = JSON.parse(text);
        cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
          .filter((card) => card?.question && card?.answer)
          .map((card) => ({ question: String(card.question).trim(), answer: String(card.answer).trim() }));
      } catch {
        cards = parseCardsFromText(text);
      }
      res.json({
        text: cards.length ? `Created ${cards.length} flashcards.` : text,
        cards
      });
      return;
    }
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Radiology X-ray interpreter: vision feedback on a student's reading of an
// X-ray. The client sends a rasterised image (data URL, since the demo cases are
// SVG and OpenAI vision needs raster), the student's text, and the case's
// reference findings. We return structured, formative feedback as JSON.
function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

app.post(apiPaths('/api/radiology/interpret'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 12, label: 'radiology' }), requireAiBudget, requireApiKey, async (req, res) => {
  const { interpretation = '', keyFindings = [], image, caseTitle = '', caseType = '' } = req.body;
  if (!image || !String(interpretation).trim()) {
    res.status(400).json({ error: 'An image and a written interpretation are required.' });
    return;
  }
  try {
    const reference = Array.isArray(keyFindings) && keyFindings.length
      ? `Reference findings for this case (use your own judgement against the image; do not just echo these):\n- ${keyFindings.join('\n- ')}`
      : '';
    const instructions = [
      'You are a dental radiology tutor giving formative feedback to a dental student on how they read an X-ray.',
      'Be encouraging, specific, and educational. Ground every point in what is actually visible in the image.',
      'Do not invent findings that are not supported by the image. Keep each bullet to one concise sentence.',
      `Case: ${caseTitle} (${caseType}).`,
      reference,
      `Student's interpretation:\n"""${String(interpretation).slice(0, 2000)}"""`,
      'Respond ONLY with a JSON object of this exact shape, no prose around it:',
      '{ "score": <integer 0-100>, "correct": [string], "missed": [string], "landmarks": [string], "significance": string }',
      'Where: correct = what the student identified correctly; missed = important findings they did not mention; landmarks = key landmarks or a systematic search order to look for next time; significance = the clinical significance of the main finding(s).'
    ].filter(Boolean).join('\n\n');

    const response = await openaiClient.responses.create({
      model: defaultModel,
      max_output_tokens: 900,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: instructions },
            { type: 'input_image', image_url: image }
          ]
        }
      ]
    });
    incrementUsage(req.user, 'aiCalls');
    const raw = response.output_text || '';
    const data = extractJson(raw);
    if (!data) {
      res.json({ score: null, correct: [], missed: [], landmarks: [], significance: raw });
      return;
    }
    res.json({
      score: typeof data.score === 'number' ? Math.max(0, Math.min(100, Math.round(data.score))) : null,
      correct: Array.isArray(data.correct) ? data.correct : [],
      missed: Array.isArray(data.missed) ? data.missed : [],
      landmarks: Array.isArray(data.landmarks) ? data.landmarks : [],
      significance: typeof data.significance === 'string' ? data.significance : ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(apiPaths('/api/transcribe'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 20, label: 'voice' }), requireAiBudget, requireApiKey, multipart(audioUpload.single('audio')), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Audio file is required.' });
    return;
  }

  try {
    const transcription = await openaiClient.audio.transcriptions.create({
      file: await toFile(fs.createReadStream(req.file.path), req.file.originalname || 'student-question.webm', {
        type: req.file.mimetype || 'audio/webm'
      }),
      model: 'gpt-4o-mini-transcribe',
      prompt:
        'Dental education audio. Expect terms like enamel, dentin, pulp, mandibular, maxillary, trigeminal, V3, inferior alveolar nerve, odontoblast, cementum, and foramen.'
    });
    incrementUsage(req.user, 'aiCalls');

    res.json({ text: transcription.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.rm(req.file.path, { force: true }, () => {});
  }
});

app.post(apiPaths('/api/speak'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 20, label: 'speak' }), requireAiBudget, requireApiKey, async (req, res) => {
  const { text, voice = 'cedar', persona = 'peer' } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Text is required.' });
    return;
  }

  const id = crypto.randomUUID();
  speechSessions.set(id, {
    text: text.slice(0, 2600),
    voice,
    persona,
    userId: req.user.id,
    createdAt: Date.now()
  });
  incrementUsage(req.user, 'aiCalls');

  res.json({ speechId: id, audioUrl: `/api/speak/${id}` });
});

app.get(apiPaths('/api/speak/:id'), requireAuth, requireApiKey, async (req, res) => {
  const session = speechSessions.get(req.params.id);
  if (!session || session.userId !== req.user.id) {
    res.status(404).json({ error: 'Speech session expired.' });
    return;
  }
  speechSessions.delete(req.params.id);

  try {
    const speech = await openaiClient.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: session.voice,
      input: session.text,
      instructions:
        session.persona === 'professor'
          ? 'Speak like a formal dental professor. Crisp, precise, and exam-focused.'
          : session.persona === 'clinic'
            ? 'Speak like a calm clinical dental mentor. Practical, precise, and reassuring.'
            : 'Speak like a supportive dental school study peer. Natural, warm, and clear with anatomical terms.'
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    if (speech.body) {
      Readable.fromWeb(speech.body).pipe(res);
      return;
    }

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

setInterval(() => {
  const expiresBefore = Date.now() - 5 * 60 * 1000;
  for (const [id, session] of speechSessions) {
    if (session.createdAt < expiresBefore) speechSessions.delete(id);
  }
}, 60 * 1000).unref();

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.method !== 'GET') {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
    return;
  }
  next();
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function startServer() {
  try {
    const usingPostgres = await initializePostgresStore();
    if (!usingPostgres) store = loadJsonStore();
  } catch (error) {
    console.error(`Postgres unavailable, falling back to JSON store: ${error.message}`);
    store = loadJsonStore();
  }

  app.listen(port, host, () => {
    console.log(`Simav Dental Tutor API running on http://${host}:${port}`);
  });
}

startServer();
