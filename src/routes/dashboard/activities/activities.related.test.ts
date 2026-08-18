import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivitiesService } from './activities.service';
import { ActivitiesBridgeOrchestrator } from './activities.orchestrator';
import { getDocs } from '$lib/firebase';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'act_new' }),
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

describe('ActivitiesService.getRelatedActivities & Bridge Dynamic URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches related activities, excludes current activity and computes sameDay in-memory', async () => {
    const mockDocs = [
      {
        id: 'act_curr',
        data: () => ({
          title: 'Sopralluogo Impianto A',
          targetId: 'place_123',
          executionDate: '2026-08-20'
        })
      },
      {
        id: 'act_same_day',
        data: () => ({
          title: 'Manutenzione Filtri A',
          targetId: 'place_123',
          executionDate: '2026-08-20',
          status: 'da_fare'
        })
      },
      {
        id: 'act_other_day',
        data: () => ({
          title: 'Collaudo Finale',
          targetId: 'place_123',
          executionDate: '2026-08-25',
          status: 'completata'
        })
      },
      {
        id: 'act_deleted',
        data: () => ({
          title: 'Attività Cancellata',
          targetId: 'place_123',
          executionDate: '2026-08-20',
          derived: { deleted: true }
        })
      }
    ];

    (getDocs as any).mockResolvedValueOnce({
      docs: mockDocs
    });

    const res = await ActivitiesService.getRelatedActivities({
      currentActivityId: 'act_curr',
      targetId: 'place_123',
      targetType: 'place',
      executionDate: '2026-08-20',
      tenantId: 'tenant_abc'
    });

    // act_curr and act_deleted should be excluded
    expect(res.sameTarget).toHaveLength(2);
    expect(res.sameTarget.map(a => a.id)).toEqual(['act_other_day', 'act_same_day']);

    // act_same_day is on same day
    expect(res.sameDayOnTarget).toHaveLength(1);
    expect(res.sameDayOnTarget[0].id).toBe('act_same_day');
  });

  it('handles target resolution with fallback when module bridge is not available', async () => {
    const summary = await ActivitiesBridgeOrchestrator.resolveTargetSummary(
      'vehicle',
      'veh_999',
      'Furgone Iveco',
      'tenant_abc',
      [] // No active modules
    );

    expect(summary.id).toBe('veh_999');
    expect(summary.name).toBe('Furgone Iveco');
    expect(summary.isModuleDisabled).toBe(true);
    expect(summary.url).toBeUndefined();
  });
});
