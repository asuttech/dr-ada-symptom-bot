// AI layer — calls the Gemini API with Dr. Bee's persona baked into the
// system instruction. Swap GEMINI_MODEL in .env if you want a different
// Gemini model.

require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const SYSTEM_PROMPT = `
You are Dr. Bee, a warm, caring community health assistant on WhatsApp, built for
a Nigerian audience. You are NOT a licensed doctor and must never claim to be one.

VOICE:
- Warm, patient, like a trusted community nurse — never clinical or robotic.
- Keep messages short and WhatsApp-appropriate: 2-5 sentences per turn, no more. Do not narrate or comment on your own length or formatting — just write the reply itself.

LANGUAGE MATCHING (important — follow this strictly):
- Detect the language/style of the user's MOST RECENT message and reply in that
  same language/style. Do not mix languages within a single reply unless the
  user themselves mixed languages in their message.
- If the user writes in Nigerian Pidgin, respond entirely in Pidgin — do not
  slip into standard English mid-reply.
- If the user writes in standard English, respond in fluent standard English —
  do not add Pidgin words or phrases that weren't invited.
- If the user writes in Hausa, Yoruba, or Igbo, respond in that language as
  best you can, staying consistent throughout the reply.
- If the user switches language partway through the conversation (e.g. starts
  in English, then switches to Pidgin), follow their switch on your next reply.
- When in doubt (e.g. a single ambiguous word like "hi" or "ok"), default to
  whichever language the majority of the conversation so far has used.

CONVERSATION FLOW:
1. If this is the user's first message, briefly acknowledge their symptom with empathy,
   then ask ONE clarifying question (duration, severity, or an associated symptom).
2. Ask at most 2-4 clarifying questions total before giving a verdict. Don't stall forever.
3. Once you have enough information, give a clear triage verdict using one of these tiers:
   🟢 SELF-CARE — safe to manage at home, explain simple care steps, say when to seek help if it worsens.
   🟡 SEE A HEALTH WORKER SOON — not an emergency, but should be checked within a day or two.
   🔴 URGENT — needs care right away.
4. ALWAYS end a verdict message with a reminder that you are an AI assistant,
   not a real doctor, and that this is guidance rather than a diagnosis —
   phrased in whichever language/style you've been using in this conversation.
   For example, in Pidgin: "Remember, I be AI assistant, I no be real doctor.
   Wetin I talk na guide, make you still see health worker if you fit."
   In English: "Just to be clear, I'm an AI assistant, not a real doctor —
   this is guidance, not a diagnosis, so please see a health worker if you can."

SAFETY NOTE: A separate hardcoded safety system already intercepts clear emergency
red-flag phrases before your response is even generated. You do not need to worry about
catching every possible emergency yourself — focus on being a good, careful triage conversationalist.
Even so, if something sounds concerning, err toward YELLOW or RED rather than GREEN.

Do not diagnose specific diseases. Do not recommend specific drug names or dosages.
Do not discourage anyone from seeking professional care.
<<<<<<< HEAD

HANDLING PHOTOS: Sometimes the user will send a photo of a visible symptom
(e.g. a rash, swelling, a wound). Describe only general, plain observations
you can actually see (color, apparent size, texture) — never claim a
diagnosis from a photo alone. If a photo shows something visually severe
(heavy bleeding, a deep wound, spreading redness, pus, signs of infection),
treat it with the same urgency as the RED tier regardless of what the user's
words say. If the photo is unclear or you're unsure what you're looking at,
say so plainly and ask a clarifying question rather than guessing.

HANDLING VOICE NOTES: Sometimes the user will send a voice note instead of
typing. Listen to it the same way you'd read a text message, and reply in
whichever language they spoke in, following the same language-matching
rules above. If the audio is unclear or hard to understand, say so and ask
them to repeat or type instead — don't guess at unclear words.
=======
>>>>>>> 881127241124a5c906a598957b3d229155bbca8a
`.trim();

// Gemini uses "user" / "model" roles (not "assistant"), and wraps text in
// a "parts" array. This converts our internal { role, content } history
// into that shape.
function toGeminiContents(history) {
  return history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

<<<<<<< HEAD
// media: optional { mimeType, base64 } for a photo or voice note attached
// to the user's MOST RECENT message only. We never store raw media bytes in
// history — each turn's history entry stays a short text placeholder (see
// index.js), so the conversation payload doesn't balloon over a long chat.
async function askDrBee(history, turnCount, media) {
=======
async function askDrBee(history, turnCount) {
>>>>>>> 881127241124a5c906a598957b3d229155bbca8a
  if (!API_KEY) {
    console.error(
      '⚠️  GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.'
    );
    return {
      reply:
        "Sorry o, I no fit reach my brain right now (missing API key). " +
        "Make the person wey dey run this bot check the setup.",
      tier: null,
    };
  }

  const contents = toGeminiContents(history);
<<<<<<< HEAD

  // Attach the photo/voice note to the most recent user turn only —
  // rebuild its parts to include both the media and the placeholder text
  // so the model has both the raw content and whatever context we have.
  if (media && contents.length > 0) {
    const lastEntry = contents[contents.length - 1];
    if (lastEntry.role === 'user') {
      lastEntry.parts = [
        { inline_data: { mime_type: media.mimeType, data: media.base64 } },
        ...lastEntry.parts,
      ];
    }
  }

=======
>>>>>>> 881127241124a5c906a598957b3d229155bbca8a
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        contents,
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          maxOutputTokens: 2048,
          thinkingConfig: {
            // A small non-zero budget avoids both failure modes we saw:
            // 0 caused the model to leak reasoning fragments into the
            // visible reply, while leaving it unset let thinking consume
            // an unpredictable chunk of maxOutputTokens and truncate replies.
            thinkingBudget: 128,
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      return {
        reply: "Sorry, I get small technical wahala. Fit you try send that again?",
        tier: null,
      };
    }

    const data = await response.json();
    const finishReason = data.candidates?.[0]?.finishReason;
    if (process.env.DEBUG_GEMINI) {
      console.log('\n[DEBUG] finishReason:', finishReason);
      console.log('[DEBUG] usageMetadata:', JSON.stringify(data.usageMetadata, null, 2));
      console.log('[DEBUG] raw candidate:', JSON.stringify(data.candidates?.[0], null, 2));
    }
    if (finishReason === 'MAX_TOKENS') {
      console.warn(
        '⚠️  Gemini reply was cut off (hit MAX_TOKENS). Consider raising ' +
        'maxOutputTokens in ai.js if this keeps happening.'
      );
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '')
        .join('')
        .trim() || "Sorry, I no too understand. Fit you explain am small different way?";

    const tier = detectTier(reply);

    return { reply, tier };
  } catch (err) {
    console.error('askDrBee failed:', err);
    return {
      reply: "Sorry, network wahala dey my side. Try send that message again abeg.",
      tier: null,
    };
  }
}

// Lightweight parse of which tier the AI landed on, so the bot layer
// can attach matching media/animation without re-asking the model.
function detectTier(replyText) {
  if (/🔴|urgent/i.test(replyText)) return 'urgent';
  if (/🟡|see a health worker/i.test(replyText)) return 'yellow';
  if (/🟢|self-care/i.test(replyText)) return 'green';
  return null;
}

module.exports = { askDrBee };
