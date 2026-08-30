import type { AssignedEntityRef } from '$lib/types/assignments';

/**
 * Normalizza e sincronizza le assegnazioni di un'attività.
 * Regole architetturali:
 * 1. Zero Static Expansion: se l'entità è un team, scrive SOLO 'team:TEAM_ID' in assigneeFilterKeys (non gli utenti).
 * 2. Deterministico: aggiorna sia i campi scalari legacy (assignedUid, teamId, vehicleId) sia assigneeFilterKeys.
 * 3. Bidirezionale: se mancano le assignedEntities ma ci sono campi legacy, le ricostruisce.
 */
export function syncActivityAssignees<T extends {
  assignedEntities?: AssignedEntityRef[];
  assignedUid?: string;
  assignedName?: string;
  teamId?: string;
  teamName?: string;
  vehicleId?: string;
  vehicleName?: string;
  assigneeFilterKeys?: string[];
}>(activity: T): T & {
  assignedEntities: AssignedEntityRef[];
  assignedUid?: string;
  assignedName?: string;
  teamId?: string;
  teamName?: string;
  vehicleId?: string;
  vehicleName?: string;
  assigneeFilterKeys: string[];
} {
  let entities: AssignedEntityRef[] = Array.isArray(activity.assignedEntities) 
    ? [...activity.assignedEntities] 
    : [];

  // Se assignedEntities è vuoto ma ci sono campi legacy, costruiscile
  if (entities.length === 0) {
    if (activity.assignedUid) {
      entities.push({
        entityType: 'user',
        entityId: activity.assignedUid,
        entityName: activity.assignedName || ''
      });
    }
    if (activity.teamId) {
      entities.push({
        entityType: 'team',
        entityId: activity.teamId,
        entityName: activity.teamName || ''
      });
    }
    if (activity.vehicleId) {
      entities.push({
        entityType: 'vehicle',
        entityId: activity.vehicleId,
        entityName: activity.vehicleName || ''
      });
    }
  }

  // Estrai i singoli attori primari
  const primaryUser = entities.find(e => e.entityType === 'user');
  const primaryTeam = entities.find(e => e.entityType === 'team');
  const primaryVehicle = entities.find(e => e.entityType === 'vehicle');

  const assignedUid = primaryUser ? (primaryUser.entityId || primaryUser.id) : undefined;
  const assignedName = primaryUser ? (primaryUser.entityName || primaryUser.name) : undefined;

  const teamId = primaryTeam ? (primaryTeam.entityId || primaryTeam.id) : undefined;
  const teamName = primaryTeam ? (primaryTeam.entityName || primaryTeam.name) : undefined;

  const vehicleId = primaryVehicle ? (primaryVehicle.entityId || primaryVehicle.id) : undefined;
  const vehicleName = primaryVehicle ? (primaryVehicle.entityName || primaryVehicle.name) : undefined;

  // Calcola le chiavi di filtro (Zero Static Expansion)
  const filterKeySet = new Set<string>();
  for (const ent of entities) {
    const rawType = ent.entityType || ent.type;
    const rawId = ent.entityId || ent.id;
    if (rawType && rawId) {
      filterKeySet.add(`${rawType}:${rawId}`);
    }
  }

  const assigneeFilterKeys = Array.from(filterKeySet);

  return {
    ...activity,
    assignedEntities: entities,
    assignedUid,
    assignedName,
    teamId,
    teamName,
    vehicleId,
    vehicleName,
    assigneeFilterKeys
  };
}

/**
 * Costruisce i target di filtro per una query utente a tempo di esecuzione.
 * Es. user:mario_uid, team:squadra_alfa, team:squadra_beta
 */
export function buildUserFilterTargets(userId: string, teamIds: string[] = []): string[] {
  const targets: string[] = [];
  if (userId) {
    targets.push(`user:${userId}`);
  }
  for (const tId of teamIds) {
    if (tId) {
      targets.push(`team:${tId}`);
    }
  }
  return targets;
}

/**
 * Suddivide un array in chunk di dimensione massima specificata (default 30 per Firestore array-contains-any).
 */
export function chunkArray<T>(items: T[], chunkSize = 30): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
