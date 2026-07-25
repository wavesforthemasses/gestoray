import { describe, it, expect, vi } from 'vitest';
import { ContractsInterventiBridge } from './contractsInterventiBridge';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      {
        id: 'int_1',
        data: () => ({ title: 'Intervento 1', estimatedHours: 2, scheduledStartAt: '2026-07-20T09:00:00Z' })
      },
      {
        id: 'int_2',
        data: () => ({ title: 'Intervento 2', estimatedHours: 3, scheduledStartAt: '2026-07-22T09:00:00Z' })
      }
    ]
  }),
  query: vi.fn(),
  where: vi.fn()
}));

describe('ContractsInterventiBridge Unit Tests', () => {
  it('calculates total contract hours spent from interventions', async () => {
    const summary = await ContractsInterventiBridge.getContractHoursSummary('contract_123');

    expect(summary.contractId).toBe('contract_123');
    expect(summary.totalInterventions).toBe(2);
    expect(summary.totalHoursSpent).toBe(5);
  });
});
