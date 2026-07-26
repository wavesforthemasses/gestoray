import { db, collection, writeBatch, doc } from '$lib/firebase';
import type { ImportModuleSpec, ConflictStrategy } from '$lib/types/importTypes';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
import { uuidv7 } from 'uuidv7';

export function normalizeUnitOfMeasure(rawUnit: string): string {
  const res = UnitsOfMeasureService.resolveUnitSync(rawUnit);
  return res.canonicalCode;
}

export const productsImportSpec: ImportModuleSpec = {
  entityType: 'products',
  label: 'Catalogo Prodotti & Servizi',
  collectionName: 'products',
  prerequisites: [],
  lookupKeys: ['id', 'sku', 'name'],
  fields: [
    {
      key: 'id',
      label: 'ID Prodotto / Codice Univoco (Opzionale)',
      type: 'string',
      required: false,
      description: 'ID univoco del documento Firestore. Se non fornito, viene generato automaticamente.'
    },
    {
      key: 'name',
      label: 'Nome Prodotto / Servizio',
      type: 'string',
      required: true
    },
    {
      key: 'sku',
      label: 'Codice SKU',
      type: 'string',
      required: false,
      defaultValue: '',
      autoGenerators: [
        {
          key: '__sku_seq',
          label: 'Codice Progressivo (PROD-001, PROD-002...)',
          generate: (idx) => `PROD-${String(idx + 1).padStart(4, '0')}`
        }
      ]
    },
    {
      key: 'category',
      label: 'Categoria',
      type: 'string',
      required: false,
      defaultValue: 'Generale'
    },
    {
      key: 'price',
      label: 'Prezzo (€ / Suggerito)',
      type: 'currency',
      required: false,
      defaultValue: 0
    },
    {
      key: 'unit',
      label: 'Unità di Misura',
      type: 'string',
      required: false,
      defaultValue: 'pz',
      description: 'Normalizza automatica di valori tipo Pezzi -> pz, Kili -> kg, Metri -> m, Ore -> ora'
    },
    {
      key: 'stockQty',
      label: 'Giacenza / Quantità',
      type: 'number',
      required: false,
      defaultValue: 0
    },
    {
      key: 'description',
      label: 'Descrizione / Note',
      type: 'string',
      required: false,
      defaultValue: ''
    }
  ],

  processBatch: async (
    rows: Record<string, any>[],
    sessionMap: Record<string, string>,
    conflictStrategy: ConflictStrategy
  ) => {
    const batch = writeBatch(db);
    let succeeded = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];
    const createdMap: Record<string, string> = {};

    rows.forEach((row, idx) => {
      try {
        const legacySku = row.sku || row.name;
        const explicitId = (row.id || '').trim();
        const targetId = explicitId || ((conflictStrategy === 'upsert' && legacySku) ? legacySku : uuidv7());

        const docRef = doc(collection(db, 'products'), targetId);
        const name = (row.name || '').trim();
        const sku = (row.sku || '').trim();
        const unit = normalizeUnitOfMeasure(row.unit);

        const rawStock = typeof row.stockQty === 'number' ? row.stockQty : parseFloat(String(row.stockQty || 0).replace(',', '.'));
        const cleanStock = isNaN(rawStock) ? 0 : UnitsOfMeasureService.roundQuantity(rawStock, unit);

        const rawPrice = typeof row.price === 'number' ? row.price : parseFloat(String(row.price || 0).replace(',', '.'));
        const cleanPrice = isNaN(rawPrice) ? 0 : UnitsOfMeasureService.roundQuantity(rawPrice, 'eur');

        const productDoc = {
          sku,
          name,
          category: row.category || 'Generale',
          price: cleanPrice,
          unit,
          stockQty: cleanStock,
          description: row.description || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          derived: {
            textSearch: [name.toLowerCase(), sku.toLowerCase(), (row.category || '').toLowerCase()].filter(Boolean)
          }
        };

        batch.set(docRef, productDoc, { merge: conflictStrategy === 'upsert' });
        succeeded++;

        if (explicitId || legacySku) {
          createdMap[explicitId || legacySku] = targetId;
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: idx, error: err.message || 'Errore salvataggio prodotto' });
      }
    });

    await batch.commit();

    try {
      await CacheLookupService.rebuildCacheForType('products');
    } catch (e) {
      console.warn('[productsImportSpec] Cache rebuild warning:', e);
    }

    return { succeeded, failed, errors, createdMap };
  }
};
