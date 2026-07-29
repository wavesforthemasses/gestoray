import { describe, it, expect } from 'vitest';

export function dateToInt(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  return y * 10000 + m * 100 + d;
}

describe('dateToInt Helper Unit Tests', () => {
  it('converts standard ISO date string YYYY-MM-DD to integer YYYYMMDD', () => {
    expect(dateToInt('2026-07-28')).toBe(20260728);
    expect(dateToInt('2025-12-31')).toBe(20251231);
    expect(dateToInt('2024-01-01')).toBe(20240101);
  });

  it('converts ISO timestamp string starting with YYYY-MM-DD', () => {
    expect(dateToInt('2026-07-28T14:30:00.000Z')).toBe(20260728);
  });

  it('returns null for null, undefined, or empty values', () => {
    expect(dateToInt(null)).toBeNull();
    expect(dateToInt(undefined)).toBeNull();
    expect(dateToInt('')).toBeNull();
    expect(dateToInt('invalid-date')).toBeNull();
  });

  it('enables direct mathematical range comparisons', () => {
    const july28 = dateToInt('2026-07-28')!;
    const august01 = dateToInt('2026-08-01')!;
    expect(july28 < august01).toBe(true);

    const year = Math.floor(july28 / 10000);
    const month = Math.floor((july28 % 10000) / 100);
    const day = july28 % 100;

    expect(year).toBe(2026);
    expect(month).toBe(7);
    expect(day).toBe(28);
  });
});
