import { describe, it, expect } from 'vitest';
import { formatAddress, formatCurrency, formatDate, formatDateTime } from './formatters';

describe('formatAddress', () => {
  it('should return empty string for null or undefined', () => {
    expect(formatAddress(null)).toBe('');
    expect(formatAddress(undefined)).toBe('');
    expect(formatAddress('')).toBe('');
  });

  it('should return trimmed string when passed a string', () => {
    expect(formatAddress('Via Roma 10, Milano')).toBe('Via Roma 10, Milano');
    expect(formatAddress('  Corso Italia 5  ')).toBe('Corso Italia 5');
  });

  it('should format structured address object cleanly without [object Object]', () => {
    const addressObj = {
      street: 'Via Garibaldi 12',
      zip: '20100',
      city: 'Milano',
      province: 'MI'
    };
    expect(formatAddress(addressObj)).toBe('Via Garibaldi 12, 20100 Milano, (MI)');
  });

  it('should handle partial address object', () => {
    expect(formatAddress({ street: 'Via Dante 1' })).toBe('Via Dante 1');
    expect(formatAddress({ city: 'Roma', province: 'RM' })).toBe('Roma, (RM)');
    expect(formatAddress({ zip: '00100', city: 'Roma' })).toBe('00100 Roma');
  });
});

describe('formatCurrency', () => {
  it('should format numbers into EUR currency strings', () => {
    expect(formatCurrency(100)).toMatch(/€\s*100[,.]00/);
    expect(formatCurrency(1234.56)).toMatch(/€\s*1[.,]?234[,.]56/);
    expect(formatCurrency(0)).toMatch(/€\s*0[,.]00/);
  });
});
