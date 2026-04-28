import fs from 'node:fs';

const mainPath = 'src/main.jsx';
const stylesPath = 'src/styles.css';
let main = fs.readFileSync(mainPath, 'utf8');

if (!main.includes('answerStyle')) {
  main = main.replace(
    "const [persona, setPersona] = useState('peer');",
    "const [persona, setPersona] = useState('peer');\n  const [answerStyle, setAnswerStyle] = useState('bullets');"
  );

  main = main.replace(
    "const q = text.trim(); if (!q || !hasStudy) return;",
    "const q = text.trim(); if (!q || !hasStudy) return;\n    const styleInstruction = answerStyle === 'text' ? 'Answer style: concise paragraph text. Explain like a patient tutor for a dental student, use simple language, include must-know details, and end with a one-sentence recap.' : 'Answer style: bullet points. Explain simply, include must-know details, highlight exam-important facts, and end with a quick recap.';"
  );

  main = main.replace(
    'message: q, mode: nextMode, persona,',
    "message: styleInstruction + '\\n\\nStudent request: ' + q, mode: nextMode, persona,"
  );

  main = main.replace(
    '</select><nav>',
    '</select><select className="answer-style-select" value={answerStyle} onChange={(e) => setAnswerStyle(e.target.value)}><option value="bullets">Bullet points</option><option value="text">Text explanation</option></select><nav>'
  );
}

main = main.replace(
  'const stream = await navigator.mediaDevices.getUserMedia({ audio: true });\n      const rec = new MediaRecorder(stream); recorder.current = rec; chunks.current = [];',
  "const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });\n      const mimeChoices = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];\n      const chosenMime = mimeChoices.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';\n      const rec = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime } : undefined); recorder.current = rec; chunks.current = [];\n      const recordingMime = rec.mimeType || chosenMime || 'audio/webm';"
);

main = main.replace(
  "const body = new FormData(); body.append('audio', new Blob(chunks.current, { type: 'audio/webm' }), 'question.webm');",
  "const body = new FormData();\n        const audioType = recordingMime || chunks.current[0]?.type || 'audio/webm';\n        const ext = audioType.includes('mp4') ? 'm4a' : audioType.includes('aac') ? 'aac' : 'webm';\n        const blob = new Blob(chunks.current, { type: audioType });\n        if (blob.size < 900) { setError('No clear audio was captured. Allow microphone access and record for at least one second.'); setBusy(''); return; }\n        body.append('audio', blob, 'question.' + ext);"
);

main = main.replace('rec.start(); setRecording(true);', 'rec.start(250); setRecording(true);');
main = main.replace("} catch { setError('Microphone permission is required for voice study.'); }", "} catch (recordError) { setError(recordError?.message || 'Microphone permission is required for voice study.'); }");

main = main.replace(
  'await a.play();\n    } catch (err) { if (err.name !== \'AbortError\') setError(err.message); stopAudio(); }',
  "await a.play();\n    } catch (err) { if (err.name !== 'AbortError') setError(err.message?.includes('play') ? 'Audio was created, but your browser blocked playback. Tap Listen again after the page is active.' : err.message); stopAudio(); }"
);

fs.writeFileSync(mainPath, main);

let styles = fs.readFileSync(stylesPath, 'utf8');
if (!styles.includes('answer-style-select')) {
  styles += `\n.answer-style-select {\n  min-height: 42px;\n  border: 1px solid var(--border);\n  border-radius: 10px;\n  color: var(--text);\n  background: var(--surface-2);\n  font-weight: 780;\n}\n`;
}
fs.writeFileSync(stylesPath, styles);
