import { describe, it, expect } from 'vitest';
import { formatAddress, formatCurrency, formatDate, formatDateTime, safeNumber, formatNumber } from './formatters';

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
    expect(formatCurrency(null)).toMatch(/€\s*0[,.]00/);
    expect(formatCurrency(undefined)).toMatch(/€\s*0[,.]00/);
    expect(formatCurrency('50.5')).toMatch(/€\s*50[,.]50/);
  });
});

describe('safeNumber & formatNumber', () => {
  it('safeNumber should parse numbers and strings safely with fallback', () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber('42.5')).toBe(42.5);
    expect(safeNumber('42,5')).toBe(42.5);
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined, 10)).toBe(10);
    expect(safeNumber(NaN, 5)).toBe(5);
    expect(safeNumber('invalid', 99)).toBe(99);
  });

  it('formatNumber should format decimals safely', () => {
    expect(formatNumber(42)).toBe('42.00');
    expect(formatNumber(42.5678, 3)).toBe('42.568');
    expect(formatNumber(null)).toBe('0.00');
    expect(formatNumber(undefined)).toBe('0.00');
    expect(formatNumber('invalid', 2, '-')).toBe('-');
  });
});

