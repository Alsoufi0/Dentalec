import fs from 'node:fs';

const serverPath = 'server/index.js';
let server = fs.readFileSync(serverPath, 'utf8');

if (!server.includes('function artifactCacheKey')) {
  server = server.replace(
    'const tutorInstructions = `You are Simav Dental Tutor, a dental school study tutor.',
    `function artifactCacheKey({ vectorStoreId, type, source, persona }) {
  const raw = JSON.stringify({ vectorStoreId, type, source: trimForModel(source, 900), persona });
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function getArtifactCache(user) {
  user.studyCache ??= { artifacts: {} };
  user.studyCache.artifacts ??= {};
  return user.studyCache.artifacts;
}

const tutorInstructions = \`You are Simav Dental Tutor, a dental school study tutor.`
  );
}

server = server.replace(
  'Keep responses concise, visual, high-yield, and useful for active recall. Use short headings and clean numbered or bulleted lines.',
  'Keep responses concise, visual, high-yield, and useful for active recall. Prefer fewer stronger points over long lists. Use short headings and clean numbered or bulleted lines.'
);

server = server.replace(
  "answer: 750, summary: 1200, explanation: 900, test: 1100, flashcards: 900, notes: 1000, weakQuiz: 950, caseStudy: 1050, mnemonics: 850, conceptMap: 1000, clinicalChecklist: 900, examTraps: 950, teachBack: 850",
  "answer: 620, summary: 950, explanation: 760, test: 900, flashcards: 760, notes: 850, weakQuiz: 800, caseStudy: 880, mnemonics: 700, conceptMap: 760, clinicalChecklist: 720, examTraps: 720, teachBack: 680"
);

server = server.replace(
  "const recent = history.slice(-5).map((item) => `${item.role === 'assistant' ? 'Tutor' : 'Student'}: ${trimForModel(item.text, 550)}`).join('\\n\\n');\n  const current = trimForModel(message, 1500);",
  "const recent = history.slice(-3).map((item) => `${item.role === 'assistant' ? 'Tutor' : 'Student'}: ${trimForModel(item.text, 360)}`).join('\\n\\n');\n  const current = trimForModel(message, 1200);"
);

server = server.replace(
  "tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: ['test', 'caseStudy', 'conceptMap'].includes(mode) ? 4 : 3 }]",
  "tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: ['test', 'caseStudy'].includes(mode) ? 3 : 2 }]"
);

const artifactRoute = `app.post(apiPaths('/api/artifact'), requireAuth, requireApiKey, async (req, res) => {
  const { vectorStoreId, type = 'notes', source = '', history = [], persona = 'peer' } = req.body;
  if (!vectorStoreId) return res.status(400).json({ error: 'vectorStoreId is required.' });
  try {
    const prompt = artifactPrompts[type] ?? artifactPrompts.notes;
    const cache = getArtifactCache(req.user);
    const cacheKey = artifactCacheKey({ vectorStoreId, type, source, persona });
    if (cache[cacheKey]) return res.json({ ...cache[cacheKey], cached: true });

    const text = await createResponse({ vectorStoreId, mode: type, history: history.slice(-3), persona, input: \`${'${prompt}'}\\n\\nStudent-selected material or request:\\n${'${source || \'Use the uploaded PDF study set.\''}\`} });
    if (type === 'flashcards') {
      const cards = parseCardsFromText(text);
      const payload = { text: cards.length ? \`Created ${'${cards.length}'} flashcards.\` : 'No flashcards were created from the model output.', cards };
      cache[cacheKey] = payload;
      req.user.studyCache.updatedAt = new Date().toISOString();
      saveStore();
      return res.json(payload);
    }
    const payload = { text };
    cache[cacheKey] = payload;
    req.user.studyCache.updatedAt = new Date().toISOString();
    saveStore();
    res.json(payload);
  } catch (error) { res.status(500).json({ error: error.message }); }
});`;

server = server.replace(
  /app\.post\(apiPaths\('\/api\/artifact'\), requireAuth, requireApiKey, async \(req, res\) => \{[\s\S]*?\n\}\);\napp\.post\(apiPaths\('\/api\/transcribe'\)/,
  `${artifactRoute}\napp.post(apiPaths('/api/transcribe')`
);

fs.writeFileSync(serverPath, server);
