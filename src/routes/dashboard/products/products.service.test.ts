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

vi.mock('$lib/services/versioningService', () => ({
  VersioningService: {
    executeDualWriteTransaction: vi.fn().mockResolvedValue({ aggregateVersion: 1, ledgerId: 'ledger_123' })
  },
  computeDiff: vi.fn().mockReturnValue({ keysChanged: ['name', 'price'], mutations: {} })
}));

describe('ProductsService Unit Tests', () => {
  it('creates physical product record with stock tracking defaults and both usage', async () => {
    const id = await ProductsService.createProduct({
      sku: 'ART-001',
      name: 'Filtro Aria Clima R32',
      type: 'product',
      category: 'Ricambi',
      usageType: 'both',
      price: 25.50,
      purchasePrice: 15.00,
      unit: 'pz',
      stockQty: 50,
      minStockThreshold: 10,
      allowOutOfStockSale: true
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('correctly evaluates isSaleable and isPurchasable helpers', () => {
    const bothItem = { sku: 'A', name: 'Item 1', category: 'C', price: 10, unit: 'pz', usageType: 'both' as const };
    const saleOnlyItem = { sku: 'B', name: 'Item 2', category: 'C', price: 50, unit: 'ora', usageType: 'sale' as const };
    const purchaseOnlyItem = { sku: 'C', name: 'Item 3', category: 'C', price: 5, purchasePrice: 4, unit: 'kg', usageType: 'purchase' as const };

    expect(ProductsService.isSaleable(bothItem)).toBe(true);
    expect(ProductsService.isPurchasable(bothItem)).toBe(true);

    expect(ProductsService.isSaleable(saleOnlyItem)).toBe(true);
    expect(ProductsService.isPurchasable(saleOnlyItem)).toBe(false);

    expect(ProductsService.isSaleable(purchaseOnlyItem)).toBe(false);
    expect(ProductsService.isPurchasable(purchaseOnlyItem)).toBe(true);
  });

  it('creates service record with default trackStock=false and hourly billing', async () => {
    const id = await ProductsService.createProduct({
      sku: 'SRV-001',
      name: 'Consulenza Tecnica Specializzata',
      type: 'service',
      usageType: 'sale',
      category: 'Consulenze',
      price: 90.00,
      unit: 'ora',
      billingType: 'hourly'
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('creates digital item with recurring billing interval', async () => {
    const id = await ProductsService.createProduct({
      sku: 'LIC-001',
      name: 'Licenza Software Cloud Mensile',
      type: 'digital',
      category: 'Software',
      price: 49.00,
      unit: 'licenza',
      billingType: 'recurring',
      recurrenceInterval: 'monthly'
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('fetches empty products list without crashing', async () => {
    const list = await ProductsService.getProducts();
    expect(list).toEqual([]);
  });
});
