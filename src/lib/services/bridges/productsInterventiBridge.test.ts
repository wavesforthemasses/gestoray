import { describe, it, expect, vi } from 'vitest';
import { ProductsInterventiBridge } from './productsInterventiBridge';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { 
        id: 'int_p1', 
        data: () => ({ 
          items: [
            { productId: 'prod_99', quantity: 3, price: 25.00 }
          ] 
        }) 
      }
    ]
  }),
  query: vi.fn()
}));

describe('ProductsInterventiBridge Unit Tests', () => {
  it('calculates product usage summary in interventions correctly', async () => {
    const summary = await ProductsInterventiBridge.getProductUsageSummary('prod_99');

    expect(summary.productId).toBe('prod_99');
    expect(summary.totalQuantityUsed).toBe(3);
    expect(summary.totalMaterialCost).toBe(75.00);
    expect(summary.interventionsCount).toBe(1);
  });
});
