import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ---- Auth ----
const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onUserChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ---- Per-user annotations ----
function userPath(uid) {
  if (!uid) throw new Error('No signed-in user');
  return `users/${uid}/annotations`;
}

export async function loadFromCloud(uid) {
  const snap = await get(ref(db, userPath(uid)));
  if (!snap.exists()) return null;
  const value = snap.val();
  return Array.isArray(value) ? value : Object.values(value);
}

export async function saveToCloud(uid, annotations) {
  await set(ref(db, userPath(uid)), annotations);
}
