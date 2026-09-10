// Automated smoke test for the safety-rules red-flag detector.
// Runs instantly, no API key needed. Run this before every demo/submission
// to make sure you haven't broken the safety layer.
//
// Usage: node test-safety-rules.js

const { checkRedFlags } = require('./safety-rules');

const cases = [
  // Should trigger a red flag
  { text: 'I get serious chest pain since morning', expectFlag: true },
  { text: 'my belle dey bleed and e no dey stop', expectFlag: true },
  { text: 'my papa don faint, im no dey wake up', expectFlag: true },
  { text: 'I dey feel like I wan kill myself', expectFlag: true },
  { text: 'snake bite me for leg', expectFlag: true },
  { text: 'the baby no dey move again, I dey pregnant', expectFlag: true },

  // Should NOT trigger (should fall through to normal AI triage)
  { text: 'I get small headache since afternoon', expectFlag: false },
  { text: 'my stomach dey pain small small', expectFlag: false },
  { text: 'I get catarrh and small cough', expectFlag: false },
  { text: 'my body dey hot small, I no too well', expectFlag: false },
];

let passed = 0;
let failed = 0;

console.log('Running safety-rules smoke tests...\n');

for (const testCase of cases) {
  const result = checkRedFlags(testCase.text);
  const triggered = result !== null;
  const ok = triggered === testCase.expectFlag;

  console.log(
    `${ok ? '✅' : '❌'} "${testCase.text}" → ${
      triggered ? `FLAGGED (${result})` : 'not flagged'
    } (expected: ${testCase.expectFlag ? 'flagged' : 'not flagged'})`
  );

  if (ok) passed++;
  else failed++;
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('\n⚠️  Fix safety-rules.js before your demo — a failed test here means');
  console.log('   either a real emergency phrase is being missed, or a harmless');
  console.log('   phrase is being incorrectly escalated.');
  process.exit(1);
}
