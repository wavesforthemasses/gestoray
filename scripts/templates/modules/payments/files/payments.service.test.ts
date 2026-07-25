import { describe, it, expect, vi } from 'vitest';
import { PaymentsService } from './payments.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'payment_123' }),
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

describe('PaymentsService Unit Tests', () => {
  it('creates payment record and updates cache', async () => {
    const id = await PaymentsService.createPayment({
      paymentNumber: 'PAG-2026-001',
      clientId: 'client_1',
      clientName: 'Cliente Prova Srl',
      amount: 450.00,
      paymentDate: '2026-07-25',
      method: 'bonifico',
      status: 'pagato'
    });

    expect(id).toBe('payment_123');
  });

  it('fetches empty payments list without crashing', async () => {
    const list = await PaymentsService.getPayments();
    expect(list).toEqual([]);
  });
});
