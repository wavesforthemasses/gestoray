import { describe, it, expect } from 'vitest';
import { syncActivityAssignees, buildUserFilterTargets, chunkArray } from './activityAssigneeUtils';
import type { ActivityItem } from './schema';

describe('activityAssigneeUtils - Zero Static Expansion & Monodirectional Sync', () => {
  it('correctly maps assignedEntities to assigneeFilterKeys and legacy scalar fields', () => {
    const rawActivity: Partial<ActivityItem> = {
      title: 'Manutenzione Cantiere',
      assignedEntities: [
        { entityType: 'user', entityId: 'usr_mario', entityName: 'Mario Rossi' },
        { entityType: 'team', entityId: 'team_alfa', entityName: 'Squadra Alfa' },
        { entityType: 'vehicle', entityId: 'veh_daily', entityName: 'Iveco Daily' }
      ]
    };

    const synced = syncActivityAssignees(rawActivity);

    // Filter keys MUST have normalized prefixes and NO member expansion
    expect(synced.assigneeFilterKeys).toEqual(['user:usr_mario', 'team:team_alfa', 'vehicle:veh_daily']);
    
    // Legacy fields aligned with primary entities
    expect(synced.assignedUid).toBe('usr_mario');
    expect(synced.assignedName).toBe('Mario Rossi');
    expect(synced.teamId).toBe('team_alfa');
    expect(synced.teamName).toBe('Squadra Alfa');
  });

  it('guarantees ZERO static expansion of team members in task', () => {
    // Even if squad has 10 members, ONLY team:team_id is stored in task
    const taskForTeam: Partial<ActivityItem> = {
      title: 'Posa Pavimento',
      assignedEntities: [
        { entityType: 'team', entityId: 'team_beta', entityName: 'Squadra Beta' }
      ]
    };

    const synced = syncActivityAssignees(taskForTeam);

    expect(synced.assigneeFilterKeys).toEqual(['team:team_beta']);
    expect(synced.teamId).toBe('team_beta');
    expect(synced.assignedUid).toBeUndefined();
    // Does NOT contain any fake user IDs
    expect(synced.assigneeFilterKeys.some(k => k.startsWith('user:'))).toBe(false);
  });

  it('falls back to legacy scalar fields if assignedEntities is empty', () => {
    const legacyActivity: Partial<ActivityItem> = {
      title: 'Task Vecchio',
      assignedUid: 'usr_legacy',
      assignedName: 'Giuseppe Verdi',
      teamId: 'team_old'
    };

    const synced = syncActivityAssignees(legacyActivity);

    expect(synced.assigneeFilterKeys).toContain('user:usr_legacy');
    expect(synced.assigneeFilterKeys).toContain('team:team_old');
    expect(synced.assignedUid).toBe('usr_legacy');
    expect(synced.teamId).toBe('team_old');
  });

  it('builds dynamic query filter targets for user at runtime', () => {
    const userId = 'usr_mario';
    const userTeams = ['team_alfa', 'team_gamma'];

    const targets = buildUserFilterTargets(userId, userTeams);

    expect(targets).toEqual(['user:usr_mario', 'team:team_alfa', 'team:team_gamma']);
  });

  it('chunks filter targets when exceeding Firestore 30-item array-contains-any limit', () => {
    const manyTeams = Array.from({ length: 45 }, (_, i) => `team_${i}`);
    const targets = buildUserFilterTargets('usr_supervisor', manyTeams);

    expect(targets.length).toBe(46); // 1 user + 45 teams

    const chunks = chunkArray(targets, 30);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(30);
    expect(chunks[1].length).toBe(16);
  });
});
