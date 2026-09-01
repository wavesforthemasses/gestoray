import { describe, it, expect } from 'vitest';
import { roundCurrency, calculateVatBreakdown } from './math';

describe('Centralized Mathematical & Financial Helpers (math.ts)', () => {
  describe('roundCurrency', () => {
    it('rounds standard positive numbers correctly', () => {
      expect(roundCurrency(10.555)).toBe(10.56);
      expect(roundCurrency(10.554)).toBe(10.55);
      expect(roundCurrency(10)).toBe(10);
      expect(roundCurrency(0)).toBe(0);
    });

    it('handles numeric string inputs safely', () => {
      expect(roundCurrency('1220.50')).toBe(1220.5);
      expect(roundCurrency('100.999')).toBe(101);
    });

    it('handles null, undefined and invalid inputs safely', () => {
      expect(roundCurrency(null)).toBe(0);
      expect(roundCurrency(undefined)).toBe(0);
      expect(roundCurrency('invalid_num')).toBe(0);
      expect(roundCurrency(NaN)).toBe(0);
    });

    it('supports custom decimal precision', () => {
      expect(roundCurrency(10.12345, 3)).toBe(10.123);
      expect(roundCurrency(10.12345, 4)).toBe(10.1235);
      expect(roundCurrency(10.12345, 0)).toBe(10);
    });
  });

  describe('calculateVatBreakdown', () => {
    it('calculates standard 22% VAT breakdown correctly', () => {
      const result = calculateVatBreakdown(1220, 22);
      expect(result.netAmount).toBe(1000);
      expect(result.vatAmount).toBe(220);
      expect(roundCurrency(result.netAmount + result.vatAmount)).toBe(1220);
    });

    it('calculates reduced 10% VAT breakdown correctly', () => {
      const result = calculateVatBreakdown(1100, 10);
      expect(result.netAmount).toBe(1000);
      expect(result.vatAmount).toBe(100);
      expect(roundCurrency(result.netAmount + result.vatAmount)).toBe(1100);
    });

    it('calculates super-reduced 4% VAT breakdown correctly', () => {
      const result = calculateVatBreakdown(104, 4);
      expect(result.netAmount).toBe(100);
      expect(result.vatAmount).toBe(4);
      expect(roundCurrency(result.netAmount + result.vatAmount)).toBe(104);
    });

    it('handles 0% VAT correctly', () => {
      const result = calculateVatBreakdown(500, 0);
      expect(result.netAmount).toBe(500);
      expect(result.vatAmount).toBe(0);
      expect(roundCurrency(result.netAmount + result.vatAmount)).toBe(500);
    });

    it('handles zero or null gross amounts gracefully', () => {
      expect(calculateVatBreakdown(0, 22)).toEqual({ netAmount: 0, vatAmount: 0 });
      expect(calculateVatBreakdown(null, 22)).toEqual({ netAmount: 0, vatAmount: 0 });
      expect(calculateVatBreakdown(undefined, 22)).toEqual({ netAmount: 0, vatAmount: 0 });
    });

    it('maintains the conservation of sum invariant across complex fractional amounts', () => {
      const complexAmounts = [960, 4282.2, 16500, 33.33, 199.99, 1499.5];
      const vatRates = [22, 10, 4, 0];

      for (const amount of complexAmounts) {
        for (const rate of vatRates) {
          const breakdown = calculateVatBreakdown(amount, rate);
          const reconstituted = roundCurrency(breakdown.netAmount + breakdown.vatAmount);
          expect(reconstituted).toBe(roundCurrency(amount));
        }
      }
    });
  });
});
