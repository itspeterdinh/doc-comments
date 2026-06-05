import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ANNOTATIONS_PATH = 'annotations';

export async function loadFromCloud() {
  const snap = await get(ref(db, ANNOTATIONS_PATH));
  if (!snap.exists()) return null;
  const value = snap.val();
  // Firebase doesn't preserve arrays-of-objects perfectly; normalize to array
  return Array.isArray(value) ? value : Object.values(value);
}

export async function saveToCloud(annotations) {
  await set(ref(db, ANNOTATIONS_PATH), annotations);
}
