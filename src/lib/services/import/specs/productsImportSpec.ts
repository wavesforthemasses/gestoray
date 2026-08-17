import { db, collection, writeBatch, doc } from '$lib/firebase';
import type { ImportModuleSpec, ConflictStrategy } from '$lib/types/importTypes';
import type { ProductType, BillingType } from '../../../../routes/dashboard/products/schema';
export interface MinimoFatturabileConfig {
  enabled: boolean;
  minQuantity?: number | null;
  flatPrice?: number | null;
  unitCode?: string | null;
  displayText?: string | null;
  value?: number | null;
  type?: 'quantita' | 'prezzo' | 'percentuale';
  applyTo?: 'riga' | 'totale_documento';
}
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
import { uuidv7 } from 'uuidv7';

export function normalizeUnitOfMeasure(rawUnit: string): string {
  const res = UnitsOfMeasureService.resolveUnitSync(rawUnit);
  return res.canonicalCode;
}

export function parseProductType(raw: any): { type: ProductType; error?: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { type: 'product' };
  }
  const clean = String(raw).trim().toLowerCase();
  if (['prodotto', 'prod', 'product', 'bene', 'fisico', 'materiale', 'merce', 'articolo'].includes(clean)) {
    return { type: 'product' };
  }
  if (['servizio', 'serv', 'service', 'prestazione', 'manodopera', 'consulenza'].includes(clean)) {
    return { type: 'service' };
  }
  if (['digitale', 'dig', 'digital', 'licenza', 'software', 'download'].includes(clean)) {
    return { type: 'digital' };
  }
  return { 
    type: 'product', 
    error: `Tipo articolo non riconosciuto: "${raw}". Valori ammessi: prodotto, servizio, digitale.` 
  };
}

export function parseBillingType(raw: any): BillingType {
  if (!raw) return 'one_off';
  const clean = String(raw).trim().toLowerCase();
  if (['hourly', 'ora', 'orario', 'a ore', 'all\'ora'].includes(clean)) return 'hourly';
  if (['recurring', 'ricorrente', 'abbonamento', 'canone', 'periodico'].includes(clean)) return 'recurring';
  return 'one_off';
}

