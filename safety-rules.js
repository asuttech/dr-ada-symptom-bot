// Hardcoded red-flag detector.
// This list runs on EVERY incoming message, independent of the AI,
// so a language model hallucination or misjudgment can never suppress
// an urgent-care recommendation for a genuinely dangerous symptom.
//
// IMPORTANT FOR YOUR DEMO / PITCH:
// This is the piece to highlight to judges as your "responsible AI" story —
// the LLM never has the final say on emergencies, this static layer does.
//
// Expand this list with a clinician's input if you can before submission —
// treat this starter set as a skeleton, not a complete medical list.

const RED_FLAGS = [
  // English
  { pattern: /chest pain|can'?t breathe|difficulty breathing|shortness of breath/i, label: 'chest pain / breathing difficulty' },
  { pattern: /heavy bleeding|won'?t stop bleeding|blood everywhere/i, label: 'uncontrolled bleeding' },
  { pattern: /unconscious|passed out|not waking up/i, label: 'loss of consciousness' },
  { pattern: /seizure|convulsion|fitting/i, label: 'seizure' },
  { pattern: /stroke|face drooping|slurred speech|one side weak/i, label: 'stroke symptoms' },
  { pattern: /suicide|kill myself|end my life/i, label: 'self-harm risk' },
  { pattern: /snake bite|snakebite/i, label: 'snake bite' },
  { pattern: /severe burn|third degree burn/i, label: 'severe burn' },
  { pattern: /baby not moving|baby no dey move|no fetal movement|reduced movement.*pregnan/i, label: 'reduced fetal movement' },
  { pattern: /pregnant.*bleeding|bleeding.*pregnan/i, label: 'bleeding in pregnancy' },
  { pattern: /overdose|too many tablets|too many pills/i, label: 'possible overdose' },

  // Common Pidgin/local phrasing — expand with native speakers on your team
  { pattern: /I no fit breathe|belle dey bleed|blood no dey stop/i, label: 'breathing/bleeding emergency (pidgin)' },
  { pattern: /im don faint|e don faint|don faint|no dey wake up|not waking up/i, label: 'fainting/unconsciousness (pidgin)' },
];

function checkRedFlags(text) {
  for (const flag of RED_FLAGS) {
    if (flag.pattern.test(text)) {
      return flag.label;
    }
  }
  return null;
}

module.exports = { checkRedFlags, RED_FLAGS };
