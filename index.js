// Dr. Bee — Local Language Symptom Checker Bot
// Built on Baileys (unofficial WhatsApp Web API) — see https://baileys.wiki
//
// SETUP:
//   npm install baileys @hapi/boom qrcode-terminal
//   node index.js
//   Scan the QR code with a spare WhatsApp number (Linked Devices > Link a Device)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode'); // generates an actual PNG for browser scanning
const makeWASocket = require('baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('baileys');
const { Boom } = require('@hapi/boom');
const { checkRedFlags } = require('./safety-rules');
const { askDrBee } = require('./ai');
const { getSession, updateSession, resetSession, runInOrder } = require('./session-store');
const { MEDIA_MAP } = require('./media-map');
const { textToVoiceNote } = require('./tts');

// Baileys is very chatty by default (pairing, key sync, pre-keys, etc.) —
// fine for debugging, noisy for a demo. Defaults to quiet; set
// BAILEYS_LOG_LEVEL=debug in your environment if you need to troubleshoot
// a connection issue.
const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

// On Render (or any host with an ephemeral filesystem), point this at a
// mounted persistent disk so your WhatsApp login survives restarts —
// e.g. AUTH_STORAGE_PATH=/var/data/auth_state. Defaults to a local folder
// for running on your own machine.
const AUTH_STORAGE_PATH = process.env.AUTH_STORAGE_PATH || 'auth_state';

// Simple shared-secret so random internet visitors can't view your QR code
// and link their own WhatsApp device to your bot. Set QR_ACCESS_TOKEN in
// your environment and visit /qr?token=<that value> to view it.
const QR_ACCESS_TOKEN = process.env.QR_ACCESS_TOKEN;

let latestQR = null;
let connectionStatus = 'starting';

function startHttpServer() {
  const port = process.env.PORT || 3000;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`Dr. Bee bot status: ${connectionStatus}`);
      return;
    }

    if (url.pathname === '/qr') {
      if (!QR_ACCESS_TOKEN) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('QR_ACCESS_TOKEN is not set on the server — refusing to show QR publicly.');
        return;
      }
      if (url.searchParams.get('token') !== QR_ACCESS_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden — missing or incorrect token.');
        return;
      }
      if (!latestQR) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('No QR code pending right now (already connected, or not generated yet — refresh in a few seconds).');
        return;
      }
      try {
        const pngBuffer = await QRCode.toBuffer(latestQR, { width: 400 });
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(pngBuffer);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to render QR code.');
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`HTTP server listening on port ${port} (health check + QR viewer)`);
  });
}

async function startBot() {
  // NOTE: useMultiFileAuthState is fine for a hackathon demo.
  // Do not rely on it in production (per Baileys docs) — swap for a proper
  // auth store (e.g. DB-backed) if this ever goes beyond a demo.
  //
  // On a host with an ephemeral filesystem (like Render's free tier), this
  // folder gets wiped on every restart unless AUTH_STORAGE_PATH points to a
  // mounted persistent disk — see the README's deployment section.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_STORAGE_PATH);

  const sock = makeWASocket({
    auth: state,
    logger: baileysLogger,
    // printQRInTerminal is deprecated on newer Baileys versions — we render
    // the QR ourselves via qrcode-terminal in the connection.update handler below.
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      connectionStatus = 'waiting for QR scan';
      console.log('\nScan this QR code with WhatsApp > Linked Devices > Link a Device:\n');
      qrcode.generate(qr, { small: true });
      if (process.env.PORT) {
        console.log('(Running on a server — visit /qr?token=<QR_ACCESS_TOKEN> in a browser to scan instead.)');
      }
    }

    if (connection === 'close') {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'reconnecting';
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      latestQR = null;
      connectionStatus = 'connected';
      console.log('✅ Dr. Bee is online and connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text.trim()) continue;

      // Queued per-JID so two quick messages from the same person are
      // always handled in order — see session-store.js for why this
      // matters. Different people still run fully in parallel: this only
      // serializes messages that share a JID, and errors are caught so
      // one failed reply can't jam a user's queue for later messages.
      runInOrder(jid, () => handleIncomingMessage(sock, jid, text.trim(), msg))
        .catch(err => console.error('Unhandled error processing message from', jid, err));
    }
  });
}

async function handleIncomingMessage(sock, jid, text, originalMsg) {
  const session = getSession(jid);

  // Reset command for demo purposes
  if (/^(restart|reset|start over)$/i.test(text)) {
    resetSession(jid);
    await sendAsDrBee(sock, jid,
      "Ok, we don start again 🙂 Hello, I be Dr. Bee 👋 Wetin dey worry you today?",
      originalMsg
    );
    return;
  }

  // Append to conversation history
  session.history.push({ role: 'user', content: text });

  // --- SAFETY LAYER: runs BEFORE the AI decides anything ---
  // This is deliberately hardcoded and independent of the LLM.
  // If ANY red-flag phrase matches, we short-circuit straight to
  // the urgent-care response, no matter what the AI would have said.
  const redFlag = checkRedFlags(text);
  if (redFlag) {
    await sendAsDrBee(sock, jid, buildUrgentResponse(redFlag), originalMsg);
    updateSession(jid, session);
    return;
  }

  // --- AI LAYER: ask the LLM for triage + next question ---
  const aiResult = await askDrBee(session.history, session.turnCount);

  session.history.push({ role: 'assistant', content: aiResult.reply });
  session.turnCount += 1;
  updateSession(jid, session);

  await sendAsDrBee(sock, jid, aiResult.reply, originalMsg);

  // Optional: attach tier-based media (see media-map.js) once
  // a final verdict tier is reached
  if (aiResult.tier) {
    await sendTierMedia(sock, jid, aiResult.tier);
  }
}

async function sendAsDrBee(sock, jid, text, quotedMsg) {
  await sock.sendMessage(
    jid,
    { text },
    { quoted: quotedMsg }
  );

  // Voice note goes out alongside the text, best-effort — a TTS/ffmpeg
  // hiccup here should never stop the text reply that already sent.
  try {
    const voiceNote = await textToVoiceNote(text);
    if (voiceNote) {
      await sock.sendMessage(jid, {
        audio: voiceNote,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      });
    }
  } catch (err) {
    console.error('Failed to send voice note:', err);
  }
}

function buildUrgentResponse(matchedSymptom) {
  return (
    `⚠️ Please listen carefully.\n\n` +
    `Wetin you describe (${matchedSymptom}) fit be emergency. ` +
    `I want make you go hospital *now now*, no wait, no try home remedy first.\n\n` +
    `If you fit, make somebody follow you go, or call emergency number for your area.\n\n` +
    `I be AI assistant, I no be real doctor — but this one no be something to manage for house.`
  );
}

async function sendTierMedia(sock, jid, tier) {
  const asset = MEDIA_MAP[tier];
  if (!asset) return;

  // Skip silently if the file hasn't been added yet — the bot should never
  // crash just because someone hasn't drawn the avatar art yet.
  if (!fs.existsSync(asset.path)) return;

  try {
    if (asset.type === 'image') {
      await sock.sendMessage(jid, {
        image: { url: asset.path },
        caption: asset.caption || undefined,
      });
    } else if (asset.type === 'video') {
      await sock.sendMessage(jid, {
        video: { url: asset.path },
        caption: asset.caption || undefined,
        gifPlayback: true,
      });
    }
  } catch (err) {
    console.error(`Failed to send ${tier} media:`, err);
  }
}

startHttpServer();
startBot();
