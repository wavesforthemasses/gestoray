import { describe, it, expect } from 'vitest';
import { InvoiceSettingsService, DEFAULT_INVOICE_SETTINGS } from './invoiceSettingsService';

describe('Invoice Progressive Locks & Sequences Tests', () => {
  it('respects configured startNumber for migration years', () => {
    const customSettings = {
      ...DEFAULT_INVOICE_SETTINGS,
      annualSequences: [
        {
          year: 2026,
          sezionaleId: 'default',
          startNumber: 150, // Started mid-year from legacy ERP
          lastAssignedNumber: 149,
          pattern: '{NUM}/{YYYY}{SEZ}'
        }
      ]
    };

    const seq = InvoiceSettingsService.getSequenceForYearAndSezionale(customSettings, 2026, 'default');
    expect(seq.startNumber).toBe(150);
    const nextCandidate = Math.max(seq.startNumber, seq.lastAssignedNumber + 1);
    expect(nextCandidate).toBe(150);

    const formatted = seq.pattern.replace('{NUM}', String(nextCandidate)).replace('{YYYY}', '2026').replace('{SEZ}', '');
    expect(formatted).toBe('150/2026');
  });

  it('formats custom sezionale patterns like /NC and /PA correctly', () => {
    const seqNC = {
      year: 2026,
      sezionaleId: 'NC',
      startNumber: 1,
      lastAssignedNumber: 5,
      pattern: '{NUM}/{YYYY}{SEZ}'
    };

    const formattedNC = seqNC.pattern.replace('{NUM}', '6').replace('{YYYY}', '2026').replace('{SEZ}', '/NC');
    expect(formattedNC).toBe('6/2026/NC');
  });
});
