import { describe, it, expect } from 'vitest';
import { generateSearchTerms } from '$lib/search-utils';

describe('Clients Service & Anagrafica Logic', () => {
  it('should generate multi-word search index terms for client full names (nome + cognome)', () => {
    const fullClientName = 'Mario Rossi2';
    const terms = generateSearchTerms(fullClientName);

    // Word 0 ("mario rossi2")
    expect(terms).toContain('ma');
    expect(terms).toContain('mario');
    expect(terms).toContain('mario r');
    expect(terms).toContain('mario rossi2');

    // Word 1 ("rossi2")
    expect(terms).toContain('ro');
    expect(terms).toContain('rossi2');
  });

  it('should generate multi-word search index terms for ragione sociale', () => {
    const terms = generateSearchTerms('Azienda Rossi Srl', 'IT12345678901');

    expect(terms).toContain('azienda');
    expect(terms).toContain('azienda r');
    expect(terms).toContain('azienda rossi');
    expect(terms).toContain('azienda rossi srl');

    expect(terms).toContain('rossi');
    expect(terms).toContain('rossi srl');

    expect(terms).toContain('it12345678901');
  });
});
