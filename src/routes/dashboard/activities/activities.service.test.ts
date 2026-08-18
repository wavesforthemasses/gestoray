import { describe, it, expect, vi } from 'vitest';
import { ActivitiesService } from './activities.service';
import { VersioningService } from '$lib/services/versioningService';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'act_123' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn()
}));

vi.mock('$lib/services/versioningService', () => ({
  VersioningService: {
    executeDualWriteTransaction: vi.fn().mockResolvedValue(undefined)
  },
  computeDiff: vi.fn().mockReturnValue({})
}));

vi.mock('$lib/services/cacheLookupService', () => ({
  CacheLookupService: {
    updateEntityCache: vi.fn().mockResolvedValue('chunk_0')
  }
}));

describe('ActivitiesService Unit Tests', () => {
  it('creates activity record with dual write versioning and target context', async () => {
    const author = { uid: 'user_1', displayName: 'Giuseppe Rossi' };
    const id = await ActivitiesService.createActivity({
      activityNumber: 'ACT-2026-001',
      title: 'Telefonata commerciale di follow-up',
      targetType: 'contact',
      targetId: 'cont_123',
      targetName: 'Mario Rossi',
      targetSubtext: 'mario@rossi.it',
      assignedUid: 'user_1',
      assignedName: 'Giuseppe Rossi',
      dueDate: '2026-07-30',
      durationMinutes: 45,
      priority: 'alta',
      status: 'da_fare'
    }, author);

    expect(id).toBeDefined();
    expect(VersioningService.executeDualWriteTransaction).toHaveBeenCalled();
  });

  it('rejects invalid targetType defensively', async () => {
    const author = { uid: 'user_1', displayName: 'Giuseppe Rossi' };
    await expect(
      ActivitiesService.createActivity({
        activityNumber: 'ACT-2026-002',
        title: 'Attività non valida',
        // @ts-ignore
        targetType: 'invalid_target_type',
        targetId: 'xyz',
        assignedUid: 'user_1',
        assignedName: 'Giuseppe Rossi',
        priority: 'media',
        status: 'da_fare'
      }, author)
    ).rejects.toThrow('TargetType non valido');
  });

  it('fetches empty activities list gracefully', async () => {
    const list = await ActivitiesService.getActivities();
    expect(list).toEqual([]);
  });
});
