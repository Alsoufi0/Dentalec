import fs from 'node:fs';

const serverPath = 'server/index.js';
let server = fs.readFileSync(serverPath, 'utf8');

server = server.replace(
  'Keep responses concise, visual, high-yield, and useful for active recall. Prefer fewer stronger points over long lists. Use short headings and clean numbered or bulleted lines.',
  'Keep responses organized, visual, high-yield, and useful for active recall. Do not be vague. Include all essential dental details needed for an exam: definition, mechanism, clinical use, indications, examples, important percentages/concentrations/frequency/how-to-use when the source provides them, and what to memorize. Use easy language first, then precise dental terms. If the source does not specify a crucial detail, say: Source does not specify that detail.'
);
server = server.replace(
  'Keep responses concise, visual, high-yield, and useful for active recall. Use short headings and clean numbered or bulleted lines.',
  'Keep responses organized, visual, high-yield, and useful for active recall. Do not be vague. Include all essential dental details needed for an exam: definition, mechanism, clinical use, indications, examples, important percentages/concentrations/frequency/how-to-use when the source provides them, and what to memorize. Use easy language first, then precise dental terms. If the source does not specify a crucial detail, say: Source does not specify that detail.'
);

server = server.replace(
  "answer: 620, summary: 950, explanation: 760, test: 900, flashcards: 760, notes: 850, weakQuiz: 800, caseStudy: 880, mnemonics: 700, conceptMap: 760, clinicalChecklist: 720, examTraps: 720, teachBack: 680",
  "answer: 1050, summary: 1500, explanation: 1250, test: 1250, flashcards: 850, notes: 1300, weakQuiz: 1050, caseStudy: 1150, mnemonics: 850, conceptMap: 1050, clinicalChecklist: 1150, examTraps: 1050, teachBack: 850"
);
server = server.replace(
  "answer: 750, summary: 1200, explanation: 900, test: 1100, flashcards: 900, notes: 1000, weakQuiz: 950, caseStudy: 1050, mnemonics: 850, conceptMap: 1000, clinicalChecklist: 900, examTraps: 950, teachBack: 850",
  "answer: 1050, summary: 1500, explanation: 1250, test: 1250, flashcards: 850, notes: 1300, weakQuiz: 1050, caseStudy: 1150, mnemonics: 850, conceptMap: 1050, clinicalChecklist: 1150, examTraps: 1050, teachBack: 850"
);

server = server.replace(
  "answer: 'Answer from the uploaded PDF. Keep it under 7 concise bullets unless the student asks for more. Include source references when available.',",
  "answer: 'Answer from the uploaded study source. Be complete enough for a dental student to pass. Include exact crucial details when present: types, examples, concentrations/percentages, frequency, how to use, mechanism, indications, contraindications, and exam traps. Use easy language first, then dental terms. Do not invent missing numbers; state when the source does not specify them.',"
);
server = server.replace(
  "explanation: 'Explain with plain-language idea, dental-school mechanism, clinical relevance, visual analogy, and one memory hook. Keep it concise.',",
  "explanation: 'Explain with plain-language idea, dental-school mechanism, clinical relevance, practical examples, must-know details, and one memory hook. If discussing prevention or treatment, include what, why, when, how often/how to use, and mechanism when available in the source.',"
);

server = server.replace(
  "tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: ['test', 'caseStudy'].includes(mode) ? 3 : 2 }]",
  "tools: vectorStoreId ? [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: ['test', 'caseStudy'].includes(mode) ? 4 : 3 }] : []"
);
server = server.replace(
  "tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: ['test', 'caseStudy', 'conceptMap'].includes(mode) ? 4 : 3 }]",
  "tools: vectorStoreId ? [{ type: 'file_search', vector_store_ids: [vectorStoreId], max_num_results: ['test', 'caseStudy'].includes(mode) ? 4 : 3 }] : []"
);

server = server.replace(
  "if (!vectorStoreId || !message) return res.status(400).json({ error: 'vectorStoreId and message are required.' });",
  "if (!message) return res.status(400).json({ error: 'message is required.' });"
);

if (!server.includes("/api/text-source")) {
  const route = `app.post(apiPaths('/api/text-source'), requireAuth, requireApiKey, async (req, res) => {
  const title = String(req.body.title || 'Pasted study notes').trim().slice(0, 90) || 'Pasted study notes';
  const text = String(req.body.text || '').trim();
  if (text.length < 80) return res.status(400).json({ error: 'Paste at least a short paragraph of study text.' });
  if (text.length > 180000) return res.status(400).json({ error: 'Text is too long. Paste a smaller chapter section.' });
  try {
    const vectorStore = await openaiClient.vectorStores.create({ name: 'Simav pasted text ' + new Date().toISOString() });
    const safeName = title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'pasted-notes';
    const openaiFile = await openaiClient.files.create({
      file: await toFile(Buffer.from(text, 'utf8'), safeName + '.txt', { type: 'text/plain' }),
      purpose: 'assistants'
    });
    await openaiClient.vectorStores.files.createAndPoll(vectorStore.id, { file_id: openaiFile.id });
    const studySet = { vectorStoreId: vectorStore.id, files: [{ originalName: title + ' (pasted text)', fileId: openaiFile.id, sourceType: 'text' }] };
    req.user.studyState = {
      studySet,
      chat: [{ role: 'assistant', text: 'Your pasted study text is indexed. Ask a question, request a complete explanation, make flashcards, or start an oral test.', mode: 'answer', id: crypto.randomUUID() }],
      flashcards: [],
      notes: '',
      page: 'dashboard',
      voicePersona: 'peer',
      updatedAt: new Date().toISOString()
    };
    req.user.studyCache = { artifacts: {} };
    saveStore();
    res.json(studySet);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
`;
  server = server.replace("app.post(apiPaths('/api/study'),", route + "app.post(apiPaths('/api/study'),");
}

fs.writeFileSync(serverPath, server);
