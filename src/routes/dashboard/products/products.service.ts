import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  query, 
  orderBy 
} from '$lib/firebase';
import type { ProductItem, MinimoFatturabileConfig } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { ProductsVersioningBridge } from './products.versioning.bridge';
import { generateId } from '$lib/utils/helpers';

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
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ProductItem))
      .filter(p => !(p as any).derived?.deleted);
  }

  static async getProductById(id: string): Promise<ProductItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.derived?.deleted) return null;
    return { id: snap.id, ...data } as ProductItem;
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

  static async createProduct(
    data: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { uid?: string; userEmail?: string; tenantId?: string }
  ): Promise<string> {
    const productType = data.type || 'product';
    const trackStock = data.trackStock !== undefined 
      ? data.trackStock 
      : (productType === 'service' || productType === 'digital' ? false : true);
    const allowOutOfStockSale = data.allowOutOfStockSale !== undefined ? data.allowOutOfStockSale : true;
    const stockQty = data.stockQty !== undefined ? data.stockQty : 0;

    const textSearch = generateSearchTerms(`${data.sku} ${data.name} ${data.category} ${productType}`);
    const productId = generateId('prod');
    const productRef = doc(db, this.COLLECTION_NAME, productId);
    
    const rawPayload: Record<string, any> = {
      ...data,
      id: productId,
      type: productType,
      trackStock,
      stockQty,
      allowOutOfStockSale,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = sanitizeFirestorePayload(rawPayload);
    const entityLabel = ProductsVersioningBridge.getEntityLabel(payload);

    const diff = computeDiff(null, payload, {
      semanticsMap: ProductsVersioningBridge.getSemanticsMap()
    });

    await VersioningService.executeDualWriteTransaction(
      db,
      productRef,
      payload,
      {
        tenantId: options?.tenantId || 'default',
        module: 'products',
        entityType: 'product',
        entityId: productId,
        entityLabel,
        eventType: 'FIELD_MUTATION',
        keysChanged: diff.keysChanged,
        mutations: diff.mutations,
        performedBy: options?.uid || 'system',
        performedByName: options?.userEmail,
        actorType: 'USER',
        reason: 'Creazione scheda articolo catalogo'
      },
      0
    );

    try {
      const chunkId = await CacheLookupService.updateEntityCache('products', productId, `${data.sku} - ${data.name}`);
      if (chunkId) {
        await updateDoc(productRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache prodotti:', e);
    }

    return productId;
  }

  static async updateProduct(
    id: string, 
    data: Partial<ProductItem>,
    options?: { uid?: string; userEmail?: string; tenantId?: string; expectedBaseVersion?: number; reason?: string }
  ): Promise<void> {
    const productRef = doc(db, this.COLLECTION_NAME, id);
    const existingSnap = await getDoc(productRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as ProductItem) : null;

    const sanitizedRaw: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitizedRaw[key] = val;
      }
    });

    const sku = data.sku !== undefined ? data.sku : (existing?.sku || '');
    const name = data.name !== undefined ? data.name : (existing?.name || '');
    const cat = data.category !== undefined ? data.category : (existing?.category || '');
    const type = data.type !== undefined ? data.type : (existing?.type || 'product');

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      ...sanitizedRaw,
      updatedAt: new Date().toISOString(),
      derived: {
        ...(existing?.derived || {}),
        textSearch: generateSearchTerms(`${sku} ${name} ${cat} ${type}`)
      }
    };

    const payload = sanitizeFirestorePayload(nextEntityData);
    const entityLabel = ProductsVersioningBridge.getEntityLabel(payload);

    const diff = computeDiff(existing, payload, {
      semanticsMap: ProductsVersioningBridge.getSemanticsMap()
    });

    if (diff.keysChanged.length > 0) {
      await VersioningService.executeDualWriteTransaction(
        db,
        productRef,
        payload,
        {
          tenantId: options?.tenantId || 'default',
          module: 'products',
          entityType: 'product',
          entityId: id,
          entityLabel,
          eventType: 'FIELD_MUTATION',
          keysChanged: diff.keysChanged,
          mutations: diff.mutations,
          performedBy: options?.uid || 'system',
          performedByName: options?.userEmail,
          actorType: 'USER',
          reason: options?.reason || 'Aggiornamento scheda articolo catalogo'
        },
        options?.expectedBaseVersion !== undefined ? options.expectedBaseVersion : ((existing as any)?.edits?.aggregateVersion ?? 0)
      );
    } else {
      await updateDoc(productRef, { updatedAt: new Date().toISOString() });
    }

    try {
      await CacheLookupService.updateEntityCache('products', id, `${sku} - ${name}`);
    } catch (e) {
      console.warn('Errore aggiornamento cache prodotto:', e);
    }
  }

  static async deleteProduct(
    id: string, 
    options?: { uid?: string; userEmail?: string; tenantId?: string }
  ): Promise<void> {
    const productRef = doc(db, this.COLLECTION_NAME, id);
    const existingSnap = await getDoc(productRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as ProductItem) : null;

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      derived: {
        ...(existing?.derived || {}),
        deleted: true
      },
      edits: {
        ...(existing as any)?.edits,
        deletedAt: new Date().toISOString(),
        deletedBy: options?.uid || 'system'
      }
    };

    const entityLabel = ProductsVersioningBridge.getEntityLabel(existing);

    await VersioningService.executeDualWriteTransaction(
      db,
      productRef,
      nextEntityData,
      {
        tenantId: options?.tenantId || 'default',
        module: 'products',
        entityType: 'product',
        entityId: id,
        entityLabel,
        eventType: 'STATUS_CHANGE',
        keysChanged: ['derived.deleted'],
        mutations: {
          'derived.deleted': {
            old: false,
            new: true,
            semantics: 'DESCRIPTIVE'
          }
        },
        performedBy: options?.uid || 'system',
        performedByName: options?.userEmail,
        actorType: 'USER',
        reason: 'Cancellazione logica articolo'
      },
      (existing as any)?.edits?.aggregateVersion ?? 0
    );

    try {
      await CacheLookupService.removeEntityFromCache('products', id);
    } catch (e) {
      console.warn('Errore rimozione cache prodotto:', e);
    }
  }
}
