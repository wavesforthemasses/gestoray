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
import type { CommissionItem } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

export class CommissionsService {
  private static COLLECTION_NAME = 'commissions';

  static async getCommissions(): Promise<CommissionItem[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionItem));
  }

  static async getCommissionById(id: string): Promise<CommissionItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CommissionItem;
  }

  static async createCommission(data: Omit<CommissionItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const textSearch = generateSearchTerms(`${data.commissionNumber} ${data.agentName} ${data.dealTitle}`);
    
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
      const chunkId = await CacheLookupService.updateEntityCache('commissions', docRef.id, `${data.commissionNumber} - ${data.agentName}`);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache provvigioni:', e);
    }

    return docRef.id;
  }

  static async updateCommission(id: string, data: Partial<CommissionItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.commissionNumber || data.agentName || data.dealTitle) {
      const existing = await this.getCommissionById(id);
      const num = data.commissionNumber || existing?.commissionNumber || '';
      const agent = data.agentName || existing?.agentName || '';
      const deal = data.dealTitle || existing?.dealTitle || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${num} ${agent} ${deal}`);
      
      try {
        await CacheLookupService.updateEntityCache('commissions', id, `${num} - ${agent}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache provvigione:', e);
      }
    }

    sanitized.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deleteCommission(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
