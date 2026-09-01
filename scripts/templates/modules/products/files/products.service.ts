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
import type { ProductItem, ProductUsageType, MinimoFatturabileConfig } from './schema';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { ProductsVersioningBridge } from './products.versioning.bridge';
import { generateId, cleanUndefined } from '$lib/utils/helpers';
import { roundCurrency } from '$lib/utils/math';

export class ProductsService {
  private static COLLECTION_NAME = 'products';

  /**
   * Helper per determinare se un prodotto è abilitato alla vendita (clienti / preventivi / contratti)
   */
  static isSaleable(item: ProductItem): boolean {
    if (item.canBeSold !== undefined) return Boolean(item.canBeSold);
    if (item.usageType === 'purchase') return false;
    return true; // default: saleable
  }

  /**
   * Helper per determinare se un prodotto è abilitato all'acquisto (fornitori / ordini PO)
   */
  static isPurchasable(item: ProductItem): boolean {
    if (item.canBePurchased !== undefined) return Boolean(item.canBePurchased);
    if (item.usageType === 'sale') return false;
    return true; // default: purchasable
  }

  static async getProducts(filter?: {
    canBeSold?: boolean;
    canBePurchased?: boolean;
    usageType?: ProductUsageType;
  }): Promise<ProductItem[]> {
    let snap;
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('createdAt', 'desc')
      );
      snap = await getDocs(q);
    } catch (e) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    if (snap.empty) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    let list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ProductItem))
      .filter(p => !(p as any).derived?.deleted);

    if (filter) {
      if (filter.usageType) {
        list = list.filter(p => (p.usageType || 'both') === filter.usageType);
      }
      if (filter.canBeSold !== undefined) {
        list = list.filter(p => this.isSaleable(p) === filter.canBeSold);
      }
      if (filter.canBePurchased !== undefined) {
        list = list.filter(p => this.isPurchasable(p) === filter.canBePurchased);
      }
    }

    list.sort((a, b) => {
      const dA = a.createdAt || (a as any).edits?.createdAt || '';
      const dB = b.createdAt || (b as any).edits?.createdAt || '';
      return dB.localeCompare(dA);
    });
    return list;
  }

  /**
   * Restituisce esclusivamente gli articoli vendibili a clienti (utilizzato da Contratti/Preventivi)
   */
  static async getSaleableProducts(): Promise<ProductItem[]> {
    return this.getProducts({ canBeSold: true });
  }

  /**
   * Restituisce esclusivamente gli articoli acquistabili da fornitori (utilizzato da Ordini PO Magazzino)
   */
  static async getPurchasableProducts(): Promise<ProductItem[]> {
    return this.getProducts({ canBePurchased: true });
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
    const usageType = data.usageType || 'both';
    const canBeSold = data.canBeSold !== undefined ? data.canBeSold : (usageType !== 'purchase');
    const canBePurchased = data.canBePurchased !== undefined ? data.canBePurchased : (usageType !== 'sale');
    const price = roundCurrency(data.price ?? 0);
    const purchasePrice = data.purchasePrice !== undefined ? roundCurrency(data.purchasePrice) : price;

    const trackStock = data.trackStock !== undefined 
      ? data.trackStock 
      : (productType === 'service' || productType === 'digital' ? false : true);
    const allowOutOfStockSale = data.allowOutOfStockSale !== undefined ? data.allowOutOfStockSale : true;
    const stockQty = data.stockQty !== undefined ? data.stockQty : 0;

    const textSearch = generateSearchTerms(`${data.sku} ${data.name} ${data.category} ${productType} ${usageType}`);
    const productId = generateId('prod');
    const productRef = doc(db, this.COLLECTION_NAME, productId);
    
    const rawPayload: Record<string, any> = {
      ...data,
      id: productId,
      type: productType,
      usageType,
      canBeSold,
      canBePurchased,
      price,
      purchasePrice,
      trackStock,
      stockQty,
      allowOutOfStockSale,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = cleanUndefined(rawPayload);
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
    const usageType = data.usageType !== undefined ? data.usageType : (existing?.usageType || 'both');
    const canBeSold = data.canBeSold !== undefined ? data.canBeSold : (usageType !== 'purchase');
    const canBePurchased = data.canBePurchased !== undefined ? data.canBePurchased : (usageType !== 'sale');

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      ...sanitizedRaw,
      type,
      usageType,
      canBeSold,
      canBePurchased,
      updatedAt: new Date().toISOString(),
      derived: {
        ...(existing?.derived || {}),
        textSearch: generateSearchTerms(`${sku} ${name} ${cat} ${type} ${usageType}`)
      }
    };

    if (data.price !== undefined) {
      nextEntityData.price = roundCurrency(data.price);
    }
    if (data.purchasePrice !== undefined) {
      nextEntityData.purchasePrice = roundCurrency(data.purchasePrice);
    }

    const payload = cleanUndefined(nextEntityData);
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
