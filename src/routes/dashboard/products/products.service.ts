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
import type { ProductItem, MinimoFatturabileConfig } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';

function sanitizeFirestorePayload(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestorePayload).filter(v => v !== undefined);
  }
  if (typeof obj === 'object' && (obj.constructor === Object || !obj.constructor)) {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        const cleaned = sanitizeFirestorePayload(val);
        if (cleaned !== undefined) {
          res[key] = cleaned;
        }
      }
    }
    return res;
  }
  return obj;
}

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

  static parseMinimoFatturabile(raw: any): MinimoFatturabileConfig | undefined {
    if (!raw) return undefined;
    if (typeof raw === 'object' && raw.enabled !== undefined) {
      return raw as MinimoFatturabileConfig;
    }
    const str = String(raw).trim();
    if (!str) return undefined;

    let minQuantity: number | null = null;
    let flatPrice: number | null = null;

    const numMatches = str.match(/\d+(?:[.,]\d+)?/g);
    if (numMatches && numMatches.length >= 2) {
      minQuantity = parseFloat(numMatches[0].replace(',', '.'));
      flatPrice = parseFloat(numMatches[1].replace(',', '.'));
    } else if (numMatches && numMatches.length === 1) {
      if (str.includes('€') || str.toLowerCase().includes('eur')) {
        flatPrice = parseFloat(numMatches[0].replace(',', '.'));
      } else {
        minQuantity = parseFloat(numMatches[0].replace(',', '.'));
      }
    }

    return {
      enabled: true,
      minQuantity,
      flatPrice,
      displayText: str
    };
  }

  static async createProduct(data: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const textSearch = generateSearchTerms(`${data.sku} ${data.name} ${data.category}`);
    
    const rawPayload = {
      ...data,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = sanitizeFirestorePayload(rawPayload);

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
    const sanitizedRaw: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitizedRaw[key] = val;
      }
    });

    if (data.sku || data.name || data.category) {
      const existing = await this.getProductById(id);
      const sku = data.sku || existing?.sku || '';
      const name = data.name || existing?.name || '';
      const cat = data.category || existing?.category || '';
      sanitizedRaw['derived.textSearch'] = generateSearchTerms(`${sku} ${name} ${cat}`);
      
      try {
        await CacheLookupService.updateEntityCache('products', id, `${sku} - ${name}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache prodotto:', e);
      }
    }

    sanitizedRaw.updatedAt = new Date().toISOString();
    const sanitized = sanitizeFirestorePayload(sanitizedRaw);
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
