# DentalOS AI Architecture

DentalOS is a dentistry knowledge operating system. The student tutor is the first surface; the architecture must later support professor assessment and clinician-reviewed clinic assistance without crossing into autonomous diagnosis or treatment planning.

## Product Surfaces

| Surface | Primary User | Core Jobs | Safety Boundary |
|---|---|---|---|
| Student Workspace | Dental students | Understand, retain, practice, pass exams, build clinical reasoning | Educational support only |
| Professor Studio | Professors/instructors | OSCEs, rubrics, weak-concept analytics, remediation plans | Course and assessment support |
| Clinic Lab | Dentists/clinics | Patient education drafts, note drafts, checklist workflows, appointment summaries | Dentist review required |
| Radiology Learning | Students/professors | Interpretation checklists, normal anatomy, differential cues | No autonomous diagnosis |

## Dental Knowledge Engine

| Layer | Purpose | Production Direction |
|---|---|---|
| Source Ingestion | PDFs, text, DOCX, PPTX, images, radiographs, CBCT screenshots | Add typed asset records and ingestion jobs |
| Retrieval | Source-grounded answers with citations | Move to Postgres + pgvector and source chunks |
| Concept Graph | Prerequisites, related concepts, misconceptions, confused diagnoses | Add `concepts`, `concept_edges`, `source_concepts` |
| Contradiction Detection | Find conflicting notes/guidelines | Add cross-source comparison jobs |
| Learning Signals | Weak areas, confidence, reviews, OSCE performance | Store mastery and attempts as first-class data |

## Specialized Engines

| Engine | Output | Current Implementation |
|---|---|---|
| Knowledge Gap Detector | Missing prerequisites, misconceptions, confused concepts | DentalOS Engines page + API prompt |
| Differential Diagnosis | Distinguishing features, radiographic/histologic differences | Engine prompt + table renderer |
| Treatment Protocol | Steps, materials, errors, contraindications, complications, follow-up | Educational-only engine |
| Examiner Engine | MCQs, oral exams, board-style prompts, rubrics | Engine prompt + score graphs |
| Clinical Case Simulator | Anamnesis, findings, imaging clues, differentials, prognosis | Engine prompt |
| Visual Learning Engine | Flowcharts, decision trees, pathways, comparison tables | Engine prompt + structured rendering |
| Memory Engine | Spaced repetition, card clusters, mnemonics, pearls | Engine prompt + review UI |
| Radiology Learning Engine | Interpretation checklist, anatomy, pathology cues | Educational-only engine |
| Professor Studio | Objectives, OSCEs, rubrics, class remediation | Engine prompt + Clinic Lab entry |

## Full Database Direction

| Table | Purpose |
|---|---|
| `users` | Account identity |
| `auth_sessions` | Persistent sessions |
| `sources` | Uploaded PDFs, pasted text, slides, documents, images |
| `source_chunks` | Searchable chunks with citations and vector embeddings |
| `concepts` | Canonical dental topics |
| `concept_edges` | Prerequisite, related, confused-with, contraindicates, protocol-step links |
| `study_sets` | User/group source collections |
| `study_events` | Questions, answers, engine runs, voice events |
| `mastery_signals` | Topic readiness, confidence, weak spots |
| `flashcards` | Memory system cards |
| `review_events` | Spaced repetition attempts |
| `osce_stations` | Professor/student stations |
| `rubric_rows` | Scoring criteria and marks |
| `clinical_drafts` | Dentist-reviewed future clinic outputs |
| `audit_events` | Safety and review trail |

## UI Wireframe Map

| Area | Experience |
|---|---|
| Dashboard | Readiness, due review, weak areas, current source, next best action |
| Library | PDF/text now; DOCX/PPTX/image/radiology ingestion later |
| Q&A | Source-grounded answer + gaps + mistakes + pearls |
| Mastery | Topic graph, confidence, spaced review, curriculum tracks |
| Engines | Specialized DentalOS engine cards |
| Clinic Lab | Professor/clinic-safe future workflows |
| Study Kit | Notes, tables, charts, flashcards, exports |

## Testing Strategy

| Layer | Tests |
|---|---|
| Renderer | Markdown tables, score charts, headings, bullets, long lines, dark mode |
| API | Auth, session, quota, upload limits, text-source, engine prompts |
| Learning | Review scheduling, confidence, mastery calculations |
| Safety | No autonomous diagnosis/treatment language in clinic/radiology engines |
| Browser | Signup, source indexing, Q&A, engine run, table/chart display |

## Production Phases

1. Stabilize current Vite/Express product and deploy from source of truth.
2. Move production data to Postgres and persistent sessions.
3. Add first-class sources/chunks/concepts schema.
4. Add pgvector retrieval and source citations.
5. Add DentalOS engine run records and UI history.
6. Add DOCX/PPTX ingestion.
7. Add radiology/image learning upload with strict educational boundaries.
8. Add professor class dashboards and OSCE exports.
9. Add dentist-reviewed clinic draft workflows.
10. Evaluate regulatory path before any clinical decision-support expansion.
