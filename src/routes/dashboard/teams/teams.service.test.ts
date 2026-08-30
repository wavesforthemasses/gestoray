import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamsService } from './teams.service';

const mockTransaction = {
  get: vi.fn(),
  update: vi.fn()
};

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
  where: vi.fn(),
  runTransaction: vi.fn((db, cb) => cb(mockTransaction))
}));

vi.mock('./teamSettingsService', () => ({
  TeamSettingsService: {
    generateNextCode: vi.fn().mockResolvedValue({ code: 'SQD-2026-001', updatedSettings: {} }),
    saveSettings: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('TeamsService', () => {
  it('dovrebbe recuperare la lista delle squadre', async () => {
    const list = await TeamsService.getTeams();
    expect(Array.isArray(list)).toBe(true);
  });

  it('dovrebbe filtrare le squadre per utente', async () => {
    vi.spyOn(TeamsService, 'getTeams').mockResolvedValue([
      {
        id: 'team_1',
        code: 'SQD-001',
        name: 'Squadra Alfa',
        status: 'attiva',
        createdAt: '2026-01-01',
        members: [{ userId: 'user_mario', userName: 'Mario Rossi' }]
      },
      {
        id: 'team_2',
        code: 'SQD-002',
        name: 'Squadra Beta',
        status: 'attiva',
        createdAt: '2026-01-01',
        members: [{ userId: 'user_luigi', userName: 'Luigi Verdi' }]
      }
    ]);

    const userTeams = await TeamsService.getTeamsForUser('user_mario');
    expect(userTeams.length).toBe(1);
    expect(userTeams[0].id).toBe('team_1');
  });

  it('dovrebbe gestire la riassegnazione atomica di un membro', async () => {
    mockTransaction.get.mockImplementation((docRef) => {
      return Promise.resolve({
        exists: () => true,
        data: () => ({
          id: 'team_dst',
          members: []
        })
      });
    });

    await TeamsService.reassignMember(
      { userId: 'user_1', userName: 'Mario' },
      null,
      'team_dst'
    );

    expect(mockTransaction.update).toHaveBeenCalled();
  });
});
