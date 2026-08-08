import { describe, it, expect, vi } from 'vitest';
import { TeamsService } from './teams.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-team-id' }),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn()
}));

describe('TeamsService', () => {
  it('dovrebbe recuperare la lista delle squadre', async () => {
    const list = await TeamsService.getTeams();
    expect(Array.isArray(list)).toBe(true);
  });
});
