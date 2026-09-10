// Text-to-speech layer — turns Dr. Bee's text replies into a voice note.
//
// Uses Gemini's native TTS models (same GEMINI_API_KEY as ai.js, no separate
// account needed). Gemini's TTS returns raw 16-bit PCM audio, which we wrap
// into a WAV file and then transcode to OGG/Opus with ffmpeg — WhatsApp
// voice notes (the ones with the round "hold to play" bubble) need to be
// sent as audio/ogg; codecs=opus with ptt: true, not mp3/wav.

require('dotenv').config();
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const API_KEY = process.env.GEMINI_API_KEY;

// gemini-3.1-flash-tts-preview is Google's current TTS model and has a
// confirmed free tier as of mid-2026. gemini-2.5-flash-preview-tts is the
// older line — try it via GEMINI_TTS_MODEL if your account doesn't have
// access to 3.1 yet (same pattern as GEMINI_MODEL in ai.js: newer Google
// Cloud projects sometimes only unlock the newest model generation).
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';

// "Kore" is a firm, warm, neutral voice — a reasonable default for a calm
// health-assistant persona. Full voice list is in Google's TTS docs; override
// with GEMINI_TTS_VOICE in .env if you want to try another one.
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';

// On by default (see .env.example) — every reply goes out as both text and
// a voice note. Set ENABLE_VOICE_NOTES=false in .env to send text only.
// Worth knowing: this doubles your Gemini API calls per reply (one for the
// text, one for TTS), which matters if you're on a tight free-tier quota.
const ENABLED = (process.env.ENABLE_VOICE_NOTES || 'true').toLowerCase() !== 'false';

// Strip things that read badly out loud: emoji, markdown asterisks, and the
// tier icons — the words already say "urgent" / "self-care" etc. so nothing
// is lost by dropping the symbol itself.
function sanitizeForSpeech(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Wrap raw PCM data in a minimal 44-byte WAV header so ffmpeg knows how to
// decode it. Gemini TTS output is mono, 16-bit little-endian PCM; the sample
// rate comes back in the response's mimeType (e.g. "audio/L16;rate=24000")
// so we parse it instead of assuming.
function pcmToWav(pcmBuffer, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Pipes a WAV buffer through ffmpeg and returns an OGG/Opus buffer.
// Runs entirely in-memory (stdin -> stdout) — no temp files to clean up.
function wavToOggOpus(wavBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      'pipe:1',
    ]);

    const chunks = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk) => { stderr += chunk; });

    ffmpeg.on('error', reject); // e.g. ffmpeg binary missing/not executable
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.stdin.write(wavBuffer);
    ffmpeg.stdin.end();
  });
}

// Main entry point: text -> OGG/Opus buffer ready to send as a WhatsApp
// voice note. Returns null (rather than throwing) on any failure, so a
// TTS hiccup never takes down the text reply that already went out.
async function textToVoiceNote(text) {
  if (!ENABLED) return null;
  if (!API_KEY) {
    console.error('⚠️  GEMINI_API_KEY is not set — skipping voice note.');
    return null;
  }

  const speechText = sanitizeForSpeech(text);
  if (!speechText) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: speechText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: TTS_VOICE },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini TTS API error:', response.status, errText.slice(0, 500));
      return null;
    }

    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;
    if (!base64Audio) {
      console.error('Gemini TTS returned no audio data.');
      return null;
    }

    // mimeType looks like "audio/L16;codec=pcm;rate=24000" — pull the rate
    // out rather than hardcoding it, since it can vary by model/version.
    const mimeType = part.inlineData.mimeType || '';
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const pcmBuffer = Buffer.from(base64Audio, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
    const oggBuffer = await wavToOggOpus(wavBuffer);

    return oggBuffer;
  } catch (err) {
    console.error('textToVoiceNote failed:', err);
    return null;
  }
}

module.exports = { textToVoiceNote };
