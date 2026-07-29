import { describe, it, expect } from 'vitest';
import { calculateCommission } from '../../../functions/src/business-logic';

describe('Cloud Functions Centralized Business Logic Tests', () => {
  describe('calculateCommission', () => {
    it('calculates total commission correctly with single vendor', () => {
      const products = [
        { listPrice: 100, minPrice: 80, priceSold: 100, quantity: 2 }, // 200€
        { listPrice: 50, minPrice: 40, priceSold: 50, quantity: 1 }    // 50€
      ];
      const qualification = { percentage: 10, supervisorPercentage: 5 }; // 10%

      const result = calculateCommission(products, qualification);

      expect(result.total).toBe(25);      // 10% of 250€ = 25€
      expect(result.primary).toBe(25);    // 100% to primary
      expect(result.secondary).toBe(0);   // 0% to secondary
    });

    it('splits commission between primary and secondary sellers correctly', () => {
      const products = [
        { listPrice: 1000, minPrice: 800, priceSold: 1000, quantity: 1 } // 1000€
      ];
      const qualification = { percentage: 20, supervisorPercentage: 10 }; // 20% = 200€
      const secondVendorShare = 30; // 30% to secondary

      const result = calculateCommission(products, qualification, secondVendorShare);

      expect(result.total).toBe(200);
      expect(result.secondary).toBe(60);  // 30% of 200€ = 60€
      expect(result.primary).toBe(140);   // 70% of 200€ = 140€
    });

    it('handles null qualification gracefully', () => {
      const products = [{ listPrice: 100, minPrice: 80, priceSold: 100, quantity: 1 }];
      const result = calculateCommission(products, null);

      expect(result.total).toBe(0);
      expect(result.primary).toBe(0);
      expect(result.secondary).toBe(0);
    });
  });
});
