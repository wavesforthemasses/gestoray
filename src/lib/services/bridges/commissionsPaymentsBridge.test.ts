import { describe, it, expect, vi } from 'vitest';
import { CommissionsPaymentsBridge } from './commissionsPaymentsBridge';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { id: 'c1', data: () => ({ commissionAmount: 1000, status: 'maturata' }) },
      { id: 'c2', data: () => ({ commissionAmount: 1500, status: 'liquidata' }) }
    ]
  }),
  query: vi.fn(),
  where: vi.fn()
}));

describe('CommissionsPaymentsBridge Unit Tests', () => {
  it('calculates agent payout summary correctly', async () => {
    const summary = await CommissionsPaymentsBridge.getAgentPayoutSummary('agent_99');

    expect(summary.agentUid).toBe('agent_99');
    expect(summary.totalCommissionsMatured).toBe(1000);
    expect(summary.totalCommissionsPaid).toBe(1500);
    expect(summary.pendingBalance).toBe(1000);
  });
});
