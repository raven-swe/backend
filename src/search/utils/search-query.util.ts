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
