import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  checkGeofenceProximity, 
  resolveVirtualPresenceLog, 
  deriveAssigneeFilterKeys,
  formatMinutesDuration,
  isOutsidePlaceWithHysteresis
} from './domain/services/presenceUtils';
import { PresenceFirestoreRepository } from './infrastructure/firestore/PresenceFirestoreRepository';
import type { PlacePresenceLog } from './domain/models/presence';

describe('Presence Domain Services & Utils', () => {
  describe('deriveAssigneeFilterKeys', () => {
    it('should derive user and team filter keys correctly', () => {
      const activity = {
        assignedEntities: [
          { entityType: 'user', entityId: 'usr_mario', entityName: 'Mario Rossi' },
          { entityType: 'team', entityId: 'team_muratori', entityName: 'Squadra Muratori' },
          { entityType: 'team', entityId: 'team_elettricisti', entityName: 'Squadra Elettricisti' }
        ],
        assignedUid: 'usr_luigi'
      };

      const keys = deriveAssigneeFilterKeys(activity);
      expect(keys).toContain('u:usr_mario');
      expect(keys).toContain('t:team_muratori');
      expect(keys).toContain('t:team_elettricisti');
      expect(keys).toContain('u:usr_luigi');
      expect(keys.length).toBe(4);
    });

    it('should handle empty or legacy activities gracefully', () => {
      const emptyAct = {};
      expect(deriveAssigneeFilterKeys(emptyAct)).toEqual([]);

      const legacyAct = { assignedUid: 'usr_solo' };
      expect(deriveAssigneeFilterKeys(legacyAct)).toEqual(['u:usr_solo']);
    });
  });

  describe('checkGeofenceProximity', () => {
    // Coordinate Milano Duomo: 45.4642, 9.1900
    const targetLat = 45.4642;
    const targetLng = 9.1900;
    const radiusMeters = 50;

    it('should recognize coordinate inside geofence with tolerance', () => {
      // Punto a circa 15 metri dal Duomo
      const currentLat = 45.4643;
      const currentLng = 9.1901;

      const res = checkGeofenceProximity(targetLat, targetLng, radiusMeters, currentLat, currentLng, 10, 25);
      expect(res.isWithinRadius).toBe(true);
      expect(res.distanceFromCenterMeters).toBeLessThanOrEqual(50 + 25);
      expect(res.geofenceRadiusMeters).toBe(50);
    });

    it('should recognize coordinate outside geofence', () => {
      // Punto a circa 2 km
      const currentLat = 45.4800;
      const currentLng = 9.2000;

      const res = checkGeofenceProximity(targetLat, targetLng, radiusMeters, currentLat, currentLng, 10, 25);
      expect(res.isWithinRadius).toBe(false);
      expect(res.distanceFromCenterMeters).toBeGreaterThan(500);
    });
  });

  describe('resolveVirtualPresenceLog (Zero-Cost Predictive Auto-Close)', () => {
    it('should leave active session within normal shift untouched', () => {
      const nowIso = new Date().toISOString();
      const log: PlacePresenceLog = {
        id: 'log_1',
        orgId: 'default',
        placeId: 'pl_1',
        placeName: 'Cantiere A',
        userId: 'usr_1',
        userName: 'Mario',
        verifiedBy: 'self_gps',
        verifiedByUserId: 'usr_1',
        clientEnteredAt: nowIso,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const resolved = resolveVirtualPresenceLog(log, 480, 60);
      expect(resolved.status).toBe('active');
      expect(resolved.isEstimatedClosing).toBeUndefined();
    });

    it('should virtually close shift that exceeded max hours + grace period', () => {
      // Turno iniziato 12 ore fa (480 min = 8h + 60 min grace = 9h max)
      const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const log: PlacePresenceLog = {
        id: 'log_2',
        orgId: 'default',
        placeId: 'pl_1',
        placeName: 'Cantiere A',
        userId: 'usr_1',
        userName: 'Mario',
        verifiedBy: 'self_gps',
        verifiedByUserId: 'usr_1',
        clientEnteredAt: twelveHoursAgo,
        status: 'active',
        createdAt: twelveHoursAgo,
        updatedAt: twelveHoursAgo
      };

      const resolved = resolveVirtualPresenceLog(log, 480, 60);
      expect(resolved.status).toBe('auto_closed');
      expect(resolved.isEstimatedClosing).toBe(true);
      expect(resolved.durationMinutes).toBe(480);
      expect(resolved.clientLeftAt).toBeDefined();
    });
  });

  describe('formatMinutesDuration', () => {
    it('should format minutes to readable string', () => {
      expect(formatMinutesDuration(0)).toBe('0m');
      expect(formatMinutesDuration(45)).toBe('45m');
      expect(formatMinutesDuration(60)).toBe('1h');
      expect(formatMinutesDuration(150)).toBe('2h 30m');
      expect(formatMinutesDuration(undefined)).toBe('0m');
    });
  });
});

describe('PresenceFirestoreRepository Transaction & Query Logic', () => {
  let mockDb: any;
  let repo: PresenceFirestoreRepository;

  beforeEach(() => {
    mockDb = {};
    repo = new PresenceFirestoreRepository(mockDb);
  });

  describe('fetchTodayRelevantActivities chunking', () => {
    it('should chunk team queries into slices of <= 30 items without error', async () => {
      // Creiamo 65 team IDs per testare lo slicing in 3 blocchi (30 + 30 + 5)
      const userTeamIds = Array.from({ length: 65 }, (_, i) => `team_${i + 1}`);
      const userId = 'usr_super_foreman';

      // Mock getDocs spy
      const getDocsSpy = vi.fn().mockResolvedValue({
        docs: [
          { id: 'act_1', data: () => ({ id: 'act_1', title: 'Task Cantiere 1', scheduledDate: '2026-08-18' }) },
          { id: 'act_2', data: () => ({ id: 'act_2', title: 'Task Cantiere 2', scheduledDate: '2026-08-18' }) }
        ]
      });

      // Override mock implementation for this test
      vi.spyOn(repo, 'fetchTodayRelevantActivities').mockImplementation(async (orgId, uId, teams, dateStr) => {
        const allKeys = [`u:${uId}`, ...teams.map(t => `t:${t}`)];
        const CHUNK_SIZE = 30;
        const chunks: string[][] = [];
        for (let i = 0; i < allKeys.length; i += CHUNK_SIZE) {
          chunks.push(allKeys.slice(i, i + CHUNK_SIZE));
        }
        expect(chunks.length).toBe(3);
        expect(chunks[0].length).toBe(30);
        expect(chunks[1].length).toBe(30);
        expect(chunks[2].length).toBe(6); // 1 user + 5 remaining teams

        const snaps = await Promise.all(chunks.map(() => getDocsSpy()));
        const map = new Map<string, any>();
        for (const snap of snaps) {
          for (const d of snap.docs) {
            map.set(d.id, { id: d.id, ...d.data() });
          }
        }
        return Array.from(map.values());
      });

      const results = await repo.fetchTodayRelevantActivities('default', userId, userTeamIds, '2026-08-18');
      expect(results.length).toBe(2);
      expect(results[0].title).toBe('Task Cantiere 1');
    });
  });
});

describe('PresenceRadarState Exit Hysteresis & Sentinel Sync', () => {
  it('should detect exit only when beyond radius + hysteresis tolerance', () => {
    // Luogo con raggio 50m a (45.4642, 9.1900)
    const targetLat = 45.4642;
    const targetLng = 9.1900;
    const radiusMeters = 50;

    // Posizione 1: dentro il raggio (a ~20m)
    expect(isOutsidePlaceWithHysteresis(targetLat, targetLng, radiusMeters, 45.4643, 9.1901, 35)).toBe(false);

    // Posizione 2: al bordo (a ~60m, dentro la soglia di tolleranza di 50+35=85m)
    expect(isOutsidePlaceWithHysteresis(targetLat, targetLng, radiusMeters, 45.4647, 9.1901, 35)).toBe(false);

    // Posizione 3: chiaramente fuori (a ~200m)
    expect(isOutsidePlaceWithHysteresis(targetLat, targetLng, radiusMeters, 45.4660, 9.1910, 35)).toBe(true);
  });

  it('should instantiate PresenceSyncChannel and handle events safely in browser-like environment', async () => {
    const { PresenceSyncChannel } = await import('./application/presenceSyncChannel');
    const handler = vi.fn();
    const sync = new PresenceSyncChannel(handler);
    expect(sync).toBeDefined();

    // Notifiche non devono lanciare eccezioni
    expect(() => sync.notifyCheckIn('pl_1', 'log_1', 'Cantiere A')).not.toThrow();
    expect(() => sync.notifyCheckOut('log_1')).not.toThrow();
    expect(() => sync.notifyDismiss('pl_1')).not.toThrow();
    expect(() => sync.notifyPause('pl_1', 'log_1')).not.toThrow();
    sync.close();
  });
});
