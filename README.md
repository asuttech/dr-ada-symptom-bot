# Dr. Bee — Local Language Symptom Checker

WhatsApp-based AI symptom triage bot built for the IdentArk x 3MTT AI Hackathon Challenge.

## What it does

Lets someone describe symptoms in Pidgin (and other Nigerian languages, with
expansion) over WhatsApp, and get a simple triage verdict:

- 🟢 **Self-care** — safe to manage at home, with guidance
- 🟡 **See a health worker soon** — not an emergency, but shouldn't wait long
- 🔴 **Urgent** — needs care right away

A hardcoded safety layer checks every message for clear emergency red flags
(chest pain, heavy bleeding, unconsciousness, etc.) *before* the AI ever
responds — so the AI never has the final say on a genuine emergency. That's
the responsible-AI story worth highlighting to judges.

**Beyond text**: users can also send a photo of a visible symptom (a rash,
swelling, a wound) or a voice note instead of typing, and Dr. Bee responds
to either the same way it would to typed text — same triage tiers, same
language matching for voice notes. One important limitation worth being
upfront about in your pitch: the hardcoded safety layer above only scans
*text* for emergency red flags. A photo showing something visually severe
relies on the AI itself recognizing that and escalating to urgent — a
softer guarantee than the hardcoded check gives for typed symptoms. Also
worth disclosing: any photo or voice note a user sends gets forwarded to
Google's Gemini API for analysis, same as their typed messages already are.

## Project structure

| File | Purpose |
|---|---|
| `index.js` | Connects to WhatsApp via Baileys, routes incoming messages |
| `safety-rules.js` | Hardcoded red-flag detector that overrides the AI |
| `ai.js` | Calls the Gemini API with Dr. Bee's persona and triage instructions |
| `session-store.js` | In-memory conversation history per WhatsApp user |
| `media-map.js` | Maps triage tiers to Dr. Bee avatar images/clips |
| `tts.js` | Turns Dr. Bee's replies into WhatsApp voice notes via Gemini TTS |
| `test-console.js` | Chat with Dr. Bee in your terminal — no WhatsApp needed |
| `test-tts.js` | Preview the voice-note feature — saves audio to a local file, no WhatsApp needed |
| `test-safety-rules.js` | Automated smoke test for the safety layer |
| `list-models.js` | Lists which Gemini models your API key can access |
| `render.yaml` | Render Blueprint — one-click paid deployment config |

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your API key:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in your real Gemini API key. You can get a
   free one at https://aistudio.google.com/apikey.

3. **Test the safety layer first** (no API key or WhatsApp needed):
   ```bash
   npm run test:safety
   ```
   All cases should pass. If you add more red-flag phrases to
   `safety-rules.js`, add matching test cases here too.

4. **Try a conversation in your terminal** (needs your API key set):
   ```bash
   npm run test:console
   ```
   Type symptom messages and see how Dr. Bee responds, without needing
   WhatsApp connected at all. Great for fast iteration.

5. **Connect to WhatsApp for real**:
   ```bash
   npm start
   ```
   A QR code prints to your terminal, and an HTTP server also starts
   (default port 3000) with a `/health` check and a `/qr` endpoint for
   remote scanning — useful once you deploy this somewhere without a
   terminal (see "Deploying to Render" below). Locally, just scan the
   terminal QR code with WhatsApp → Settings → Linked Devices → Link a
   Device on a **spare phone number** (not your personal one). The bot
   stays connected as long as your machine stays online and the
   `auth_state` folder isn't deleted.

## Voice notes

Every reply Dr. Bee sends goes out as both a text message and a WhatsApp
voice note (the round "hold to play" bubble), so people who'd rather listen
than read can just tap play.

- Uses Gemini's own TTS models — no separate service or API key needed,
  it reuses `GEMINI_API_KEY`.
- Raw audio comes back from Gemini as PCM, gets wrapped into a WAV file,
  then transcoded to OGG/Opus with `ffmpeg-static` (a bundled ffmpeg
  binary — nothing extra to install on your machine or on Render).
- Configurable in `.env`:
  - `ENABLE_VOICE_NOTES=false` — text only, no voice notes.
  - `GEMINI_TTS_MODEL` — defaults to `gemini-2.5-flash-preview-tts`; try
    `gemini-3.1-flash-tts-preview` if your API key has access to it.
  - `GEMINI_TTS_VOICE` — defaults to `Kore`. Google's Gemini TTS docs list
    the full set of built-in voices if you want to try another.
