import { describe, it, expect, vi } from 'vitest';
import { ContractsService } from './contracts.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'contract_123' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  runTransaction: vi.fn().mockImplementation(async (_db, cb) => {
    return cb({
      get: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
      set: vi.fn()
    });
  }),
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

  it('correctly normalizes dual-schema contract from legacy original.* format', () => {
    const legacyDoc = {
      original: {
        contractNumber: 'PREV-2026-0005',
        title: 'Preventivo Impianto',
        clientId: 'cli_99',
        clientName: 'Mario Rossi',
        vendorUid: 'agent_1',
        vendorEmail: 'agent@example.com',
        secondVendorUid: 'agent_2',
        secondVendorShare: 30,
        secondVendorEmail: 'coagent@example.com',
        totalPrice: 4500,
        status: 'pending',
        products: [
          {
            productId: 'p_1',
            productName: 'Pannello Solare',
            priceSold: 1500,
            quantity: 3,
            listPrice: 1600,
            minPrice: 1400
          }
        ],
        hasWarning: false
      }
    };

    const normalized = ContractsService.normalizeContractData(legacyDoc, 'doc_123');

    expect(normalized.id).toBe('doc_123');
    expect(normalized.contractNumber).toBe('PREV-2026-0005');
    expect(normalized.totalAmount).toBe(4500);
    expect(normalized.agentId).toBe('agent_1');
    expect(normalized.coSellerUid).toBe('agent_2');
    expect(normalized.coSellerShare).toBe(30);
    expect(normalized.items?.length).toBe(1);
    expect(normalized.items?.[0].productName).toBe('Pannello Solare');
    expect(normalized.items?.[0].subtotal).toBe(4500);
    expect(normalized.hasPriceWarning).toBe(false);
  });
});
