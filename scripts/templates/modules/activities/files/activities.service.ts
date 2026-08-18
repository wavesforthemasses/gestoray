import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy 
} from '$lib/firebase';
import type { ActivityItem, ActivityTargetType } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';
import { generateId, cleanUndefined } from '$lib/utils/helpers';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { ActivitiesVersioningBridge } from './activities.versioning.bridge';

export interface ActivityFilterOptions {
  status?: string;
  assignedUid?: string;
  priority?: string;
  targetType?: string;
  targetId?: string;
  tenantId?: string;
}

export class ActivitiesService {
  private static COLLECTION_NAME = 'activities';

  /**
   * Recupera le attività applicando filtri e query resiliente con ordinamento sicuro in memoria.
   */
  static async getActivities(filters?: ActivityFilterOptions): Promise<ActivityItem[]> {
    try {
      const constraints: any[] = [];

      if (filters?.tenantId) {
        constraints.push(where('tenantId', '==', filters.tenantId));
      }
      if (filters?.status && filters.status !== 'tutti') {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters?.assignedUid && filters.assignedUid !== 'tutti') {
        constraints.push(where('assignedUid', '==', filters.assignedUid));
      }
      if (filters?.priority && filters.priority !== 'tutti') {
        constraints.push(where('priority', '==', filters.priority));
      }
      if (filters?.targetType && filters.targetType !== 'tutti') {
        constraints.push(where('targetType', '==', filters.targetType));
      }
      if (filters?.targetId) {
        constraints.push(where('targetId', '==', filters.targetId));
      }

      let snap;
      try {
        const q = query(collection(db, this.COLLECTION_NAME), ...constraints, orderBy('createdAt', 'desc'));
        snap = await getDocs(q);
      } catch (e) {
        // Fallback resiliente senza orderBy Firestore
        const qFallback = query(collection(db, this.COLLECTION_NAME), ...constraints);
        snap = await getDocs(qFallback);
      }

      if (snap.empty && constraints.length > 0) {
        try {
          const qFallback = query(collection(db, this.COLLECTION_NAME), ...constraints);
          snap = await getDocs(qFallback);
        } catch (e) {
          // Ignore
        }
      }

      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ActivityItem))
        .filter(a => !a.derived?.deleted);

      // Ordinamento resiliente in memoria
      list.sort((a, b) => {
        const dA = a.createdAt || a.edits?.createdAt || '';
        const dB = b.createdAt || b.edits?.createdAt || '';
        return dB.localeCompare(dA);
      });

