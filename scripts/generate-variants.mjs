// Generate 2 additional reminder variants per annotation using the answer text.
// Prints each item's originalReminder + the 2 new questions, and writes the full
// result to scripts/generated-variants.json for review.
//
// Usage: node scripts/generate-variants.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''),
      ];
    }),
);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const OPENAI_KEY = env.VITE_OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('Missing VITE_OPENAI_API_KEY in .env');
  process.exit(1);
}

function getVariants(ann) {
  if (Array.isArray(ann.reminder)) return ann.reminder.filter(Boolean);
  if (typeof ann.reminder === 'string' && ann.reminder.trim()) return [ann.reminder];
  return [];
}

async function generateVariants(originalReminder, existingVariants, answer) {
  const existingList = existingVariants.map((v, i) => `${i + 1}. ${v}`).join('\n');
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
          content:
            'You generate alternate phrasings of interview/technical questions that would all be answered by the same canonical answer. Return JSON: {"questions": ["q1"]}. Exactly one question. It must be distinctly worded — different angle, different verb, or different framing — not a trivial rewording. The question should naturally invite the given answer.',
        },
        {
          role: 'user',
          content: `Original question:\n"${originalReminder}"\n\nExisting variants:\n${existingList}\n\nCanonical answer:\n"${answer}"\n\nReturn JSON with exactly 1 NEW question variant that hasn't already been covered above.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  return parsed.questions || [];
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const snap = await get(ref(db, 'annotations'));
if (!snap.exists()) {
  console.error('No annotations in database.');
  process.exit(1);
}
const raw = snap.val();
const items = Array.isArray(raw) ? raw : Object.values(raw);
console.log(`Loaded ${items.length} annotations.\n`);

const results = [];
for (let i = 0; i < items.length; i++) {
  const ann = items[i];
  const variants = getVariants(ann);
  const original = variants[0];
  if (!original || !ann.answer) {
    console.log(`[${i + 1}/${items.length}] SKIP (no reminder or answer)`);
    continue;
  }
  try {
    const newQs = await generateVariants(original, variants, ann.answer);
    console.log(`[${i + 1}/${items.length}] Original: ${original}`);
    newQs.forEach((q, k) => console.log(`         New #${k + 1}: ${q}`));
    console.log();
    results.push({
      id: ann.id,
      originalReminder: original,
      existingVariantsCount: variants.length,
      newQuestions: newQs,
    });
  } catch (e) {
    console.error(`[${i + 1}/${items.length}] FAIL:`, e.message);
  }
}

const outPath = resolve(__dirname, 'generated-variants.json');
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\n✅ Wrote ${results.length} items to ${outPath}`);
process.exit(0);
