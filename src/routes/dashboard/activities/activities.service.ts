import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy 
} from '$lib/firebase';
import type { ActivityItem } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

export interface ActivityFilterOptions {
  status?: string;
  assignedUid?: string;
  priority?: string;
}

export class ActivitiesService {
  private static COLLECTION_NAME = 'activities';

  static async getActivities(filters?: ActivityFilterOptions): Promise<ActivityItem[]> {
    const constraints: any[] = [];

    if (filters?.status && filters.status !== 'tutti') {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.assignedUid && filters.assignedUid !== 'tutti') {
      constraints.push(where('assignedUid', '==', filters.assignedUid));
    }
    if (filters?.priority && filters.priority !== 'tutti') {
      constraints.push(where('priority', '==', filters.priority));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, this.COLLECTION_NAME), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityItem));
  }

  static async getActivityById(id: string): Promise<ActivityItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ActivityItem;
  }

  static async createActivity(data: Omit<ActivityItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const assignedEntities = data.assignedEntities || [];
    const firstUser = assignedEntities.find(a => a.entityType === 'user');
    const assignedUid = data.assignedUid || firstUser?.entityId || '';
    const assignedName = data.assignedName || firstUser?.entityName || '';

    const textSearch = generateSearchTerms(`${data.activityNumber || ''} ${data.title} ${assignedName} ${assignedEntities.map(a => a.entityName).join(' ')}`);
    
    const rawPayload: Record<string, any> = {
      ...data,
      category: data.category || 'task',
      assignedEntities,
      assignedUid,
      assignedName,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sanitizedPayload: Record<string, any> = {};
    Object.entries(rawPayload).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitizedPayload[key] = val;
      }
    });

    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), sanitizedPayload);

    try {
      const chunkId = await CacheLookupService.updateEntityCache('activities', docRef.id, `${data.activityNumber} - ${data.title}`);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache attività:', e);
    }

    return docRef.id;
  }

  static async updateActivity(id: string, data: Partial<ActivityItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.activityNumber || data.title || data.assignedName) {
      const existing = await this.getActivityById(id);
      const num = data.activityNumber || existing?.activityNumber || '';
      const title = data.title || existing?.title || '';
      const user = data.assignedName || existing?.assignedName || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${num} ${title} ${user}`);
      
      try {
        await CacheLookupService.updateEntityCache('activities', id, `${num} - ${title}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache attività:', e);
      }
    }

    sanitized.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deleteActivity(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }

  static async getActivitiesByGroupId(groupId: string): Promise<ActivityItem[]> {
    const q = query(collection(db, this.COLLECTION_NAME), where('groupId', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityItem));
  }

  static async updateActivityGroup(groupId: string, data: Partial<ActivityItem>): Promise<void> {
    const groupItems = await this.getActivitiesByGroupId(groupId);
    // Exclude date fields to keep original execution dates distinct!
    const { executionDate, dueDate, scheduledDate, ...rest } = data;
    for (const item of groupItems) {
      if (item.id) {
        await this.updateActivity(item.id, rest);
      }
    }
  }

  static async deleteActivityGroup(groupId: string): Promise<void> {
    const groupItems = await this.getActivitiesByGroupId(groupId);
    for (const item of groupItems) {
      if (item.id) {
        await this.deleteActivity(item.id);
      }
    }
  }

  static async promoteToIntervention(activityId: string, userUid?: string): Promise<string> {
    const activity = await this.getActivityById(activityId);
    if (!activity) throw new Error('Attività non trovata');

    let interventionId = '';
    try {
      const servicePath = '../interventi/interventi.service';
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ servicePath);
      const InterventiService = mod?.InterventiService;

      if (!InterventiService) throw new Error('Modulo interventi non disponibile');

      interventionId = await InterventiService.createIntervention({
        title: activity.title,
        description: activity.description || '',
        clientId: activity.clientId || '',
        clientName: activity.clientName || '',
        dueDate: activity.dueDate || activity.executionDate || '',
        scheduledDate: activity.scheduledDate || undefined,
        scheduledSlot: activity.scheduledSlot || undefined,
        scheduledCustomStart: activity.customStartTime || undefined,
        scheduledCustomEnd: activity.customEndTime || undefined,
        priority: (activity.priority || 'media') as any,
        assignedEntities: activity.assignedEntities || [],
        phase: activity.scheduledDate ? 'pianificato' : 'bozza',
        category: 'task'
      }, userUid);

      await this.updateActivity(activityId, {
        status: 'completata',
        customFields: {
          ...(activity.customFields || {}),
          promotedInterventionId: interventionId
        }
      });
    } catch (err) {
      console.error('Errore durante la promozione a intervento:', err);
      throw err;
    }

    return interventionId;
  }
}
