// Quick CLI test harness — lets you test Dr. Bee's logic without connecting
// to WhatsApp at all. Great for fast iteration during the hackathon.
//
// Usage:
//   node test-console.js
//   Then type symptom messages and see how Dr. Bee responds.
//   Type "restart" to reset the conversation, "exit" to quit.

require('dotenv').config();
const readline = require('readline');
const { checkRedFlags } = require('./safety-rules');
const { askDrBee } = require('./ai');

const history = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'You: ',
});

console.log('🩺 Dr. Bee test console — type a symptom message to begin.');
console.log('   (type "restart" to reset, "exit" to quit)\n');
rl.prompt();

rl.on('line', async (line) => {
  const text = line.trim();

  if (/^exit$/i.test(text)) {
    rl.close();
    return;
  }

  if (/^restart$/i.test(text)) {
    history.length = 0;
    console.log('\n🔄 Conversation reset.\n');
    rl.prompt();
    return;
  }

  if (!text) {
    rl.prompt();
    return;
  }

  history.push({ role: 'user', content: text });

  const redFlag = checkRedFlags(text);
  if (redFlag) {
    console.log(`\n🔴 [SAFETY LAYER TRIGGERED — matched: "${redFlag}"]`);
    console.log(
      `Dr. Bee: ⚠️ Please listen carefully. Wetin you describe (${redFlag}) fit be emergency. ` +
      `I want make you go hospital now now, no wait.\n`
    );
    rl.prompt();
    return;
  }

  const result = await askDrBee(history, history.length);
  history.push({ role: 'assistant', content: result.reply });

  console.log(`\nDr. Bee: ${result.reply}`);
  if (result.tier) console.log(`[tier detected: ${result.tier}]`);
  console.log('');

  rl.prompt();
});

rl.on('close', () => {
  console.log('\nBye! 👋');
  process.exit(0);
});
