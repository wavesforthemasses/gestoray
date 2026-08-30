import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketsService } from './tickets.service';
import { TicketsKPIBridge } from './tickets.kpi.bridge';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-ticket-id' }),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((q, cb) => {
    cb({ docs: [] });
    return () => {};
  })
}));

vi.mock('$lib/services/ticketSettings', () => ({
  TicketSettingsService: {
    getSettings: vi.fn().mockResolvedValue({}),
    generateNextCode: vi.fn().mockResolvedValue('TICK-2026-001')
  }
}));

describe('TicketsService & TicketsKPIBridge', () => {
  it('TicketsService.getTickets dovrebbe recuperare array di ticket', async () => {
    const list = await TicketsService.getTickets(true);
    expect(Array.isArray(list)).toBe(true);
  });

  it('TicketsKPIBridge.calculateKPIs calcola correttamente ticket aperti e TMR', () => {
    const mockTickets = [
      {
        id: 't1',
        status: 'aperto',
        priority: 'alta',
        createdAt: '2026-08-01T08:00:00Z',
        closedAt: null
      },
      {
        id: 't2',
        status: 'in_lavorazione',
        priority: 'urgente',
        createdAt: '2026-08-01T09:00:00Z',
        closedAt: null
      },
      {
        id: 't3',
        status: 'risolto',
        priority: 'media',
        resolutionTimeHours: 4,
        createdAt: '2026-08-01T10:00:00Z',
        closedAt: '2026-08-01T14:00:00Z'
      }
    ];

    const kpis = TicketsKPIBridge.calculateKPIs(mockTickets);
    expect(kpis.ticket_aperti).toBe(2);
    expect(kpis.ticketsCount).toBe(3);
    expect(kpis.tmr).toBe(4);
  });
});