- If a voice note fails to generate for any reason (network hiccup, model
  hiccup, ffmpeg missing), the bot logs it and carries on with the text
  reply — a TTS failure never blocks or crashes a conversation.
- Gemini TTS speaks the text it's given fairly literally, so `tts.js`
  strips emoji and markdown asterisks from the reply first (the words
  already convey "urgent" / "self-care" etc. without the symbol).

Preview the voice without going through WhatsApp:
```bash
npm run test:tts
```
Type any text and it saves an `.ogg` file under `tts-previews/` that you
can play locally — handy for checking the voice sounds natural and that
Pidgin/local-language phrasing comes out clearly.

## Troubleshooting

**Check which models your API key can actually use:**
```bash
npm run models
```
Model availability and free-tier daily quotas vary by account — newer
Google Cloud projects are often restricted to only the newest models,
which can have much stricter daily limits (as low as 20 requests/day)
than older, more established models. This is a Google account-level
restriction, not a bug in this code.

**Hitting `429 RESOURCE_EXHAUSTED` errors quickly during testing?**
You've hit your daily free quota. Your two options:
- Wait for it to reset (resets at midnight Pacific time), or
- Enable billing on your Google Cloud project. This unlocks much higher
  limits (roughly 300 requests/minute, 1,000+/day) and for hackathon-scale
  usage will cost cents, not dollars — you're only charged for what you
  actually use.

**Replies getting cut off mid-sentence, or looking like garbled fragments?**
Run with extra debug output to see exactly what Gemini is returning:
```bash
DEBUG_GEMINI=1 npm run test:console
```
**On Windows PowerShell**, environment variables use different syntax:
```powershell
$env:DEBUG_GEMINI=1; npm run test:console
```
This prints the raw `finishReason`, token usage breakdown, and full
response for each turn — if you see `finishReason: "MAX_TOKENS"`, the
reply is being cut off before it's finished; try raising `maxOutputTokens`
in `ai.js`.

**Terminal flooded with Baileys internal logs (pairing, key sync, pre-keys)?**
This is normal Baileys behavior — it defaults to a fairly verbose logger,
which is fine for troubleshooting but noisy for a demo. This project sets
it to silent by default. If you need to debug a connection issue, run:
```bash
BAILEYS_LOG_LEVEL=debug npm start
```
or on Windows PowerShell:
```powershell
$env:BAILEYS_LOG_LEVEL="debug"; npm start
```
A few things you'll see even at silent level that are **expected and not
bugs**: a `stream:error code 515` immediately after your first QR pairing
(WhatsApp always forces one reconnect after fresh pairing — Baileys
handles it automatically), and occasional `"failed to decrypt message"`
warnings for `status@broadcast` updates from contacts — these are just
WhatsApp Status updates your bot hasn't built a session with yet, and
don't affect normal DM conversations with your bot at all.

## Deploying to Railway (recommended for the hackathon)

Railway gives new accounts a $5 trial credit valid for 30 days, no card
required — plenty for a hackathon timeline. Unlike Render's free tier, it
doesn't spin services down when idle, which suits this bot well since
Baileys makes an outbound connection to WhatsApp rather than waiting for
inbound requests. After the 30-day trial, ongoing free usage drops to
$1/month in credit (enough for one small always-on service, not much more)
— fine to know if you want to keep this running past the hackathon.

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → select your repo. Railway
   auto-detects Node.js from `package.json` and runs the `start` script —
   no extra config file needed.
3. Add environment variables under **Variables**: `GEMINI_API_KEY`,
   `GEMINI_MODEL`, `QR_ACCESS_TOKEN`, `AUTH_STORAGE_PATH=/data/auth_state`,
   and the TTS variables if you're using voice notes.
4. Add a persistent **Volume** (Settings → Volumes → New Volume, mount
   path `/data`) — this is what makes your WhatsApp login survive
   redeploys, the same role Render's persistent disk plays.
5. **Settings → Networking → Generate Domain** to get a public URL.
6. Visit `https://<your-app>.up.railway.app/qr?token=<your QR_ACCESS_TOKEN>`
   and scan it with WhatsApp → Linked Devices → Link a Device.

## Deploying to Render (alternative)

A WhatsApp bot needs to stay connected continuously — it's not a typical
request/response web app. That shapes which Render setup actually works.

