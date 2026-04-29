import fs from 'node:fs';

const serverPath = 'server/index.js';
let server = fs.readFileSync(serverPath, 'utf8');

server = server.replace(
  "if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });",
  "if (!req.file || req.file.size < 900) return res.status(400).json({ error: 'No usable audio was captured. On Mac/Safari, allow microphone access, keep the page active, and record for at least one second.' });"
);

server = server.replace(
  "const transcription = await openaiClient.audio.transcriptions.create({ file: await toFile(fs.createReadStream(req.file.path), req.file.originalname || 'student-question.webm', { type: req.file.mimetype || 'audio/webm' }), model: 'gpt-4o-mini-transcribe', prompt: 'Dental education audio with terms like enamel, dentin, pulp, mandibular, maxillary, V3, inferior alveolar nerve, odontoblast, cementum, and foramen.' });",
  "const audioName = req.file.originalname || (req.file.mimetype?.includes('mp4') ? 'student-question.m4a' : 'student-question.webm');\n    const transcription = await openaiClient.audio.transcriptions.create({ file: await toFile(fs.createReadStream(req.file.path), audioName, { type: req.file.mimetype || 'application/octet-stream' }), model: 'gpt-4o-mini-transcribe', prompt: 'Dental education audio with terms like enamel, dentin, pulp, mandibular, maxillary, V3, inferior alveolar nerve, odontoblast, cementum, and foramen.' });"
);

const speakRoutePattern = /app\.post\(apiPaths\('\/api\/speak'\), requireAuth, requireApiKey, \(req, res\) => \{[\s\S]*?\n\}\);\napp\.get\(apiPaths\('\/api\/speak\/:id'\)/;
const stableSpeakRoute = `app.post(apiPaths('/api/speak'), requireAuth, requireApiKey, async (req, res) => {
  const { text, voice = 'alloy', persona = 'peer' } = req.body;
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 850);
  if (!cleanText) return res.status(400).json({ error: 'Text is required.' });
  const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
  const voiceName = allowedVoices.includes(voice) ? voice : 'alloy';
  try {
    const speech = await openaiClient.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: voiceName,
      input: cleanText,
      response_format: 'mp3',
      instructions: persona === 'professor' ? 'Formal but natural dental professor. Speak clearly, with short pauses between key ideas.' : persona === 'clinic' ? 'Calm clinical dental mentor. Speak naturally and explain chairside relevance.' : 'Supportive dental school study peer. Sound natural, warm, and clear, not robotic.'
    });
    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.json({ audioUrl: 'data:audio/mpeg;base64,' + audioBuffer.toString('base64') });
  } catch (error) {
    res.status(500).json({ error: 'Speech generation failed. Check the OpenAI key billing and model access, then try a shorter answer. Details: ' + error.message });
  }
});
app.get(apiPaths('/api/speak/:id')`;
server = server.replace(speakRoutePattern, stableSpeakRoute);

server = server.replace(
  "const { text, voice = 'cedar', persona = 'peer' } = req.body;",
  "const { text, voice = 'alloy', persona = 'peer' } = req.body;"
);
server = server.replace(
  "speechSessions.set(id, { text: String(text).slice(0, 1200), voice, persona, userId: req.user.id, createdAt: Date.now() });",
  "speechSessions.set(id, { text: String(text).replace(/\\s+/g, ' ').trim().slice(0, 850), voice, persona, userId: req.user.id, createdAt: Date.now() });"
);
server = server.replace(
  "const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'cedar', 'marin'];\n    const voiceName = allowedVoices.includes(session.voice) ? session.voice : 'cedar';",
  "const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];\n    const voiceName = allowedVoices.includes(session.voice) ? session.voice : 'alloy';"
);
server = server.replace(
  "const speech = await openaiClient.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: session.voice, input: session.text, instructions: session.persona === 'professor' ? 'Formal, crisp dental professor.' : session.persona === 'clinic' ? 'Calm clinical dental mentor.' : 'Supportive dental school study peer.' });",
  "const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];\n    const voiceName = allowedVoices.includes(session.voice) ? session.voice : 'alloy';\n    const speech = await openaiClient.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: voiceName, input: session.text, response_format: 'mp3', instructions: session.persona === 'professor' ? 'Formal but natural dental professor. Speak clearly, with short pauses between key ideas.' : session.persona === 'clinic' ? 'Calm clinical dental mentor. Speak naturally and explain chairside relevance.' : 'Supportive dental school study peer. Sound natural, warm, and clear, not robotic.' });"
);

fs.writeFileSync(serverPath, server);
