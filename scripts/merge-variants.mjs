// Merge scripts/generated-variants.json into the Firebase 'annotations' node.
// For each item we append the new questions to its reminder array (de-duped)
// and clear its embedding so the app re-embeds on next load.
//
// Usage: node scripts/merge-variants.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

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

const generatedPath = resolve(__dirname, 'generated-variants.json');
const generated = JSON.parse(readFileSync(generatedPath, 'utf8'));
const byId = new Map(generated.map((g) => [g.id, g.newQuestions || []]));

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const snap = await get(ref(db, 'annotations'));
if (!snap.exists()) {
  console.error('No annotations in DB.');
  process.exit(1);
}
const raw = snap.val();
const items = Array.isArray(raw) ? raw : Object.values(raw);

let mergedCount = 0;
let appendedCount = 0;

const next = items.map((ann) => {
  const newQs = byId.get(ann.id);
  if (!newQs || newQs.length === 0) return ann;

  const existing = Array.isArray(ann.reminder)
    ? ann.reminder
    : typeof ann.reminder === 'string' && ann.reminder.trim()
    ? [ann.reminder]
    : [];

  const seen = new Set(existing.map((s) => s.toLowerCase().trim()));
  const toAdd = newQs.filter((q) => q && !seen.has(q.toLowerCase().trim()));
  if (toAdd.length === 0) return ann;

  mergedCount += 1;
  appendedCount += toAdd.length;

  // Clear embedding so the app regenerates it on next load
  const { embedding, embeddingVersion, ...rest } = ann;
  return { ...rest, reminder: [...existing, ...toAdd] };
});

await set(ref(db, 'annotations'), next);

console.log(
  `✅ Updated ${mergedCount} item(s); appended ${appendedCount} new question(s).`,
);
console.log('Embeddings cleared on those items — refresh the app to re-embed.');
process.exit(0);
