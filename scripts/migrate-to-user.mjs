// One-off migration: copy /annotations -> /users/<uid>/annotations
//
// Usage:
//   1. Sign in to the app once, open browser DevTools → Console, and look at
//      the user object (or check Firebase Console → Authentication → Users
//      for your UID).
//   2. Temporarily relax your Realtime Database rules to allow this script:
//        {
//          "rules": {
//            ".read": "auth != null || true",
//            ".write": "auth != null || true"
//          }
//        }
//      (Or just paste:  { "rules": { ".read": true, ".write": true } } )
//   3. Run:  node scripts/migrate-to-user.mjs <YOUR_UID>
//   4. RESTORE the strict per-user rules immediately afterwards.

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

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/migrate-to-user.mjs <YOUR_UID>');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const srcRef = ref(db, 'annotations');
const dstRef = ref(db, `users/${uid}/annotations`);

console.log('Reading legacy /annotations …');
const srcSnap = await get(srcRef);
if (!srcSnap.exists()) {
  console.error('Nothing at /annotations. Nothing to migrate.');
  process.exit(1);
}
const value = srcSnap.val();
const items = Array.isArray(value) ? value : Object.values(value);
console.log(`Found ${items.length} item(s).`);

console.log(`Checking existing data at users/${uid}/annotations …`);
const dstSnap = await get(dstRef);
if (dstSnap.exists()) {
  const existing = dstSnap.val();
  const existingArr = Array.isArray(existing) ? existing : Object.values(existing);
  if (existingArr.length > 0) {
    console.warn(
      `⚠️  Destination already has ${existingArr.length} item(s). Aborting to avoid overwriting.`,
    );
    console.warn('Delete that node first if you really want to replace it.');
    process.exit(1);
  }
}

console.log(`Writing ${items.length} item(s) → users/${uid}/annotations …`);
await set(dstRef, items);
console.log(`✅ Migrated ${items.length} item(s).`);
console.log(
  'Now restore your strict per-user rules in the Firebase Console so other users can\'t read each other\'s data.',
);
process.exit(0);
