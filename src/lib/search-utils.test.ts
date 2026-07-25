import { describe, it, expect } from 'vitest';
import { generateSearchTerms, generateSearchKeywords } from './search-utils';

describe('Clean Sequential Word-Position Phrase Prefix Algorithm', () => {
  it('should generate exact sequential prefixes for "Mario Rossi Srl"', () => {
    const terms = generateSearchKeywords('Mario Rossi Srl');

    // Starting at Word 0 ("mario rossi srl"):
    expect(terms).toContain('ma');
    expect(terms).toContain('mar');
    expect(terms).toContain('mari');
    expect(terms).toContain('mario');
    expect(terms).toContain('mario r');
    expect(terms).toContain('mario ro');
    expect(terms).toContain('mario ros');
    expect(terms).toContain('mario ross');
    expect(terms).toContain('mario rossi');
    expect(terms).toContain('mario rossi s');
    expect(terms).toContain('mario rossi sr');
    expect(terms).toContain('mario rossi srl');

    // Starting at Word 1 ("rossi srl"):
    expect(terms).toContain('ro');
    expect(terms).toContain('ros');
    expect(terms).toContain('ross');
    expect(terms).toContain('rossi');
    expect(terms).toContain('rossi s');
    expect(terms).toContain('rossi sr');
    expect(terms).toContain('rossi srl');

    // Starting at Word 2 ("srl"):
    expect(terms).toContain('sr');
    expect(terms).toContain('srl');

    // Internal substrings (like "ari" or "rio" or "oss") must NOT exist
    expect(terms).not.toContain('ari');
    expect(terms).not.toContain('rio');
    expect(terms).not.toContain('oss');
    expect(terms).not.toContain('ssi');

    // 1-char tokens must NOT exist
    expect(terms).not.toContain('m');
    expect(terms).not.toContain('r');
    expect(terms).not.toContain('s');
  });

  it('should work via generateSearchTerms with multiple fields', () => {
    const terms = generateSearchTerms('Mario Rossi', 'IT12345678901');

    expect(terms).toContain('mario');
    expect(terms).toContain('rossi');
    expect(terms).toContain('it12345678901');
    expect(terms).toContain('mario rossi');
    expect(terms).toContain('rossi it12345678901');
  });
});
