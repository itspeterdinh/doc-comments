import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; })
);
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getDatabase(app);
const snap = await get(ref(db, 'users/HGxMXI4UbuhjC4yAdaoYrFJYcF63/annotations'));
if (!snap.exists()) { console.log('No data'); process.exit(0); }
const items = Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val());
items.forEach((a, i) => {
  const r = Array.isArray(a.reminder) ? a.reminder[0] : a.reminder;
  console.log(`${i+1}. ${r}`);
});
process.exit(0);
