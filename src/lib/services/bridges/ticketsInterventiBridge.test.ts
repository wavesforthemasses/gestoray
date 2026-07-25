import { describe, it, expect, vi } from 'vitest';
import { TicketsInterventiBridge } from './ticketsInterventiBridge';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { id: 'int_t1', data: () => ({ title: 'Riparazione Guasto', status: 'completato' }) }
    ]
  }),
  query: vi.fn(),
  where: vi.fn()
}));

describe('TicketsInterventiBridge Unit Tests', () => {
  it('summarizes ticket interventions correctly', async () => {
    const summary = await TicketsInterventiBridge.getTicketInterventionsSummary('ticket_888');

    expect(summary.ticketId).toBe('ticket_888');
    expect(summary.interventionsCount).toBe(1);
    expect(summary.completedInterventions).toBe(1);
  });
});
