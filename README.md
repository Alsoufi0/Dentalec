# Simav Dental Tutor

A local full-stack prototype for dental students to upload PDFs, study from the uploaded material, ask questions, generate summaries, take quizzes, and listen to answers by voice.

## Stack

- React + Vite frontend
- Express backend
- OpenAI Responses API with hosted `file_search` for PDF retrieval
- OpenAI `gpt-4.1` for grounded tutoring answers
- OpenAI `gpt-4o-mini-transcribe` for speech-to-text
- OpenAI `gpt-4o-mini-tts` for text-to-speech

## Why OpenAI Instead of Gemini

The app uses OpenAI's hosted vector stores and file search so uploaded PDFs can be automatically chunked, embedded, indexed, and searched by the model. Voice is also handled through OpenAI, keeping the prototype simpler than wiring separate Whisper and ElevenLabs services.

For advanced dental diagrams, histology scans, or chart-heavy textbooks, the next production upgrade would be to preprocess PDFs with Docling or LlamaParse, then upload the extracted Markdown/text and image references into the knowledge base.

## Setup

1. Create your environment file:

```bash
copy .env.example .env
```

2. Add your OpenAI API key to `.env`:

```bash
OPENAI_API_KEY=sk-your-key-here
PORT=8787
```

3. Install dependencies:

```bash
npm.cmd install
```

4. Run the app:

```bash
npm.cmd run dev
```

5. Open the app on this computer:

```text
http://127.0.0.1:5173
```

## Quick Start for Students

1. Create an account or sign in.
2. Upload a dental PDF in Library or from the dashboard drop zone.
3. Use Q&A when you need a direct answer from the PDF.
4. Use Summary or Explain when you want a chapter recap or a clearer concept walkthrough.
5. Use Test, Case Study, Mnemonics, and Flashcards when you want active recall.
6. Turn on Study Buddy to speak with the tutor and listen to concise answers.
7. Open Study Kit to review notes, flashcards, and exports.

## Phone and Other Devices

The dev server is configured to listen on your local network.

1. Keep the app running on the computer.
2. Make sure the phone is on the same Wi-Fi network.
3. Open `http://YOUR-COMPUTER-IP:5173` on the phone.

Text chat, PDF study, summaries, quizzes, flashcards, notes, and exports work over local Wi-Fi. Browser microphone access on phones usually requires HTTPS, so always-listening Study Buddy voice may be blocked on a phone until the app is served through HTTPS or a trusted tunnel.

After internet deployment, students can open the HTTPS URL on a phone and install it to the home screen as a PWA. On iPhone, use Share -> Add to Home Screen. On Android Chrome, use Install app or Add to Home screen.

## Internet Deployment

The app is now production-ready as a single web service: Express serves both `/api/*` and the built React app from `dist`.

Recommended simple deployment:

1. Push this project to GitHub.
2. Create a Render Web Service from the repo.
3. Use:

```bash
npm ci && npm run build
```

as the build command.

4. Use:

```bash
node server/index.js
```

as the start command.

5. Add environment variables:

```bash
OPENAI_API_KEY=your-key
HOST=0.0.0.0
NODE_ENV=production
DATA_DIR=/var/data
```

Render, Railway, Fly.io, or any Docker host can run it. The included `Dockerfile` exposes port `8787`, and `render.yaml` is configured with a small persistent disk mounted at `/var/data` for user accounts and saved study sessions.

Important production notes:

- Deploy from a private GitHub repository or carefully review files before publishing the repo.
- Never commit `.env`, `data/`, uploaded PDFs, or real user data.
- Use HTTPS so phone microphone and Study Buddy voice features can work reliably.
- Rotate the OpenAI key before deploying because the current key was pasted during development.
- Keep `DATA_DIR` on a persistent disk. If it points to temporary storage, accounts and saved study progress can disappear after a server restart.
- For a larger public app, replace the local JSON store with Postgres, MongoDB Atlas, or another managed database.

## Accounts

The hosted app supports basic email/password accounts.

- Passwords are salted and hashed with PBKDF2 before being stored.
- Login sessions use HttpOnly cookies.
- Each user has a private saved study state with their active PDF set, chat, notes, flashcards, selected page, and voice persona.
- Uploaded PDFs are still sent to OpenAI for indexing in hosted vector stores.
- The local data file is stored at `DATA_DIR/app-data.json`.
- The app includes a PWA manifest and service worker so friends can install it from the browser after it is deployed.

## Study Modes

- Summary: high-yield PDF summary for dental exams
- Explain: concept explanation with clinical relevance
- Test: creative oral-exam coaching with recall, vignettes, compare/contrast, anatomy landmarks, error-spotting, and harder challenge questions
- Q&A: direct grounded answers from uploaded PDFs

## Conversation Mode

Study buddy mode is enabled from the left panel after a PDF is indexed. In Chrome or Edge, it uses the browser's built-in speech recognition and speech synthesis for faster, more natural back-and-forth.

- The app stays in an always-listening state while the mode is activated.
- A spoken student question is sent directly to the tutor.
- The tutor answers from the uploaded PDF and automatically speaks the reply.
- Pressing **Listen** again on the same answer stops playback instead of restarting it.
- Long answers are shortened for spoken playback so the voice starts and finishes faster while the full answer remains visible on screen.
- Saying phrases like "thank you," "stop," or "that's enough" pauses the speaking flow without asking the model another question.
- If browser speech recognition is unavailable, use the microphone button for one-shot recording.

## Student Features

- Private accounts with saved study sessions across devices
- Persistent dark/light mode toggle
- Study progress counters for questions, answers, and flashcards
- Dashboard drag-and-drop upload for starting a study set immediately
- Animated Study Buddy voice status so students can see when it is listening
- Voice personas: Supportive Peer, Stern Professor, and Clinical Mentor
- Hands-free commands such as "Hey Tutor, summarize", "Hey Tutor, start a case study", and "Hey Tutor, make mnemonics"
- Topic heatmap-style dashboard signals based on current study activity
- AI-generated study notes
- AI-generated flashcards from the whole PDF or a specific tutor answer
- Weak-spot quiz generation
- Board-style case study generation
- Mnemonics generation for difficult dental facts
- Markdown export for notes and conversation history
- Anki-compatible TSV export for flashcards

## Notes

- Uploaded PDFs are sent to OpenAI's Files and Vector Stores APIs.
- The browser microphone requires HTTPS in production. On localhost, modern browsers allow it for development.
- The tutor is for studying and should not be used as clinical decision support.
