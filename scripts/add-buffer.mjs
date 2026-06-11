// Prepend a buffer sentence to the answer of every NON-behavioral annotation.
// Behavioral = any item whose primary reminder starts with "Tell me about".
// Idempotent: skips items that already start with the buffer.
//
// Usage: node scripts/add-buffer.mjs <YOUR_UID>

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/add-buffer.mjs <YOUR_UID>');
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

const BUFFER =
  "Let me start with what the underlying problem actually is — then the answer falls out of that.";

function getPrimary(ann) {
  if (Array.isArray(ann.reminder)) return ann.reminder[0] || '';
  return typeof ann.reminder === 'string' ? ann.reminder : '';
}

let updated = 0;
let skippedBehavioral = 0;
let skippedAlreadyHasBuffer = 0;

const next = items.map((a) => {
  const primary = getPrimary(a).toLowerCase().trim();
  // Skip behavioral
  if (primary.startsWith('tell me about')) {
    skippedBehavioral += 1;
    return a;
  }
  if (!a.answer) return a;
  // Idempotent — bail if already starts with buffer
  if (a.answer.trimStart().startsWith(BUFFER)) {
    skippedAlreadyHasBuffer += 1;
    return a;
  }
  updated += 1;
  return { ...a, answer: `${BUFFER}\n\n${a.answer}` };
});

await set(ref(db, path), next);
console.log(`✅ Updated ${updated} answer(s) with buffer sentence.`);
console.log(`   Skipped ${skippedBehavioral} behavioral, ${skippedAlreadyHasBuffer} already had buffer.`);
process.exit(0);
