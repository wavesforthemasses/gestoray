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
  orderBy 
} from '$lib/firebase';
import type { ActivityItem } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

export class ActivitiesService {
  private static COLLECTION_NAME = 'activities';

  static async getActivities(): Promise<ActivityItem[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
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
    const textSearch = generateSearchTerms(`${data.activityNumber} ${data.title} ${data.assignedName}`);
    
    const payload = {
      ...data,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);

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
}
