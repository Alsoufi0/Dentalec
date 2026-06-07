# Simav Dental Intelligence Strategy

## North Star

Build a dentistry knowledge operating system: student mastery, professor assessment, and clinic observation tools that turn existing dental knowledge into repeatable, auditable workflows.

## Product Wedge

Start with dental students because they have urgent pain: lectures, PDFs, exams, OSCEs, memory load, and weak feedback loops. Win by converting course material into mastery tracking, spaced repetition, OSCE practice, and adaptive remediation.

## Expansion Path

1. Student Tutor: PDF/text ingestion, grounded Q&A, summaries, flashcards, voice study, mastery, spaced review.
2. Professor Studio: OSCE station builder, marking rubrics, class weak-spot dashboards, curriculum maps, feedback generation.
3. Clinic Intelligence: educational observation checklists, evidence capture, red-flag prompts, case-review workflows, and eventually image-assisted issue triage with strict clinical safety boundaries.

## Differentiated Ideas

- Mastery graph for dentistry domains: anatomy, caries, perio, endo, radiology, pharmacology, materials, procedures.
- OSCE simulator that creates patient scripts, examiner prompts, scoring rubrics, and remediation plans.
- Clinical observation layer that translates textbook knowledge into "what to look for", "what evidence to capture", and "what feedback to give".
- Professor analytics that aggregate anonymous weak concepts across a class.
- Clinic mode that supports documentation, training, and second-look workflows before moving into regulated clinical decision support.
- Specialized DentalOS engines: knowledge gaps, differential diagnosis, treatment protocols, examiner questions, clinical cases, visual learning, radiology learning, and memory.
- Visual rendering as a product principle: tables, score charts, decision pathways, flow maps, and structured rubrics should replace long unstructured text whenever structure improves learning.

## Safety Boundaries

- Student mode is educational and must cite uploaded material where possible.
- Clinic/professor mode should say "may indicate", "observe", "ask", and "capture evidence", not diagnose.
- Any future image or clinical issue identification must include human review, audit logs, disclaimers, and regulatory planning.

## Current Implementation Step

The app now includes the foundation for:

- Postgres-backed users and sessions when `DATABASE_URL` is configured.
- JSON fallback for local development.
- Daily AI usage budgets.
- Upload and request rate limits.
- Text-source indexing in addition to PDFs.
- Mastery tracking, confidence signals, spaced review, curriculum tracks, OSCE generation, adaptive remediation, and clinic/professor concept surfaces.
- A DentalOS Engines page that exposes specialized learning, reasoning, professor, radiology, memory, case, differential, and protocol engines.
- Real table rendering and score charts for rubric-style output.
- Project custom skill definitions under `dentalos-skills/`.
