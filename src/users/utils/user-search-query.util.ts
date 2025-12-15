export function buildTsQuery(query: string): { tsQuery: string; firstWord: string } {
  const cleaned = query.toLowerCase().trim();
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0)
    // only allow underscores, numbers and letters and delete if empty
    .map((w) => w.replace(/[^a-z0-9_]/g, ''))
    .filter((w) => w.length > 0);

  if (words.length === 0) return { tsQuery: '', firstWord: '' };

  const tsQuery = words.map((word) => `${word}:*`).join(' & ');
  return { tsQuery, firstWord: words[0] };
}
