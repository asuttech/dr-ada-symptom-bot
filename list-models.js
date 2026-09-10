// Lists which Gemini models your API key can actually access.
// Model availability and free-tier quotas vary by account/project age,
// so this is more reliable than guessing model names from documentation.
//
// Usage: node list-models.js

require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('Set GEMINI_API_KEY in your .env file first.');
  process.exit(1);
}

async function listModels() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
  );
  const data = await response.json();

  if (!response.ok) {
    console.error('Error fetching models:', JSON.stringify(data, null, 2));
    return;
  }

  const flashModels = data.models
    ?.filter(m => m.name.includes('flash') && m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));

  console.log('Flash models available to your API key:\n');
  flashModels?.forEach(m => console.log('  -', m));
  console.log(
    '\nTry the "-lite" variants first if available — they typically have\n' +
    'more generous free daily quotas than the full flash models.\n' +
    'Set whichever works well in your .env as GEMINI_MODEL=<name>'
  );
}

listModels();
