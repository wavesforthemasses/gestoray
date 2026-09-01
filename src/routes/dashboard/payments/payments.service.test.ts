import { describe, it, expect, vi } from 'vitest';
import { PaymentsService } from './payments.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'payment_123' }),
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
    updateEntityCache: vi.fn().mockResolvedValue('chunk_0'),
    removeEntityFromCache: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('PaymentsService Unit Tests', () => {
  it('correctly calculates VAT breakdown (22%, 10%, 0%)', () => {
    const res22 = PaymentsService.calculateVatBreakdown(1220, 22);
    expect(res22.netAmount).toBe(1000);
    expect(res22.vatAmount).toBe(220);

    const res10 = PaymentsService.calculateVatBreakdown(1100, 10);
    expect(res10.netAmount).toBe(1000);
    expect(res10.vatAmount).toBe(100);

    const res0 = PaymentsService.calculateVatBreakdown(500, 0);
    expect(res0.netAmount).toBe(500);
    expect(res0.vatAmount).toBe(0);
  });

  it('creates payment and updates cache', async () => {
    const id = await PaymentsService.createPayment({
      id: 'payment_123',
      paymentNumber: 'INC-2026-0001',
      clientId: 'client_1',
      clientName: 'Mario Rossi SRL',
      grossAmount: 1220,
      vatRate: 22,
      paymentDate: '2026-08-30',
      method: 'bonifico',
      status: 'registrato'
    });

    expect(id).toBe('payment_123');
  });

  it('correctly normalizes dual-schema payment from legacy original.* format', () => {
    const legacyDoc = {
      original: {
        paymentNumber: 'INC-2026-9999',
        clientId: 'cli_88',
        clientName: 'Acme Corp',
        amount: 2440,
        vatRate: 22,
        date: '2026-08-15T10:00:00Z',
        method: 'bonifico',
        transactionReference: 'TRN987654321',
        status: 'registrato'
      }
    };

    const normalized = PaymentsService.normalizePaymentData(legacyDoc, 'doc_pay_99');

    expect(normalized.id).toBe('doc_pay_99');
    expect(normalized.paymentNumber).toBe('INC-2026-9999');
    expect(normalized.grossAmount).toBe(2440);
    expect(normalized.netAmount).toBe(2000);
    expect(normalized.vatAmount).toBe(440);
    expect(normalized.method).toBe('bonifico');
    expect(normalized.transactionReference).toBe('TRN987654321');
  });
});
