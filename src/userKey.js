const STORAGE_KEY = 'userOpenAIKey';
const SCROLL_SPEED_KEY = 'answerScrollSpeed';
const DEFAULT_SCROLL_SPEED = 7;
export function getScrollSpeed() {
  try {
    const v = parseFloat(localStorage.getItem(SCROLL_SPEED_KEY));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {/* ignore */}
  return DEFAULT_SCROLL_SPEED;
}

export function setScrollSpeed(value) {
  try {
    if (Number.isFinite(value) && value > 0) {
      localStorage.setItem(SCROLL_SPEED_KEY, String(value));
    }
  } catch {/* ignore */}
}

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

/**
 * Quick validation: makes a cheap call to /v1/models and returns
 * { ok: true } or { ok: false, message }.
 * /v1/models is auth-required, near-zero cost, returns fast.
 */
export async function testOpenAIKey(key) {
  if (!key || !key.trim()) return { ok: false, message: 'Empty key' };
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key.trim()}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: 'Invalid key (401)' };
    if (res.status === 429) return { ok: false, message: 'Rate-limited or out of quota (429)' };
    const text = await res.text();
    return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, message: e.message || 'Network error' };
  }
}
