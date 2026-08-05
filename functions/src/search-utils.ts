/**
 * Centralized Search Utility for the application Cloud Functions.
 * Generates phrase prefixes starting from EVERY word position to the end of the phrase.
 * Example: "Mario Rossi Srl"
 *  - Word 0 ("mario rossi srl"): "ma", "mar", "mari", "mario", "mario r", ..., "mario rossi srl"
 *  - Word 1 ("rossi srl"): "ro", "ros", "ross", "rossi", "rossi s", ..., "rossi srl"
 *  - Word 2 ("srl"): "sr", "srl"
 */
export function generateSearchKeywords(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const keywords = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    const subPhrase = words.slice(i).join(' ');
    let currentPrefix = '';
    for (let j = 0; j < subPhrase.length; j++) {
      currentPrefix += subPhrase[j];
      const trimmed = currentPrefix.trim();
      if (trimmed.length >= 2) {
        keywords.add(trimmed);
      }
    }
  }

  return Array.from(keywords);
}

/**
 * Main entry point accepting multiple inputs (name, VAT, fiscal code, email, etc.)
 */
export function generateSearchTerms(...inputs: (string | undefined | null)[]): string[] {
  const validInputs = inputs.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  if (validInputs.length === 0) return [];

  const combinedStr = validInputs.join(' ');
  return generateSearchKeywords(combinedStr);
}
