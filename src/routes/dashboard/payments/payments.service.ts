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
import type { PaymentItem } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

export class PaymentsService {
  private static COLLECTION_NAME = 'payments';

  static async getPayments(): Promise<PaymentItem[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentItem));
  }

  static async getPaymentById(id: string): Promise<PaymentItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PaymentItem;
  }

  static async createPayment(data: Omit<PaymentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const textSearch = generateSearchTerms(`${data.paymentNumber} ${data.clientName}`);
    
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
      const chunkId = await CacheLookupService.updateEntityCache('payments', docRef.id, `${data.paymentNumber} - ${data.clientName}`);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache pagamenti:', e);
    }

    return docRef.id;
  }

  static async updatePayment(id: string, data: Partial<PaymentItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.paymentNumber || data.clientName) {
      const existing = await this.getPaymentById(id);
      const num = data.paymentNumber || existing?.paymentNumber || '';
      const client = data.clientName || existing?.clientName || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${num} ${client}`);
      
      try {
        await CacheLookupService.updateEntityCache('payments', id, `${num} - ${client}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache pagamento:', e);
      }
    }

    sanitized.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deletePayment(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
