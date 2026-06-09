const STORAGE_KEY = 'userOpenAIKey';

export function getUserKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setUserKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the key to use for OpenAI calls.
 * Preference: user-supplied key in localStorage, then the env fallback (handy for local dev).
 */
export function resolveOpenAIKey() {
  const user = getUserKey();
  if (user) return user;
  return import.meta.env.VITE_OPENAI_API_KEY || '';
}