export function parseMinimoFatturabile(raw: any): MinimoFatturabileConfig | undefined {
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
      required: true,
      aliases: ['nome', 'titolo', 'prodotto', 'servizio', 'nome prodotto', 'nome servizio', 'descrizione']
    },
    {
      key: 'type',
      label: 'Tipo Articolo',
      type: 'string',
      required: false,
      defaultValue: 'product',
      aliases: ['tipo', 'type', 'natura', 'tipologia', 'bene/servizio', 'tipo articolo', 'tipo_articolo'],
      description: 'Valori accettati: prodotto (bene fisico), servizio, digitale.'
    },
    {
      key: 'sku',
      label: 'Codice SKU',
      type: 'string',
      required: false,
      defaultValue: '',
      aliases: ['codice', 'codice sku', 'sku', 'art', 'articolo', 'codice articolo'],
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
      defaultValue: 'Generale',
      aliases: ['categoria', 'gruppo', 'gruppo prodotto', 'famiglia']
    },
    {
      key: 'price',
      label: 'Prezzo (€ / Suggerito)',
      type: 'currency',
      required: false,
      defaultValue: 0,
      aliases: ['prezzo', 'prezzo unitario', 'prezzo suggerito', 'listino', 'importo', 'costo', 'tariffa']
    },
    {
      key: 'unit',
      label: 'Unità di Misura',
      type: 'string',
      required: false,
      defaultValue: 'pz',
      aliases: ['unita', 'unità', 'unita di misura', 'unità di misura', 'um', 'u.m.'],
      description: 'Normalizzazione automatica di valori tipo Pezzi -> pz, Kili -> kg, Metri -> m, Ore -> ora'
    },
    {
      key: 'trackStock',
      label: 'Monitoraggio Giacenza',
      type: 'boolean',
      required: false,
      defaultValue: true,
      aliases: ['gestisci giacenza', 'traccia stock', 'track stock', 'gestione magazzino', 'track_stock'],
      description: 'Se disattivato, l\'articolo non viene monitorato a magazzino (default per servizi).'
    },
    {
      key: 'stockQty',
      label: 'Giacenza / Quantità Iniziale',
      type: 'number',
      required: false,
      defaultValue: 0,
      aliases: ['giacenza', 'quantita', 'quantità', 'stock', 'qta', 'qtà', 'giacenza iniziale']
    },
    {
      key: 'minStockThreshold',
      label: 'Soglia Scorta Minima',
      type: 'number',
      required: false,
      defaultValue: 0,
      aliases: ['scorta minima', 'soglia minima', 'min stock', 'scorta_minima', 'min_stock_threshold', 'sottoscorta']
    },
    {
      key: 'allowOutOfStockSale',
      label: 'Vendita Sottoscorta (Backorder)',
      type: 'boolean',
      required: false,
      defaultValue: true,
      aliases: ['vendibile sottoscorta', 'backorder', 'preordine', 'allow_out_of_stock_sale']
    },
    {
      key: 'billingType',
      label: 'Modello Tariffazione',
      type: 'string',
      required: false,
      defaultValue: 'one_off',
      aliases: ['tipo fatturazione', 'tariffazione', 'billing type', 'billing_type', 'tipo tariffazione', 'ricorrenza']
    },
    {
      key: 'minimoFatturabile',
      label: 'Minimo Fatturabile',
      type: 'string',
      required: false,
      defaultValue: '',
      aliases: ['minimo fatturabile', 'minimo', 'minimo ordine'],
      description: 'Condizione o testo minimo fatturabile (es. "Sotto i 20 mc 7000€" oppure "20 mc = 7000€")'
    },
    {
      key: 'description',
      label: 'Descrizione / Note',
      type: 'string',
      required: false,
      defaultValue: '',
      aliases: ['descrizione lunga', 'note', 'dettaglio', 'descrizione']
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
        const typeResult = parseProductType(row.type);
        if (typeResult.error) {
          throw new Error(typeResult.error);
        }
        const productType = typeResult.type;

        const legacySku = row.sku || row.name;
        const explicitId = String(row.id || '').trim();
        const targetId = explicitId || ((conflictStrategy === 'upsert' && legacySku) ? String(legacySku).trim() : uuidv7());

        const docRef = doc(collection(db, 'products'), targetId);
        const name = String(row.name || '').trim();
        const sku = String(row.sku || '').trim();
        const unit = normalizeUnitOfMeasure(row.unit || (productType === 'service' ? 'ora' : 'pz'));

        // Smart stock determination
        const hasExplicitTrackStock = row.trackStock !== undefined && row.trackStock !== null && row.trackStock !== '';
        const trackStock = hasExplicitTrackStock 
          ? Boolean(row.trackStock === true || String(row.trackStock).toLowerCase() === 'true' || String(row.trackStock) === '1' || String(row.trackStock).toLowerCase() === 'si' || String(row.trackStock).toLowerCase() === 'sì')
          : (productType === 'product');

        const rawStock = typeof row.stockQty === 'number' ? row.stockQty : parseFloat(String(row.stockQty || 0).replace(',', '.'));
        const cleanStock = isNaN(rawStock) ? 0 : UnitsOfMeasureService.roundQuantity(rawStock, unit);

        const rawMinStock = typeof row.minStockThreshold === 'number' ? row.minStockThreshold : parseFloat(String(row.minStockThreshold || 0).replace(',', '.'));
        const cleanMinStock = isNaN(rawMinStock) ? 0 : UnitsOfMeasureService.roundQuantity(rawMinStock, unit);

        const allowOutOfStockSale = row.allowOutOfStockSale !== undefined && row.allowOutOfStockSale !== null && row.allowOutOfStockSale !== ''
          ? Boolean(row.allowOutOfStockSale === true || String(row.allowOutOfStockSale).toLowerCase() === 'true' || String(row.allowOutOfStockSale) === '1' || String(row.allowOutOfStockSale).toLowerCase() === 'si' || String(row.allowOutOfStockSale).toLowerCase() === 'sì')
          : true;

        const billingType = parseBillingType(row.billingType || (productType === 'service' ? 'hourly' : 'one_off'));

        const rawPrice = typeof row.price === 'number' ? row.price : parseFloat(String(row.price || 0).replace(',', '.'));
        const cleanPrice = isNaN(rawPrice) ? 0 : UnitsOfMeasureService.roundQuantity(rawPrice, 'eur');

        const parsedMinimo = parseMinimoFatturabile(row.minimoFatturabile || row.minimo_fatturabile);

        const productDoc: Record<string, any> = {
          sku,
          name,
          category: row.category || 'Generale',
          type: productType,
          price: cleanPrice,
          unit,
          trackStock,
          stockQty: trackStock ? cleanStock : 0,
          minStockThreshold: cleanMinStock,
          allowOutOfStockSale,
          billingType,
          description: row.description || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          derived: {
            textSearch: [name.toLowerCase(), sku.toLowerCase(), (row.category || '').toLowerCase(), productType].filter(Boolean)
          }
        };

        if (parsedMinimo) {
          productDoc.minimoFatturabile = parsedMinimo;
        }

        batch.set(docRef, productDoc, { merge: conflictStrategy === 'upsert' });
        succeeded++;

        if (explicitId || legacySku) {
          createdMap[explicitId || legacySku] = targetId;
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: idx + 1, error: err.message || 'Errore salvataggio prodotto' });
      }
    });

    if (succeeded > 0) {
      await batch.commit();
      try {
        await CacheLookupService.rebuildCacheForType('products');
      } catch (e) {
        console.warn('[productsImportSpec] Cache rebuild warning:', e);
      }
    }

    return { succeeded, failed, errors, createdMap };
  }
};
