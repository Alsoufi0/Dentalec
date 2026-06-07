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
const outputLimits = {
  answer: 750,
  summary: 950,
  explanation: 850,
  test: 1100,
  flashcards: 900,
  notes: 950,
  weakQuiz: 950,
  caseStudy: 1050,
  mnemonics: 850,
  conceptMap: 850,
  clinicalChecklist: 800,
  examTraps: 800,
  teachBack: 800,
  osce: 1100,
  adaptivePlan: 900,
  curriculumMap: 950,
  clinicalVisionChecklist: 850,
  ...Object.fromEntries(Object.values(dentalosEngines).map((engine) => [engine.mode, engine.outputLimit]))
};

function trimForModel(value, limit = 1800) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

const tutorInstructions = `You are a dental school study tutor. Search the uploaded PDFs before answering. Base your answer on the uploaded course material whenever relevant snippets are found. For broad or informal questions, infer the likely dental topic, search for nearby terms, and explain the matching source material in clear student language. Format answers with short section headings and clean numbered or bulleted lines. Use Markdown tables for rubrics, comparison grids, diagnostic criteria, protocols, decision pathways, marking schemes, and feature lists. Preserve important details; simplify by structuring information visually, never by deleting criteria, classifications, differentials, complications, prognosis, or protocol steps. Do not use decorative symbols, emoji, or casual filler. If the uploaded source truly has no relevant content, say what is missing and offer a short general dental-study explanation clearly labeled as general background. Be precise with anatomy, pathology, materials, procedures, and terminology. Never present yourself as a licensed clinician.`;

const modePrompts = {
  summary:
    'Create a premium dental study summary. Use these sections: Core Idea, Visual Structure Map, High-Yield Facts, Clinical Relevance, Key Terms, Common Confusions, Exam Traps, Chairside Checklist, Active-Recall Questions, 60-Second Recap. Keep each section concise and useful for studying. Include page/source references when available.',
  explanation:
    'Explain the topic like a calm dental tutor. Start with the plain-language idea, then add dental-school mechanism, clinical relevance, and a quick memory hook.',
  test:
    'Act as a professional oral-exam coach. If the student asks to be tested, use exactly these sections: Overview, Question 1 - Quick Recall, Question 2 - Clinical Vignette, Question 3 - Compare and Contrast, Question 4 - Anatomy or Mechanism, Question 5 - Error Spotting, Question 6 - Challenge Case, Answer Rubric, Next Step. Keep each question clearly separated. Use a Markdown table for Answer Rubric or marking criteria with columns such as Criteria, Marks, Comments. If the student is answering a prior quiz question, grade the answer kindly under Assessment, correct misconceptions under Correction, and ask one focused follow-up under Next Question.',
  answer:
    'Answer the student question using the uploaded PDF material. If the wording is broad, search for the key dental concepts and synthesize the relevant parts. Include source/page references when available.'
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
    const vectorStore = await openaiClient.vectorStores.create({
      name: `Simav Dental Tutor study set ${new Date().toISOString()}`
    });

    const uploadedFiles = [];
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

      uploadedFiles.push({
        originalName: file.originalname,
        fileId: openaiFile.id
      });
    }

    const studySet = {
      vectorStoreId: vectorStore.id,
      files: uploadedFiles
    };
    req.user.studyState = {
      studySet,
      chat: [
        {
          role: 'assistant',
          text: 'Your PDF set is indexed. You can ask a question, request a summary, or switch to Test mode for an oral exam.',
          mode: 'answer',
          id: crypto.randomUUID()
        }
      ],
      flashcards: [],
      notes: '',
      page: 'dashboard',
      voicePersona: 'peer',
      updatedAt: new Date().toISOString()
    };
    incrementUsage(req.user, 'uploads', req.files.length);
    saveStore();

    res.json(studySet);
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

    const studySet = {
      vectorStoreId: vectorStore.id,
      files: [{ originalName: title, fileId: openaiFile.id, sourceType: 'text' }]
    };
    req.user.studyState = {
      studySet,
      chat: [
        {
          role: 'assistant',
          text: 'Your pasted dental material is indexed. You can ask questions, generate a summary, build flashcards, or start an OSCE-style drill.',
          mode: 'answer',
          id: crypto.randomUUID()
        }
      ],
      flashcards: [],
      notes: '',
      page: 'dashboard',
      voicePersona: 'peer',
      learning: { mastery: {}, reviews: {}, curriculum: [] },
      updatedAt: new Date().toISOString()
    };
    incrementUsage(req.user, 'uploads');
    saveStore();
    res.json(studySet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const artifactPrompts = {
  flashcards:
    'Create 10 concise dental flashcards from the provided material. Return only valid JSON with this shape: {"cards":[{"question":"...","answer":"..."}]}. Use short question fronts and exam-focused answer backs. Focus on mechanisms, definitions, classifications, clinical consequences, and anatomy.',
  notes:
    'Create premium dental study notes from the material. Use these sections: Core Idea, Visual Structure Map, High-Yield Facts, Clinical Relevance, Key Terms, Common Confusions, Exam Traps, Chairside Checklist, Active-Recall Questions, 60-Second Recap. Keep wording clean, scannable, and exam-focused.',
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

  if (!recentHistory) return trimForModel(message, 1800);
  return `Recent study conversation:\n${recentHistory}\n\nCurrent student message:\n${trimForModel(message, 1800)}`;
}

function isOpenAIVectorStoreId(value) {
  return typeof value === 'string' && /^vs[_-]/.test(value);
}

async function createResponse({ vectorStoreId, input, mode, history, persona = 'peer' }) {
  const hasSearchableSource = isOpenAIVectorStoreId(vectorStoreId);
  const responseOptions = {
    model: defaultModel,
    instructions: `${tutorInstructions}\n\n${personaInstructions[persona] ?? personaInstructions.peer}\n\nSource status: ${
      hasSearchableSource
        ? 'A searchable uploaded source is available. Use file search before answering.'
        : 'No valid searchable source is attached for this local/test session. Use only the conversation and prompt context; if source context is missing, say so briefly instead of inventing citations.'
    }\n\nMode: ${mode}. ${modePrompts[mode] ?? modePrompts.answer}`,
    input: buildConversationInput(input, history),
    max_output_tokens: outputLimits[mode] ?? engineOutputLimitFor(mode) ?? 850
  };

  if (hasSearchableSource) {
    responseOptions.tools = [
      {
        type: 'file_search',
        vector_store_ids: [vectorStoreId],
        max_num_results: ['test', 'caseStudy', 'weakQuiz', 'conceptMap'].includes(mode) ? 4 : 3
      }
    ];
  }

  const response = await openaiClient.responses.create(responseOptions);

  return response.output_text;
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
  res.json({ studyState: req.user.studyState || null });
});

