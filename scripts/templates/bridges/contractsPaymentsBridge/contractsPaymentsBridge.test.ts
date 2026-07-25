import { describe, it, expect, vi } from 'vitest';
import { ContractsPaymentsBridge } from './contractsPaymentsBridge';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { id: 'p1', data: () => ({ amount: 500, status: 'pagato' }) },
      { id: 'p2', data: () => ({ amount: 300, status: 'in_attesa' }) }
    ]
  }),
  query: vi.fn(),
  where: vi.fn()
}));

describe('ContractsPaymentsBridge Unit Tests', () => {
  it('calculates contract payment totals correctly', async () => {
    const summary = await ContractsPaymentsBridge.getContractPaymentsSummary('contract_123');

    expect(summary.contractId).toBe('contract_123');
    expect(summary.totalPaid).toBe(500);
    expect(summary.totalPending).toBe(300);
    expect(summary.paymentsCount).toBe(2);
  });
});
