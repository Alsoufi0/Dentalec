---
name: dental-rag-skill
description: Use when building or reviewing DentalOS source-grounded retrieval, citations, concept linking, source tracking, contradiction detection, or pgvector-backed dental knowledge workflows.
---

# Dental RAG Skill

Use source-grounded answers. Preserve citations, source title, page/slide when available, chunk id, and confidence.

Workflow:
1. Identify source type: PDF, text, DOCX, PPTX, image, radiograph, CBCT screenshot, protocol, guideline.
2. Retrieve relevant chunks before answering.
3. Answer, then add knowledge gaps, related concepts, common mistakes, and examination pearls.
4. Use tables for diagnostic criteria, comparisons, protocols, rubrics, and pathways.
5. Never remove critical criteria, classifications, differentials, complications, prognosis, or protocol steps for simplicity.

Safety:
- Educational support only unless future clinic mode has explicit dentist review.
- Say when source material is missing or insufficient.
