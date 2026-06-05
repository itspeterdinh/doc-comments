const API_KEY = import.meta.env.VITE_JSONBIN_API_KEY;
const BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID;
const BASE = 'https://api.jsonbin.io/v3';

export async function loadFromCloud() {
  if (!BIN_ID) return null;
  const res = await fetch(`${BASE}/b/${BIN_ID}/latest`, {
    headers: { 'X-Master-Key': API_KEY },
  });
  if (!res.ok) throw new Error('Failed to load from JSONBin');
  const json = await res.json();
  return json.record; // full array of annotations
}

export async function saveToCloud(annotations) {
  if (!BIN_ID) {
    const res = await fetch(`${BASE}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Name': 'doc-comments',
      },
      body: JSON.stringify(annotations),
    });
    if (!res.ok) throw new Error('Failed to create JSONBin');
    const json = await res.json();
    console.warn(
      `JSONBin created! Add to .env:\nVITE_JSONBIN_BIN_ID=${json.metadata.id}`,
    );
    return;
  }

  const res = await fetch(`${BASE}/b/${BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
    },
    body: JSON.stringify(annotations),
  });
  if (!res.ok) throw new Error('Failed to save to JSONBin');
}
