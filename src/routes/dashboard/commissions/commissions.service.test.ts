import { describe, it, expect, vi } from 'vitest';
import { CommissionsService } from './commissions.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'comm_123' }),
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

describe('CommissionsService Unit Tests', () => {
  it('creates commission record and updates cache', async () => {
    const id = await CommissionsService.createCommission({
      commissionNumber: 'PRV-2026-001',
      agentUid: 'user_agent_1',
      agentName: 'Mario Rossi',
      dealTitle: 'Vendita Impianto Clima Sede',
      dealAmount: 10000,
      commissionRate: 10,
      commissionAmount: 1000,
      earnedDate: '2026-07-25',
      status: 'maturata'
    });

    expect(id).toBe('comm_123');
  });

  it('fetches empty commissions list without crashing', async () => {
    const list = await CommissionsService.getCommissions();
    expect(list).toEqual([]);
  });
});
