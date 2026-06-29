/**
 * Helper to generate sequential search combinations of substrings of length >= 2
 * for Firestore search query indexing.
 */
export function generateSearchTerms(str: string): string[] {
  if (!str) return [];
  // Clean string and lower case
  const clean = str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length >= 2);
  const terms = new Set<string>();

  words.forEach(word => {
    // Generate consecutive sequential characters of length >= 2 within each word
    for (let i = 0; i < word.length; i++) {
      for (let j = i + 2; j <= word.length; j++) {
        terms.add(word.slice(i, j));
      }
    }
  });

  return Array.from(terms);
}
