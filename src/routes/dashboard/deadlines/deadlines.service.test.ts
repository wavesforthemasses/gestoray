import { describe, it, expect, vi } from 'vitest';
import { DeadlinesService } from './deadlines.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  addDoc: vi.fn().mockResolvedValue({ id: 'ddl_123' }),
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

describe('DeadlinesService Unit Tests', () => {
  it('should fetch empty deadlines array when collection is empty', async () => {
    const list = await DeadlinesService.getDeadlines();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });
});
