// For each NON-behavioral annotation, generate a tailored buffer sentence
// (matches that specific question/answer) and prepend it to the answer.
//
// First removes the prior uniform buffer "Let me start with what the underlying problem..."
// if present. Idempotent: re-running replaces the buffer line cleanly.
//
// Usage: node scripts/add-custom-buffer.mjs <YOUR_UID>

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/add-custom-buffer.mjs <YOUR_UID>');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''),
      ];
    }),
);

const OPENAI_KEY = env.VITE_OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('Missing VITE_OPENAI_API_KEY in .env');
  process.exit(1);
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getDatabase(app);
const path = `users/${uid}/annotations`;
const snap = await get(ref(db, path));
if (!snap.exists()) {
  console.error('No annotations found.');
  process.exit(1);
}
const items = Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val());

const OLD_BUFFER =
  'Let me start with what the underlying problem actually is — then the answer falls out of that.';

function getPrimary(ann) {
  if (Array.isArray(ann.reminder)) return ann.reminder[0] || '';
  return typeof ann.reminder === 'string' ? ann.reminder : '';
}

function stripOldBuffer(answer) {
  const trimmed = answer.replace(/^\s+/, '');
  if (trimmed.startsWith(OLD_BUFFER)) {
    return trimmed.slice(OLD_BUFFER.length).replace(/^\s+/, '');
  }
  return answer;
}

async function generateBuffer(question, answer) {
  const truncatedAnswer = answer.length > 1200 ? answer.slice(0, 1200) + '…' : answer;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You write ONE buffer sentence for a senior embedded-systems engineer to say at the start of an interview answer.',
            'Goals: buy 5–10 seconds, sound deliberate and senior, smoothly lead INTO the actual answer.',
            'Hard rules:',
            '- Exactly one sentence, 12–25 words.',
            '- Must match the SPECIFIC topic of the question — reference its concept naturally (e.g. "tradeoff", "constraint", "the layer above the BSP", "memory ordering", "the contract").',
            '- Do NOT restate the question verbatim.',
            '- Do NOT start with filler like "Sure," / "Great question," / "Well,".',
            '- Do NOT promise multi-part structure unless the underlying answer is multi-part.',
            '- Voice: thoughtful, structural, never salesy. Avoid jargon like "robust" or "leverage".',
            'Return JSON: {"buffer": "<one sentence>"}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Question:\n"${question}"\n\nCanonical answer (for context — do NOT paraphrase, just inform the buffer's framing):\n"${truncatedAnswer}"\n\nReturn JSON with one tailored buffer sentence.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content).buffer;
}

let updated = 0;
let skippedBehavioral = 0;
const errors = [];

for (let i = 0; i < items.length; i++) {
  const a = items[i];
  const primary = getPrimary(a);
  const lowered = primary.toLowerCase().trim();
  if (lowered.startsWith('tell me about')) {
    skippedBehavioral += 1;
    continue;
  }
  if (!a.answer) continue;

  const cleanAnswer = stripOldBuffer(a.answer);

  try {
    const buffer = await generateBuffer(primary, cleanAnswer);
    if (!buffer || typeof buffer !== 'string') {
      console.warn(`[${i + 1}] Empty buffer for "${primary}"`);
      continue;
    }
    items[i] = { ...a, answer: `${buffer}\n\n${cleanAnswer}` };
    updated += 1;
    console.log(`[${i + 1}] ${primary.slice(0, 60)}\n     → ${buffer}\n`);
    // Light pacing to be polite to the API
    await new Promise((r) => setTimeout(r, 150));
  } catch (e) {
    console.error(`[${i + 1}] FAIL "${primary}":`, e.message);
    errors.push({ primary, msg: e.message });
  }
}

await set(ref(db, path), items);
console.log(
  `\n✅ Updated ${updated} answer(s) with tailored buffers. Skipped ${skippedBehavioral} behavioral. Errors: ${errors.length}.`,
);
process.exit(0);
