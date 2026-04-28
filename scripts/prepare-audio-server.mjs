import fs from 'node:fs';

const serverPath = 'server/index.js';
let server = fs.readFileSync(serverPath, 'utf8');

server = server.replace(
  "if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });",
  "if (!req.file || req.file.size < 900) return res.status(400).json({ error: 'No usable audio was captured. On Mac/Safari, allow microphone access and record for at least one second.' });"
);

server = server.replace(
  "const transcription = await openaiClient.audio.transcriptions.create({ file: await toFile(fs.createReadStream(req.file.path), req.file.originalname || 'student-question.webm', { type: req.file.mimetype || 'audio/webm' }), model: 'gpt-4o-mini-transcribe', prompt: 'Dental education audio with terms like enamel, dentin, pulp, mandibular, maxillary, V3, inferior alveolar nerve, odontoblast, cementum, and foramen.' });",
  "const audioName = req.file.originalname || (req.file.mimetype?.includes('mp4') ? 'student-question.m4a' : 'student-question.webm');\n    const transcription = await openaiClient.audio.transcriptions.create({ file: await toFile(fs.createReadStream(req.file.path), audioName, { type: req.file.mimetype || 'application/octet-stream' }), model: 'gpt-4o-mini-transcribe', prompt: 'Dental education audio with terms like enamel, dentin, pulp, mandibular, maxillary, V3, inferior alveolar nerve, odontoblast, cementum, and foramen.' });"
);

server = server.replace(
  "const speech = await openaiClient.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: session.voice, input: session.text, instructions: session.persona === 'professor' ? 'Formal, crisp dental professor.' : session.persona === 'clinic' ? 'Calm clinical dental mentor.' : 'Supportive dental school study peer.' });",
  "const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'cedar', 'marin'];\n    const voiceName = allowedVoices.includes(session.voice) ? session.voice : 'cedar';\n    const speech = await openaiClient.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: voiceName, input: session.text, response_format: 'mp3', instructions: session.persona === 'professor' ? 'Formal, crisp dental professor.' : session.persona === 'clinic' ? 'Calm clinical dental mentor.' : 'Supportive dental school study peer.' });"
);

fs.writeFileSync(serverPath, server);
