import { describe, it, expect, vi } from 'vitest';
import { ContractsService } from './contracts.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'contract_123' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn()
}));

vi.mock('$lib/services/cacheLookupService', () => ({
  CacheLookupService: {
    updateEntityCache: vi.fn().mockResolvedValue('chunk_0')
  }
}));

describe('ContractsService Unit Tests', () => {
  it('creates contract and updates cache', async () => {
    const id = await ContractsService.createContract({
      contractNumber: 'CTR-2026-001',
      title: 'Contratto Manutenzione Sede',
      clientId: 'client_1',
      clientName: 'Cliente Prova Srl',
      type: 'Ricorrente',
      totalAmount: 1200,

      billingFrequency: 'mensile',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'attivo'
    });

    expect(id).toBe('contract_123');
  });

  it('fetches contracts empty list without crashing', async () => {
    const list = await ContractsService.getContracts();
    expect(list).toEqual([]);
  });

  it('correctly calculates price with Minimo Fatturabile rule when quantity is below threshold', () => {
    const resUnder = ContractsService.calculateMinimoFatturabilePrice(
      15, // 15 mc < 20 mc
      350,
      { enabled: true, minQuantity: 20, flatPrice: 7000, displayText: 'Sotto i 20 mc 7000€' }
    );

    expect(resUnder.isMinimoApplied).toBe(true);
    expect(resUnder.totalAmount).toBe(7000);
    expect(resUnder.note).toBe('Sotto i 20 mc 7000€');

    const resOver = ContractsService.calculateMinimoFatturabilePrice(
      25, // 25 mc >= 20 mc
      350,
      { enabled: true, minQuantity: 20, flatPrice: 7000, displayText: 'Sotto i 20 mc 7000€' }
    );

    expect(resOver.isMinimoApplied).toBe(false);
    expect(resOver.totalAmount).toBe(25 * 350); // 8750
  });
});
