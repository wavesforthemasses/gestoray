import { describe, it, expect, vi } from 'vitest';
import { ActivityTypesService, DEFAULT_ACTIVITY_TYPES } from './activityTypesService';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  orderBy: vi.fn()
}));

vi.mock('$lib/auth.svelte', () => ({
  activeRoleState: { role: 'commerciale' }
}));

describe('ActivityTypesService', () => {
  it('returns DEFAULT_ACTIVITY_TYPES when Firestore collection is empty', async () => {
    const types = await ActivityTypesService.getActivityTypes();
    expect(types).toHaveLength(DEFAULT_ACTIVITY_TYPES.length);
    expect(types[0].code).toBe('TEL');
    expect(types[1].code).toBe('VIS');
    expect(types[0].allowedTargets).toContain('contact');
  });

  it('correctly evaluates assignment permissions based on role', () => {
    expect(ActivityTypesService.canAssignToOthers('superadmin')).toBe(true);
    expect(ActivityTypesService.canAssignToOthers('amministrazione')).toBe(true);
    expect(ActivityTypesService.canAssignToOthers('commerciale')).toBe(false);
  });
});
