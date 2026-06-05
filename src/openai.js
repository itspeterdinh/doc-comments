const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 256; // smaller = cheaper storage, still high quality

export async function embed(text) {
  if (!API_KEY || API_KEY === 'your_openai_key_here') {
    throw new Error('OpenAI API key not configured');
  }
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embed failed: ${err}`);
  }
  const json = await res.json();
  return json.data[0].embedding;
}

export async function pickBestTitle(query, titles) {
  if (!API_KEY || API_KEY === 'your_openai_key_here') {
    throw new Error('OpenAI API key not configured');
  }
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
          content:
            'You are a router. Given a user query and a numbered list of titles, pick the single title that best matches the intent of the query. Return JSON: {"index": <number>}.',
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nTitles:\n${numbered}\n\nReturn JSON with the best-matching index.`,
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