      return list;
    } catch (e) {
      console.warn('[ActivitiesService] Errore getActivities:', e);
      return [];
    }
  }

  /**
   * Recupera le attività correlate per lo stesso bersaglio o per lo stesso cliente,
   * isolate per tenant, escludendo l'attività corrente e calcolando le attività dello stesso giorno in memoria.
   */
  static async getRelatedActivities(params: {
    currentActivityId: string;
    targetId?: string;
    targetType?: string;
    clientId?: string;
    executionDate?: string;
    tenantId?: string;
    limitCount?: number;
  }): Promise<{
    sameTarget: ActivityItem[];
    sameClient: ActivityItem[];
    sameDayOnTarget: ActivityItem[];
  }> {
    const limit = params.limitCount || 6;
    const sameTarget: ActivityItem[] = [];
    const sameClient: ActivityItem[] = [];
    const sameDayOnTarget: ActivityItem[] = [];

    try {
      // 1. Query per stesso Target (Luogo, Contratto, etc.)
      if (params.targetId) {
        const constraints: any[] = [where('targetId', '==', params.targetId)];
        if (params.tenantId) {
          constraints.push(where('tenantId', '==', params.tenantId));
        }
        const q = query(collection(db, this.COLLECTION_NAME), ...constraints);
        const snap = await getDocs(q);
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ActivityItem))
          .filter(a => a.id !== params.currentActivityId && !a.derived?.deleted);

        // Ordina per data esecuzione/creazione più recente
        docs.sort((a, b) => {
          const dateA = a.executionDate || a.dueDate || a.createdAt || '';
          const dateB = b.executionDate || b.dueDate || b.createdAt || '';
          return dateB.localeCompare(dateA);
        });

        // Identifica attività dello stesso giorno in memoria
        if (params.executionDate) {
          const targetDay = params.executionDate.slice(0, 10);
          for (const item of docs) {
            const itemDay = (item.executionDate || item.dueDate || '').slice(0, 10);
            if (itemDay && itemDay === targetDay) {
              sameDayOnTarget.push(item);
            }
          }
        }

        sameTarget.push(...docs.slice(0, limit));
      }

      // 2. Query per stesso Cliente (se target non è già client e clientId è presente)
      if (params.clientId && params.targetType !== 'client') {
        const constraints: any[] = [where('clientId', '==', params.clientId)];
        if (params.tenantId) {
          constraints.push(where('tenantId', '==', params.tenantId));
        }
        const q = query(collection(db, this.COLLECTION_NAME), ...constraints);
        const snap = await getDocs(q);
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ActivityItem))
          .filter(a => a.id !== params.currentActivityId && !a.derived?.deleted && a.targetId !== params.targetId);

        docs.sort((a, b) => {
          const dateA = a.executionDate || a.dueDate || a.createdAt || '';
          const dateB = b.executionDate || b.dueDate || b.createdAt || '';
          return dateB.localeCompare(dateA);
        });

        sameClient.push(...docs.slice(0, limit));
      }
    } catch (e) {
      console.warn('[ActivitiesService] Errore getRelatedActivities:', e);
    }

    return {
      sameTarget,
      sameClient,
      sameDayOnTarget
    };
  }

  static async getActivityById(id: string): Promise<ActivityItem | null> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() as ActivityItem;
      if (data.derived?.deleted) return null;
      return { id: snap.id, ...data };
    } catch (e) {
      console.warn('[ActivitiesService] Errore getActivityById:', e);
      return null;
    }
  }

  /**
   * Crea un'attività eseguendo la transazione ACID Dual-Write su activities e system_ledger.
   */
  static async createActivity(
    data: Omit<ActivityItem, 'id' | 'createdAt' | 'updatedAt' | 'edits'>,
    author: { uid: string; displayName?: string; tenantId?: string }
  ): Promise<string> {
    const assignedEntities = data.assignedEntities || [];
    const firstUser = assignedEntities.find(a => a.entityType === 'user');
    const assignedUid = data.assignedUid || firstUser?.entityId || '';
    const assignedName = data.assignedName || firstUser?.entityName || '';

    const newId = generateId('act');
    const nowIso = new Date().toISOString();

    const searchTerms = generateSearchTerms(
      `${data.activityNumber || ''} ${data.title || ''} ${data.targetName || ''} ${assignedName} ${assignedEntities.map(a => a.entityName).join(' ')}`
    );

    const filterKeys = new Set<string>();
    if (Array.isArray(assignedEntities)) {
      for (const a of assignedEntities) {
        if (a.entityType === 'user' && a.entityId) filterKeys.add(`u:${a.entityId}`);
        if (a.entityType === 'team' && a.entityId) filterKeys.add(`t:${a.entityId}`);
      }
    }
    if (assignedUid) filterKeys.add(`u:${assignedUid}`);

    const payload: ActivityItem = {
      ...data,
      id: newId,
      category: data.category || 'crm',
      assignedEntities,
      assigneeFilterKeys: Array.from(filterKeys),
      assignedUid,
      assignedName,
      createdAt: nowIso,
      updatedAt: nowIso,
      edits: {
        createdAt: nowIso,
        createdBy: author.uid,
        aggregateVersion: 1
      },
      derived: {
        textSearch: searchTerms,
        deleted: false
      }
    };

    // Validazione difensiva sul targetType
    if (data.targetType) {
      const validTargets: ActivityTargetType[] = ['contact', 'client', 'user', 'place', 'vehicle', 'contract', 'ticket'];
      if (!validTargets.includes(data.targetType)) {
        throw new Error(`TargetType non valido: ${data.targetType}`);
      }
    }

    const semanticsMap = ActivitiesVersioningBridge.getSemanticsMap();
    const diff = computeDiff(null, payload, { semanticsMap });

    const entityRef = doc(db, this.COLLECTION_NAME, newId);
    const entityLabel = `${payload.activityNumber || ''} - ${payload.title || ''}`.trim();

    await VersioningService.executeDualWriteTransaction(
      db,
      entityRef,
      payload,
      {
        tenantId: author.tenantId || 'default',
        module: 'activities',
        entityType: 'activities',
        entityId: newId,
        entityLabel,
        eventType: 'FIELD_MUTATION',
        keysChanged: diff.keysChanged,
        mutations: diff.mutations,
        performedBy: author.uid,
        performedByName: author.displayName || 'Operatore',
        actorType: 'USER',
        reason: `Creazione attività ${payload.title || ''}`.trim()
      },
      0
    );

    try {
      const chunkId = await CacheLookupService.updateEntityCache('activities', newId, `${payload.activityNumber || ''} - ${payload.title}`);
      if (chunkId) {
        await updateDoc(doc(db, this.COLLECTION_NAME, newId), { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('[ActivitiesService] Errore cache attività:', e);
    }

    return newId;
  }

  /**
   * Aggiorna un'attività esistente eseguendo la transazione ACID Dual-Write con OCC.
   */
  static async updateActivity(
    id: string, 
    updates: Partial<ActivityItem>,
    author: { uid: string; displayName?: string; tenantId?: string },
    reason?: string
  ): Promise<void> {
    const existing = await this.getActivityById(id);
    if (!existing) throw new Error(`Attività ${id} non trovata`);

    const nowIso = new Date().toISOString();
    const nextData: ActivityItem = {
      ...existing,
      ...updates,
      updatedAt: nowIso
    };

    // Rigenerazione dei search terms e assigneeFilterKeys se variano dati descrittivi o assegnazioni
    if (updates.activityNumber || updates.title || updates.targetName || updates.assignedName || updates.assignedEntities || updates.assignedUid) {
      const user = nextData.assignedName || '';
      const entitiesStr = Array.isArray(nextData.assignedEntities) ? nextData.assignedEntities.map(a => a.entityName).join(' ') : '';
      nextData.derived = {
        ...(nextData.derived || {}),
        textSearch: generateSearchTerms(`${nextData.activityNumber || ''} ${nextData.title} ${nextData.targetName || ''} ${user} ${entitiesStr}`)
      };

      const filterKeys = new Set<string>();
      if (Array.isArray(nextData.assignedEntities)) {
        for (const a of nextData.assignedEntities) {
          if (a.entityType === 'user' && a.entityId) filterKeys.add(`u:${a.entityId}`);
          if (a.entityType === 'team' && a.entityId) filterKeys.add(`t:${a.entityId}`);
        }
      }
      if (nextData.assignedUid) filterKeys.add(`u:${nextData.assignedUid}`);
      nextData.assigneeFilterKeys = Array.from(filterKeys);
    }

    const semanticsMap = ActivitiesVersioningBridge.getSemanticsMap();
    const diff = computeDiff(existing, nextData, { semanticsMap });

    const entityRef = doc(db, this.COLLECTION_NAME, id);
    const entityLabel = `${nextData.activityNumber || ''} - ${nextData.title || ''}`.trim();
    const currentVersion = (existing.edits?.aggregateVersion as number) || 0;

    await VersioningService.executeDualWriteTransaction(
      db,
      entityRef,
      nextData,
      {
        tenantId: author?.tenantId || 'default',
        module: 'activities',
        entityType: 'activities',
        entityId: id,
        entityLabel,
        eventType: 'FIELD_MUTATION',
        keysChanged: diff.keysChanged,
        mutations: diff.mutations,
        performedBy: author?.uid || 'system',
        performedByName: author?.displayName || 'Operatore',
        actorType: 'USER',
        reason: reason || `Modifica attività ${nextData.title || ''}`.trim()
      },
      currentVersion
    );

    try {
      await CacheLookupService.updateEntityCache('activities', id, `${nextData.activityNumber || ''} - ${nextData.title}`);
    } catch (e) {
      console.warn('[ActivitiesService] Errore cache attività:', e);
    }
  }

  /**
   * Esegue il soft-delete canonico di un'attività preservando l'audit ledger.
   */
  static async deleteActivity(id: string, author?: { uid: string; displayName?: string; tenantId?: string }): Promise<void> {
    if (author) {
      await this.updateActivity(id, { derived: { deleted: true } as any }, author, 'Cancellazione attività');
    } else {
      await updateDoc(doc(db, this.COLLECTION_NAME, id), { 'derived.deleted': true, updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Restituisce le statistiche veloci per badge o KPI.
   */
  static async getStats(): Promise<{ total: number; completed: number; inProgress: number; todo: number }> {
    const list = await this.getActivities();
    return {
      total: list.length,
      completed: list.filter(a => a.status === 'completata' || a.status === 'completato').length,
      inProgress: list.filter(a => a.status === 'in_corso').length,
      todo: list.filter(a => a.status === 'da_fare').length
    };
  }
}
