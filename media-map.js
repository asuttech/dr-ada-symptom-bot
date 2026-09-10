// Maps triage tiers to Dr. Bee avatar media (images/short clips).
// Drop your own files into the /media folder using these exact names,
// or edit the paths below to match whatever you produce.
//
// If a file doesn't exist yet, sendTierMedia() in index.js will just skip
// sending media rather than crashing — so the bot works fine with zero
// media assets, and gets nicer as you add them.

const path = require('path');

const MEDIA_MAP = {
  green: {
    type: 'image',
    path: path.join(__dirname, 'media', 'dr-bee-reassure.png'),
    caption: null,
  },
  yellow: {
    type: 'image',
    path: path.join(__dirname, 'media', 'dr-bee-concerned.png'),
    caption: null,
  },
  urgent: {
    type: 'image',
    path: path.join(__dirname, 'media', 'dr-bee-urgent.png'),
    caption: null,
  },
};

module.exports = { MEDIA_MAP };
