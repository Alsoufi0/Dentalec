export const dentalosEngines = {
  knowledgeGap: {
    label: 'Knowledge Gap Detector',
    mode: 'knowledgeGap',
    outputLimit: 2000,
    prompt:
      'Detect missing prerequisites, weak concepts, common misunderstandings, frequently confused diagnoses, and next concepts to study. Use sections: Gap Snapshot, Prerequisite Map, Misconceptions, Confused-With Table, Rescue Questions, Next Study Path. Use Markdown tables for prerequisites and confused concepts.'
  },
  differentialDiagnosis: {
    label: 'Differential Diagnosis Engine',
    mode: 'differentialDiagnosis',
    outputLimit: 2200,
    prompt:
      'Build a dental differential diagnosis learning table from the source. Include similar conditions, distinguishing clinical features, radiographic differences, histological differences when relevant, tests/questions to separate them, and exam traps. Educational support only, no autonomous diagnosis.'
  },
  treatmentProtocol: {
    label: 'Treatment Protocol Engine',
    mode: 'treatmentProtocol',
    outputLimit: 2400,
    prompt:
      'Create a safe educational treatment protocol from the source. Use Markdown tables for Steps, Materials/Instruments, Rationale, Errors, Contraindications, Complications, Follow-up, and Dentist Review Notes. Do not create patient-specific treatment plans.'
  },
  examinerQuestions: {
    label: 'Examiner Engine',
    mode: 'examinerQuestions',
    outputLimit: 2400,
    prompt:
      'Create 6 board-style multiple-choice questions from the source. Format EACH question EXACTLY like this so it renders as an interactive quiz: a question line, then four options each on its own line written as "A) ...", "B) ...", "C) ...", "D) ...", then a line "Answer: X" (the correct letter), then a line "Explanation: ..." (one sentence). Separate questions with a blank line. Do not add headings, numbering, tables, or extra commentary; output only the questions in that exact format. Make them clinically relevant and cover different parts of the source.'
  },
  clinicalCase: {
    label: 'Clinical Case Simulator',
    mode: 'clinicalCase',
    outputLimit: 2400,
    prompt:
      'Create a clinical case simulator from the source. Use sections: Anamnesis, Clinical Findings, Imaging Clues, Diagnostic Clues, Differential Table, Treatment Planning Discussion, Prognosis, Examiner Prompts, Debrief. Keep it educational and clinician-reviewed.'
  },
  visualLearning: {
    label: 'Visual Learning Engine',
    mode: 'visualLearning',
    outputLimit: 2200,
    prompt:
      'Convert the topic into VISUAL structures the app renders graphically. Output ONE focused diagram inside a fenced ```mermaid code block using valid "flowchart TD" syntax. Keep it small: AT MOST 10 nodes showing the single most important process or hierarchy, NOT the whole document and NOT every subtopic. Use short node labels (2 to 4 words) and put EVERY label in double quotes, like A["Assign risk level"], so slashes, commas, and ampersands are safe. Then add one or two small Markdown tables for the key comparisons or classifications, each with a clear header row. Keep prose to a minimum; the output should be a small diagram plus tight tables, not paragraphs.'
  },
  memoryPlan: {
    label: 'Memory Engine',
    mode: 'memoryPlan',
    outputLimit: 2000,
    prompt:
      'Create a memory system from the source. Include spaced repetition schedule, flashcard clusters, mnemonics, exam pearls, high-yield summary, and a retention checklist. Use tables for review timing and card clusters.'
  },
  radiologyChecklist: {
    label: 'Radiology Learning Engine',
    mode: 'radiologyChecklist',
    outputLimit: 2000,
    prompt:
      'Create an educational radiology interpretation checklist for the topic. Support periapical, bitewing, OPG, CBCT, and clinical-photo thinking. Include normal anatomy, pathology possibilities, differential cues, evidence to capture, and red flags. Never provide autonomous diagnosis.'
  },
  professorStudio: {
    label: 'Professor Studio',
    mode: 'professorStudio',
    outputLimit: 2400,
    prompt:
      'Create professor-facing teaching material: learning objectives, OSCE station, rubric, common class misconceptions, remediation activities, and assessment analytics signals. Use Markdown tables for rubrics and class signals.'
  }
};

export function enginePromptFor(type) {
  return dentalosEngines[type]?.prompt;
}

export function engineOutputLimitFor(mode) {
  return Object.values(dentalosEngines).find((engine) => engine.mode === mode)?.outputLimit;
}
