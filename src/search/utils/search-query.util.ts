/**
 * Prepares a search query for full-text search by cleaning and formatting it.
 * Removes special characters, converts to lowercase, and formats for search.
 *
 * @param query - The raw search query input.
 * @returns The formatted search query string suitable for full-text search.
 */
export function prepareSearchQuery(query: string): string {
  const cleaned = query
    .trim()
    .toLowerCase()
    .replace(/[#]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  if (!cleaned) return '';

  const words = cleaned
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => `${word}:*`);

  return words.join(' | ');
}

/**
 * Check if query is a single hashtag search
 */
export function isSingleHashtagQuery(query: string): boolean {
  const trimmed = query.trim();
  // Check if it starts with # and has no spaces (single hashtag)
  return trimmed.startsWith('#') && !trimmed.includes(' ');
}

/**
 * Extract hashtag from query (removes the #)
 */
export function extractHashtag(query: string): string {
  return query.trim().replace(/^#/, '').toLowerCase();
}