### Recommended: paid Web Service + persistent disk (~$7.25/month)

This is the reliable option and what `render.yaml` in this repo sets up:

1. Push this project to a GitHub repo.
2. In the Render Dashboard, choose **New → Blueprint** and point it at your repo.
   Render reads `render.yaml` and provisions a Starter web service with a
   1GB persistent disk automatically.
3. In the Render Dashboard, set these environment variables (marked as
   secrets in `render.yaml`, so Render will prompt you for them):
   - `GEMINI_API_KEY` — your Gemini key
   - `QR_ACCESS_TOKEN` — make up a long random string, e.g. `openssl rand -hex 24`
4. Deploy. Once it's live, visit `https://<your-service>.onrender.com/qr?token=<your QR_ACCESS_TOKEN>`
   in a browser — this shows the WhatsApp login QR code as an actual image
   you can scan with your phone. Scan it via WhatsApp → Linked Devices →
   Link a Device.
5. Once connected, the QR endpoint will just say "no QR code pending" —
   that's expected, it means you're logged in.

**Why this setup**: the Starter plan doesn't spin down, so the bot stays
connected to WhatsApp continuously. The persistent disk means your login
survives restarts and redeploys — without it, you'd need to rescan the QR
code every single time Render restarts your service, which happens more
often than you'd expect (deploys, platform maintenance, etc).

### Free-tier alternative (not recommended for demo day)

Render's free compute plan only exists for Web Services, and it comes with
two problems that hit a WhatsApp bot particularly hard:

- **Spins down after 15 minutes with no inbound traffic.** Baileys makes an
  *outbound* connection to WhatsApp, so without extra work, Render will
  spin your bot down mid-conversation. You'd need an external uptime
  pinger (e.g. a free cron service hitting your `/health` endpoint every
  10 minutes) to keep it alive — and even then, Render can still restart
  a free instance at any time for its own reasons.
- **No persistent disk on free instances.** Every spin-down or restart
  wipes the filesystem, including your `auth_state` folder — meaning
  you'd need to rescan the QR code and relink WhatsApp after every restart.

This is fine for a quick "does it deploy" test, but genuinely risky for a
live demo in front of judges — your bot could silently lose its WhatsApp
connection at an inconvenient moment. If budget allows, spend the ~$7 for
the Starter plan before demo day.

### Security note on the `/qr` endpoint

Anyone who has both your service's URL and your `QR_ACCESS_TOKEN` can view
the QR code and link their own phone as a device on your bot's WhatsApp
account — so treat `QR_ACCESS_TOKEN` like a password. Don't commit it to
git, and don't share the full `/qr?token=...` URL publicly (e.g. in your
hackathon submission or pitch deck).



1. **Expand `safety-rules.js`** — get input from anyone with medical/nursing
   background on your team, or reputable triage guidelines. The current
   list is a starting skeleton, not exhaustive. Add test cases in
   `test-safety-rules.js` for anything you add.
2. **Translate key phrases** into Hausa, Yoruba, Igbo — even partial
   coverage in one additional language beyond Pidgin strengthens your demo.
3. **Test with 15-20 realistic symptom scenarios** across all three tiers
   using `test-console.js` before demo day. Write down what you tried so
   you can show judges consistent, repeatable behavior.
4. **Add Dr. Bee's avatar images** — drop files into `/media` following the
   naming convention in `media/README.md`. The bot works fine with none,
   it just skips sending images until you add them.
5. **Decide on a demo fallback** — Baileys depends on a live WhatsApp
   connection, a single point of failure during a live pitch. Consider
   recording a backup demo video in case of connectivity issues on
   presentation day.
6. **Handle idle sessions** — `session-store.js` keeps conversations in
   memory indefinitely; consider auto-expiring old sessions if you extend
   this beyond the hackathon.

## Known limitations, worth being upfront about with judges

- **Baileys is unofficial** — not affiliated with or endorsed by WhatsApp.
  Fine for a hackathon demo; don't describe it as an "official WhatsApp
  integration" in your pitch.
- **In-memory session storage** — a bot restart wipes ongoing conversations.
  Fine for a demo; would need a real database (Redis/Postgres) beyond that.
- **Not a diagnostic tool** — Dr. Bee is explicitly instructed never to
  diagnose specific diseases or recommend drug names/dosages, and always
  closes with a "not a real doctor" reminder. Keep this framing in your
  pitch — it's a triage/guidance tool, not a replacement for care.
