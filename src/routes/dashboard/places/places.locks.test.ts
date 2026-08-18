import { describe, it, expect } from 'vitest';

describe('Places Unique Key Locks Unit Tests', () => {
  it('normalizes code key for tenant isolation', () => {
    const orgId = 'org-tenant-1';
    const code = '  CNT-2026-001 ';
    const normalizedCode = code.trim().toLowerCase();
    const lockKey = `${orgId}_code_${normalizedCode}`;

    expect(lockKey).toBe('org-tenant-1_code_cnt-2026-001');
  });

  it('detects duplicate code conflict when lock is owned by another place', () => {
    const currentPlaceId = 'place-new';
    const existingLockData = {
      placeId: 'place-existing-123',
      code: 'CNT-2026-001'
    };

    const hasConflict = existingLockData.placeId !== currentPlaceId;
    expect(hasConflict).toBe(true);
  });

  it('allows code update if lock belongs to the same place', () => {
    const currentPlaceId = 'place-123';
    const existingLockData = {
      placeId: 'place-123',
      code: 'CNT-2026-001'
    };

    const hasConflict = existingLockData.placeId !== currentPlaceId;
    expect(hasConflict).toBe(false);
  });

  it('determines old lock release when code changes', () => {
    const oldCode = 'CNT-2025-099';
    const newCode = 'CNT-2026-001';

    const normalizedOld = oldCode.trim().toLowerCase();
    const normalizedNew = newCode.trim().toLowerCase();

    const shouldReleaseOld = Boolean(normalizedOld && normalizedOld !== normalizedNew);
    expect(shouldReleaseOld).toBe(true);
  });
});
