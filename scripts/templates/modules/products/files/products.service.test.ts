import { describe, it, expect, vi } from 'vitest';
import { ProductsService } from './products.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'prod_123' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  orderBy: vi.fn()
}));

vi.mock('$lib/services/cacheLookupService', () => ({
  CacheLookupService: {
    updateEntityCache: vi.fn().mockResolvedValue('chunk_0')
  }
}));

describe('ProductsService Unit Tests', () => {
  it('creates product record and updates cache', async () => {
    const id = await ProductsService.createProduct({
      sku: 'ART-001',
      name: 'Filtro Aria Clima R32',
      category: 'Ricambi',
      price: 25.50,
      unit: 'pz',
      stockQty: 50
    });

    expect(id).toBe('prod_123');
  });

  it('fetches empty products list without crashing', async () => {
    const list = await ProductsService.getProducts();
    expect(list).toEqual([]);
  });
});
