import { describe, it, expect, vi } from 'vitest';
import { SchedulingService } from './scheduling.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'sch_123' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  runTransaction: vi.fn().mockImplementation(async (db, cb) => {
    return cb({
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      set: vi.fn()
    });
  })
}));

describe('SchedulingService Unit Tests', () => {
  it('should fetch composite schedule without errors', async () => {
    const res = await SchedulingService.getCompositeSchedule();
    expect(res).toBeDefined();
    expect(Array.isArray(res.items)).toBe(true);
    expect(Array.isArray(res.backlog)).toBe(true);
  });
});
