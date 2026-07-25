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
  orderBy, 
  limit, 
  serverTimestamp 
} from '$lib/firebase';
import type { ContractItem, ContractInstallment } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

export class ContractsService {
  private static COLLECTION_NAME = 'contracts';

  static async getContracts(): Promise<ContractItem[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContractItem));
  }

  static async getContractById(id: string): Promise<ContractItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ContractItem;
  }

  static async createContract(data: Omit<ContractItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const textSearch = generateSearchTerms(`${data.contractNumber} ${data.title} ${data.clientName}`);
    
    const payload = {
      ...data,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);

    // Update Sharded Lookup Cache
    try {
      const chunkId = await CacheLookupService.updateEntityCache('contracts', docRef.id, data.title);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache contratti:', e);
    }

    return docRef.id;
  }

  static async updateContract(id: string, data: Partial<ContractItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.title || data.contractNumber || data.clientName) {
      const existing = await this.getContractById(id);
      const title = data.title || existing?.title || '';
      const num = data.contractNumber || existing?.contractNumber || '';
      const client = data.clientName || existing?.clientName || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${num} ${title} ${client}`);
      
      try {
        await CacheLookupService.updateEntityCache('contracts', id, title);
      } catch (e) {
        console.warn('Errore aggiornamento cache contratto:', e);
      }
    }

    sanitized.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deleteContract(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }

  // Installments Subcollection
  static async getInstallments(contractId: string): Promise<ContractInstallment[]> {
    const subCol = collection(db, this.COLLECTION_NAME, contractId, 'installments');
    const q = query(subCol, orderBy('installmentNumber', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContractInstallment));
  }

  static async addInstallment(contractId: string, installment: Omit<ContractInstallment, 'id'>): Promise<string> {
    const subCol = collection(db, this.COLLECTION_NAME, contractId, 'installments');
    const ref = await addDoc(subCol, installment);
    return ref.id;
  }
}
