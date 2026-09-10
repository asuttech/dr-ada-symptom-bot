# Dr. Bee avatar media

Status: 🟢 and 🟡 tiers have images in place. 🔴 urgent still needs a proper
visual — see note below.

| File | Used for | Status |
|---|---|---|
| `dr-bee-reassure.png` | 🟢 self-care verdicts | ✅ in place, fits well (checkmark, calm) |
| `dr-bee-concerned.png` | 🟡 see-a-health-worker verdicts | ✅ in place, works as a neutral middle tier |
| `dr-bee-urgent.png` | 🔴 urgent verdicts | ⚠️ placeholder only — currently shows a "SELF-CARE VERDICTS" badge with calm leaf/heart imagery, which visually contradicts an urgent message |

## Before demo day: fix the urgent-tier image

The current `dr-bee-urgent.png` doesn't read as urgent — no warning color,
no alert symbol. Sending it alongside a genuine 🔴 red-flag response would
visually undercut the seriousness of the message. Replace it with something
that clearly signals "act now": warm red/orange tones, an exclamation or
alert icon, Dr. Bee's expression more concerned/serious rather than calm.

Keep the same character design (same face, hair, coat, stethoscope) so it
still reads as the same Dr. Bee — just with different color grading and
expression for this tier.

Once you have a replacement, just overwrite `dr-bee-urgent.png` with the
new file — no code changes needed, `media-map.js` already points here.
