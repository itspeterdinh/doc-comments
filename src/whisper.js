import { resolveOpenAIKey } from './userKey';

export async function transcribe(blob) {
  const API_KEY = resolveOpenAIKey();
  if (!API_KEY) throw new Error('OpenAI API key not configured. Open Settings and add your own key.');
  const form = new FormData();
  form.append('file', blob, 'chunk.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper failed: ${err}`);
  }
  const json = await res.json();
  return (json.text || '').trim();
}
