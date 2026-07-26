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
import type { ProductItem } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

export class ProductsService {
  private static COLLECTION_NAME = 'products';

  static async getProducts(): Promise<ProductItem[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem));
  }

  static async getProductById(id: string): Promise<ProductItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ProductItem;
  }

  static async createProduct(data: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const textSearch = generateSearchTerms(`${data.sku} ${data.name} ${data.category}`);
    
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
      const chunkId = await CacheLookupService.updateEntityCache('products', docRef.id, `${data.sku} - ${data.name}`);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache prodotti:', e);
    }

    return docRef.id;
  }

  static async updateProduct(id: string, data: Partial<ProductItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.sku || data.name || data.category) {
      const existing = await this.getProductById(id);
      const sku = data.sku || existing?.sku || '';
      const name = data.name || existing?.name || '';
      const cat = data.category || existing?.category || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${sku} ${name} ${cat}`);
      
      try {
        await CacheLookupService.updateEntityCache('products', id, `${sku} - ${name}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache prodotto:', e);
      }
    }

    sanitized.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
