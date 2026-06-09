import { resolveOpenAIKey } from './userKey';

const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 256; // smaller = cheaper storage, still high quality

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireKey() {
  const key = resolveOpenAIKey();
  if (!key || key === 'your_openai_key_here') {
    throw new Error('OpenAI API key not configured. Open Settings and add your own key.');
  }
  return key;
}

export async function embed(text, { maxAttempts = 4 } = {}) {
  const API_KEY = requireKey();
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: text,
        dimensions: DIMENSIONS,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data[0].embedding;
    }
    const errText = await res.text();
    lastErr = new Error(`OpenAI embed failed (${res.status}): ${errText}`);
    // Retry on 429 (rate limit) or 5xx
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = parseFloat(res.headers.get('retry-after')) || 0;
      const backoff = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      console.warn(`Embed retry ${attempt + 1}/${maxAttempts} after ${backoff}ms (${res.status})`);
      await sleep(backoff);
      continue;
    }
    throw lastErr; // non-retryable
  }
  throw lastErr;
}

export async function pickBestTitle(query, titles) {
  const API_KEY = requireKey();
  const numbered = titles.map((t, i) => `${i}. ${t}`).join('\n');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are a router for a live interview-assistance app.',
            'The "query" is a raw speech-to-text transcript from a live conversation. It may contain:',
            '- filler words ("um", "uh", "you know", "like"),',
            '- false starts, restated questions, or self-corrections,',
            '- side chatter or pleasantries before/after the actual question,',
            '- multiple questions — in that case focus on the MOST RECENT (last-asked) question.',
            'Your job: identify the underlying question being asked and pick the single best-matching title from the numbered list.',
            'Each title may contain multiple variants separated by " | " — treat them as equivalent phrasings of the same underlying question.',
            'If no title is a reasonable match, still return your closest guess.',
            'Return JSON: {"index": <number>}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Live transcript (may be noisy):\n"""\n${query}\n"""\n\nTitles:\n${numbered}\n\nReturn JSON with the best-matching index.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI chat failed: ${err}`);
  }
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  return parsed.index;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}
