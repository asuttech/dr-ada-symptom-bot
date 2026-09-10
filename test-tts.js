// Quick CLI test harness for the voice-note feature — lets you hear what
// Dr. Bee's TTS voice sounds like without connecting to WhatsApp at all.
//
// Usage:
//   node test-tts.js
//   Then type any text and it's saved as an .ogg file you can play locally.
//   Type "exit" to quit.
//
// This is a good place to sanity-check things like: does GEMINI_TTS_VOICE
// sound natural, does Pidgin/local-language text get read out clearly, is
// ffmpeg-static working on this machine, etc.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { textToVoiceNote } = require('./tts');

const OUTPUT_DIR = path.join(__dirname, 'tts-previews');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'Text: ',
});

console.log('🔊 Dr. Bee TTS test console — type text to hear it as a voice note.');
console.log(`   Voice: ${process.env.GEMINI_TTS_VOICE || 'Kore'} | Model: ${process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'}`);
console.log(`   Output files are saved to ${OUTPUT_DIR}/`);
console.log('   (type "exit" to quit)\n');
rl.prompt();

rl.on('line', async (line) => {
  const text = line.trim();

  if (/^exit$/i.test(text)) {
    rl.close();
    return;
  }

  if (!text) {
    rl.prompt();
    return;
  }

  console.log('Generating voice note...');
  const start = Date.now();
  const oggBuffer = await textToVoiceNote(text);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!oggBuffer) {
    console.log('❌ Failed to generate voice note — check the error logged above ' +
      '(common causes: missing/invalid GEMINI_API_KEY, or ffmpeg not available).\n');
    rl.prompt();
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filename = `preview-${Date.now()}.ogg`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, oggBuffer);

  console.log(`✅ Saved (${elapsed}s, ${(oggBuffer.length / 1024).toFixed(1)} KB): ${filepath}`);
  console.log('   Play it with e.g. `afplay` (Mac), `vlc`, or drag it into any media player.\n');

  rl.prompt();
});

rl.on('close', () => {
  console.log('\nBye! 👋');
  process.exit(0);
});
