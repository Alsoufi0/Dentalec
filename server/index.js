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
let openaiClient;
const speechSessions = new Map();
const authSessions = new Map();
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dataPath = path.join(dataDir, 'app-data.json');
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const distPath = path.join(__dirname, '..', 'dist');

function createEmptyStore() {
  return { users: [] };
}

function loadStore() {
  try {
    if (!fs.existsSync(dataPath)) return createEmptyStore();
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return createEmptyStore();
  }
}

let store = loadStore();

function saveStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  const temporaryPath = `${dataPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2));
  fs.renameSync(temporaryPath, dataPath);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
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
  authSessions.set(token, {
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
  });
  return token;
}

function findUserById(userId) {
  return store.users.find((user) => user.id === userId);
}

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

const requireApiKey = (_req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY in .env' });
    return;
  }
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  next();
};

const tutorInstructions = `You are a dental school study tutor. Search the uploaded PDFs before answering. Base your answer on the uploaded course material whenever relevant snippets are found. For broad or informal questions, infer the likely dental topic, search for nearby terms, and explain the matching source material in clear student language. Format answers with short section headings and clean numbered or bulleted lines. Do not use decorative symbols, emoji, or casual filler. If the uploaded source truly has no relevant content, say what is missing and offer a short general dental-study explanation clearly labeled as general background. Be precise with anatomy, pathology, materials, procedures, and terminology. Never present yourself as a licensed clinician.`;

const modePrompts = {
  summary:
    'Create a structured study summary. Include: 1) three-sentence overview, 2) high-yield facts, 3) dental terms to memorize, 4) common exam traps, 5) a mini oral recap the student can say out loud. Include page/source references when available.',
  explanation:
    'Explain the topic like a calm dental tutor. Start with the plain-language idea, then add dental-school mechanism, clinical relevance, and a quick memory hook.',
  test:
    'Act as a professional oral-exam coach. If the student asks to be tested, use exactly these sections: Overview, Question 1 - Quick Recall, Question 2 - Clinical Vignette, Question 3 - Compare and Contrast, Question 4 - Anatomy or Mechanism, Question 5 - Error Spotting, Question 6 - Challenge Case, Answer Rubric, Next Step. Keep each question clearly separated. For each question include what a strong answer should mention and a short explanation. If the student is answering a prior quiz question, grade the answer kindly under Assessment, correct misconceptions under Correction, and ask one focused follow-up under Next Question.',
  answer:
    'Answer the student question using the uploaded PDF material. If the wording is broad, search for the key dental concepts and synthesize the relevant parts. Include source/page references when available.'
};

const artifactPrompts = {
  flashcards:
    'Create 12 concise dental flashcards from the provided material. Return only valid JSON with this shape: {"cards":[{"question":"...","answer":"..."}]}. Focus on exam-relevant mechanisms, definitions, classifications, clinical consequences, and anatomy.',
  notes:
    'Create polished study notes from the provided material. Use headings, concise bullets, key terms, clinical relevance, and a final active-recall checklist.',
  weakQuiz:
    'Create a targeted weak-spot quiz from the provided material. Include 6 questions, answer rubric, and one short remediation note for each question.',
  caseStudy:
    'Create a board-style dental case study from the uploaded material. Use these sections: Patient Snapshot, Chief Complaint, History, Clinical Findings, Radiographic or Diagnostic Clues, Question Set, Answer Key, Teaching Pearl. Make the case realistic and exam-focused.',
  mnemonics:
    'Create memorable mnemonics for the selected dental material. Use these sections: Key Facts, Mnemonics, Why It Works, Quick Recall Drill. Make mnemonics vivid but professional and easy to repeat.'
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
    const question = block.match(/Q:\s*(.+)/i)?.[1]?.trim();
    const answer = block.match(/A:\s*([\s\S]+)/i)?.[1]?.trim();
    if (question && answer) cards.push({ question, answer });
  }
  return cards;
}

function buildConversationInput(message, history = []) {
  const recentHistory = history
    .slice(-8)
    .map((item) => `${item.role === 'assistant' ? 'Tutor' : 'Student'}: ${item.text}`)
    .join('\n\n');

  if (!recentHistory) return message;
  return `Recent study conversation:\n${recentHistory}\n\nCurrent student message:\n${message}`;
}

async function createResponse({ vectorStoreId, input, mode, history, persona = 'peer' }) {
  const response = await openaiClient.responses.create({
    model: 'gpt-4.1',
    instructions: `${tutorInstructions}\n\n${personaInstructions[persona] ?? personaInstructions.peer}\n\nMode: ${mode}. ${modePrompts[mode] ?? modePrompts.answer}`,
    input: buildConversationInput(input, history),
    tools: [
      {
        type: 'file_search',
        vector_store_ids: [vectorStoreId]
      }
    ]
  });

  return response.output_text;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/signup', (req, res) => {
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
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  saveStore();

  const token = createAuthSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
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

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  authSessions.delete(req.authToken);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.get('/api/session', requireAuth, (req, res) => {
  res.json({ studyState: req.user.studyState || null });
});

app.put('/api/session', requireAuth, (req, res) => {
  const { studySet = null, chat = [], flashcards = [], notes = '', page = 'dashboard', voicePersona = 'peer' } = req.body || {};
  req.user.studyState = {
    studySet,
    chat: Array.isArray(chat) ? chat.slice(-120) : [],
    flashcards: Array.isArray(flashcards) ? flashcards.slice(0, 300) : [],
    notes: String(notes || '').slice(0, 120000),
    page,
    voicePersona,
    updatedAt: new Date().toISOString()
  };
  saveStore();
  res.json({ ok: true });
});

app.delete('/api/session', requireAuth, (req, res) => {
  req.user.studyState = null;
  saveStore();
  res.json({ ok: true });
});

app.post('/api/upload', requireAuth, requireApiKey, upload.array('pdfs', 8), async (req, res) => {
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
    saveStore();

    res.json(studySet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    for (const file of req.files) {
      fs.rm(file.path, { force: true }, () => {});
    }
  }
});

app.post('/api/study', requireAuth, requireApiKey, async (req, res) => {
  const { vectorStoreId, message, mode = 'answer', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId || !message) {
    res.status(400).json({ error: 'vectorStoreId and message are required.' });
    return;
  }

  try {
    const text = await createResponse({ vectorStoreId, input: message, mode, history, persona });
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/artifact', requireAuth, requireApiKey, async (req, res) => {
  const { vectorStoreId, type = 'notes', source = '', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId) {
    res.status(400).json({ error: 'vectorStoreId is required.' });
    return;
  }

  try {
    const prompt = artifactPrompts[type] ?? artifactPrompts.notes;
    const text = await createResponse({
      vectorStoreId,
      mode: type === 'weakQuiz' ? 'test' : 'summary',
      history,
      persona,
      input: `${prompt}\n\nStudent-selected material or request:\n${source || 'Use the uploaded PDF study set.'}`
    });
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

app.post('/api/transcribe', requireAuth, requireApiKey, upload.single('audio'), async (req, res) => {
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

    res.json({ text: transcription.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.rm(req.file.path, { force: true }, () => {});
  }
});

app.post('/api/speak', requireAuth, requireApiKey, async (req, res) => {
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

  res.json({ speechId: id, audioUrl: `/api/speak/${id}` });
});

app.get('/api/speak/:id', requireAuth, requireApiKey, async (req, res) => {
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

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, host, () => {
  console.log(`Simav Dental Tutor API running on http://${host}:${port}`);
});
