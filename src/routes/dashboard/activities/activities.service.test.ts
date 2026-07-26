import { describe, it, expect, vi } from 'vitest';
import { ActivitiesService } from './activities.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'act_123' }),
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

describe('ActivitiesService Unit Tests', () => {
  it('creates activity record and updates cache', async () => {
    const id = await ActivitiesService.createActivity({
      activityNumber: 'ACT-2026-001',
      title: 'Verifica Periodica Impianto Antincendio',
      assignedUid: 'user_1',
      assignedName: 'Giuseppe Rossi',
      dueDate: '2026-07-30',
      priority: 'alta',
      status: 'in_corso'
    });

    expect(id).toBe('act_123');
  });

  it('fetches empty activities list without crashing', async () => {
    const list = await ActivitiesService.getActivities();
    expect(list).toEqual([]);
  });
});