app.put(apiPaths('/api/session'), requireAuth, (req, res) => {
  const { studySet = null, chat = [], flashcards = [], notes = '', page = 'dashboard', voicePersona = 'peer', learning = {} } = req.body || {};
  req.user.studyState = {
    studySet,
    chat: Array.isArray(chat) ? chat.slice(-120) : [],
    flashcards: Array.isArray(flashcards) ? flashcards.slice(0, 300) : [],
    notes: String(notes || '').slice(0, 120000),
    page,
    voicePersona,
    learning: typeof learning === 'object' && learning ? learning : {},
    updatedAt: new Date().toISOString()
  };
  saveStore();
  res.json({ ok: true });
});

app.delete(apiPaths('/api/session'), requireAuth, (req, res) => {
  req.user.studyState = null;
  saveStore();
  res.json({ ok: true });
});

app.post(apiPaths('/api/upload'), requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 24, label: 'upload' }), requireAiBudget, requireApiKey, multipart(pdfUpload.array('pdfs', 8)), handleUpload);

app.post(apiPaths('/api/text-source'), requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 30, label: 'text-source' }), requireAiBudget, requireApiKey, indexTextSource);

app.post(apiPaths('/api/study'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 18, label: 'study' }), requireAiBudget, requireApiKey, async (req, res) => {
  const { vectorStoreId, message, mode = 'answer', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId || !message) {
    res.status(400).json({ error: 'vectorStoreId and message are required.' });
    return;
  }

  try {
    const text = await createResponse({ vectorStoreId, input: message, mode, history, persona });
    incrementUsage(req.user, 'aiCalls');
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(apiPaths('/api/artifact'), requireAuth, rateLimit({ windowMs: 60 * 1000, max: 12, label: 'artifact' }), requireAiBudget, requireApiKey, async (req, res) => {
  const { vectorStoreId, type = 'notes', source = '', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId) {
    res.status(400).json({ error: 'vectorStoreId is required.' });
    return;
  }

  try {
    const prompt = artifactPrompts[type] ?? enginePromptFor(type) ?? artifactPrompts.notes;
    const text = await createResponse({
      vectorStoreId,
      mode: type,
      history,
      persona,
      input: `${prompt}\n\nStudent-selected material or request:\n${source || 'Use the uploaded PDF study set.'}`
    });
    incrementUsage(req.user, 'aiCalls');
    if (type === 'flashcards') {
      const cards = parseCardsFromText(text);
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
