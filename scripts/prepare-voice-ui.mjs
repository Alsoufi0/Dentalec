import fs from 'node:fs';

const mainPath = 'src/main.jsx';
const stylesPath = 'src/styles.css';
let main = fs.readFileSync(mainPath, 'utf8');

const textStyle = "Answer style: text explanation. Write in clear short paragraphs, not a long wall of text and not bullets. Use simple language first, then the exact dental terms. Cover all crucial details from the source when present: definition, mechanism, clinical importance, classifications/types, examples, concentrations/percentages, frequency/how to use, what it does to the tooth/tissue/bacteria, indications, cautions, patient instructions, exam traps, and what to memorize. If a crucial number or detail is not in the source, say the source does not specify it instead of guessing.";
const bulletStyle = "Answer style: organized bullet points. Keep bullets compact but complete. Cover all crucial details from the source when present: definition, mechanism, clinical importance, classifications/types, examples, concentrations/percentages, frequency/how to use, what it does to the tooth/tissue/bacteria, indications, cautions, patient instructions, exam traps, and what to memorize. If a crucial number or detail is not in the source, say the source does not specify it instead of guessing.";

if (!main.includes('answerStyle')) {
  main = main.replace(
    "const [persona, setPersona] = useState('peer');",
    "const [persona, setPersona] = useState('peer');\n  const [answerStyle, setAnswerStyle] = useState('text');"
  );

  main = main.replace(
    "const q = text.trim(); if (!q || !hasStudy) return;",
    `const q = text.trim(); if (!q || !hasStudy) return;\n    const styleInstruction = answerStyle === 'text' ? '${textStyle}' : '${bulletStyle}';`
  );

  main = main.replace(
    'message: q, mode: nextMode, persona,',
    "message: styleInstruction + '\\n\\nStudent request: ' + q, mode: nextMode, persona,"
  );

  main = main.replace(
    '</select><nav>',
    '</select><select className="answer-style-select" value={answerStyle} onChange={(e) => setAnswerStyle(e.target.value)}><option value="text">Text explanation</option><option value="bullets">Bullet points</option></select><nav>'
  );
} else {
  main = main.replace("const [answerStyle, setAnswerStyle] = useState('bullets');", "const [answerStyle, setAnswerStyle] = useState('text');");
  main = main.replace(
    /const styleInstruction = answerStyle === 'text' \? '.*?' : '.*?';/,
    `const styleInstruction = answerStyle === 'text' ? '${textStyle}' : '${bulletStyle}';`
  );
  main = main.replace(
    '<option value="bullets">Bullet points</option><option value="text">Text explanation</option>',
    '<option value="text">Text explanation</option><option value="bullets">Bullet points</option>'
  );
}

main = main.replace(
  'const stream = await navigator.mediaDevices.getUserMedia({ audio: true });\n      const rec = new MediaRecorder(stream); recorder.current = rec; chunks.current = [];',
  "const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });\n      const mimeChoices = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];\n      const chosenMime = mimeChoices.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';\n      const rec = new MediaRecorder(stream, chosenMime ? { mimeType: chosenMime } : undefined); recorder.current = rec; chunks.current = [];\n      const recordingMime = rec.mimeType || chosenMime || 'audio/webm';"
);

main = main.replace(
  "const body = new FormData(); body.append('audio', new Blob(chunks.current, { type: 'audio/webm' }), 'question.webm');",
  "const body = new FormData();\n        const audioType = recordingMime || chunks.current[0]?.type || 'audio/webm';\n        const ext = audioType.includes('mp4') ? 'm4a' : audioType.includes('aac') ? 'aac' : 'webm';\n        const blob = new Blob(chunks.current, { type: audioType });\n        if (blob.size < 900) { setError('No clear audio was captured. Allow microphone access and record for at least one second.'); setBusy(''); return; }\n        body.append('audio', blob, 'question.' + ext);"
);

main = main.replace('rec.start(); setRecording(true);', 'rec.start(250); setRecording(true);');
main = main.replace("} catch { setError('Microphone permission is required for voice study.'); }", "} catch (recordError) { setError(recordError?.message || 'Microphone permission is required for voice study.'); }");

main = main.replace(
  "const text = clean(item.text).slice(0, 900);",
  "const text = clean(item.text).replace(/\\s+/g, ' ').trim().slice(0, 780);"
);
main = main.replace(
  "const a = new Audio(d.audioUrl); audio.current = a;\n      a.onended = () => { if (speechRun.current === run) stopAudio(); };\n      await a.play();",
  "const a = new Audio(d.audioUrl); audio.current = a;\n      a.onerror = () => { if (speechRun.current === run) setError('Audio playback failed. Try a shorter answer or refresh the page.'); stopAudio(); };\n      a.onended = () => { if (speechRun.current === run) stopAudio(); };\n      await a.play();"
);
main = main.replace(
  "} catch (err) { if (err.name !== 'AbortError') setError(err.message); stopAudio(); }",
  "} catch (err) { if (err.name !== 'AbortError') setError(err.message?.includes('play') ? 'Audio was created, but the browser blocked playback. Tap Listen again after the page is active.' : err.message); stopAudio(); }"
);

fs.writeFileSync(mainPath, main);

let styles = fs.readFileSync(stylesPath, 'utf8');
if (!styles.includes('answer-style-select')) {
  styles += `
.answer-style-select {
  min-height: 42px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  background: var(--surface-2);
  font-weight: 780;
}
`;
}
fs.writeFileSync(stylesPath, styles);
