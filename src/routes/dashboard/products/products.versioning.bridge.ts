import type { FieldSemanticsType } from '$lib/services/versioningService';

export const PRODUCT_FIELD_LABELS: Record<string, string> = {
  'sku': 'Codice SKU',
  'name': 'Nome Prodotto / Servizio',
  'category': 'Categoria',
  'type': 'Tipo Articolo',
  'price': 'Prezzo Unitario (€)',
  'unit': 'Unità di Misura',
  'trackStock': 'Monitoraggio Giacenza',
  'stockQty': 'Giacenza Magazzino',
  'minStockThreshold': 'Soglia Scorta Minima',
  'allowOutOfStockSale': 'Vendita Sottoscorta (Backorder)',
  'billingType': 'Modello Tariffazione',
  'recurrenceInterval': 'Intervallo Ricorrenza',
  'description': 'Descrizione',
  'minimoFatturabile.enabled': 'Minimo Fatturabile Abilitato',
  'minimoFatturabile.minQuantity': 'Quantità Minima Fatturabile',
  'minimoFatturabile.flatPrice': 'Prezzo Fisso Minimo (€)',
  'minimoFatturabile.displayText': 'Dicitura Minimo Fatturabile',
  'original.sku': 'Codice SKU',
  'original.name': 'Nome Prodotto / Servizio',
  'original.category': 'Categoria',
  'original.type': 'Tipo Articolo',
  'original.price': 'Prezzo Unitario (€)',
  'original.unit': 'Unità di Misura',
  'original.trackStock': 'Monitoraggio Giacenza',
  'original.stockQty': 'Giacenza Magazzino',
  'original.minStockThreshold': 'Soglia Scorta Minima',
  'original.allowOutOfStockSale': 'Vendita Sottoscorta (Backorder)',
  'original.billingType': 'Modello Tariffazione',
  'original.recurrenceInterval': 'Intervallo Ricorrenza',
  'original.description': 'Descrizione',
  'original.minimoFatturabile.enabled': 'Minimo Fatturabile Abilitato',
  'original.minimoFatturabile.minQuantity': 'Quantità Minima Fatturabile',
  'original.minimoFatturabile.flatPrice': 'Prezzo Fisso Minimo (€)',
  'original.minimoFatturabile.displayText': 'Dicitura Minimo Fatturabile'
};

export const PRODUCT_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'price': 'ABSOLUTE',
  'stockQty': 'ABSOLUTE',
  'type': 'ABSOLUTE',
  'trackStock': 'ABSOLUTE',
  'minStockThreshold': 'ABSOLUTE',
  'allowOutOfStockSale': 'ABSOLUTE',
  'billingType': 'ABSOLUTE',
  'recurrenceInterval': 'ABSOLUTE',
  'original.price': 'ABSOLUTE',
  'original.stockQty': 'ABSOLUTE',
  'original.type': 'ABSOLUTE',
  'original.trackStock': 'ABSOLUTE',
  'original.minStockThreshold': 'ABSOLUTE',
  'original.allowOutOfStockSale': 'ABSOLUTE',
  'original.billingType': 'ABSOLUTE',
  'original.recurrenceInterval': 'ABSOLUTE'
};

export class ProductsVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return PRODUCT_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return PRODUCT_SEMANTICS_MAP;
  }

  static getEntityLabel(productData: any): string {
    if (!productData) return 'Prodotto / Servizio';
    const orig = productData.original || productData;
    const sku = orig.sku ? `[${orig.sku}] ` : '';
    const name = orig.name || productData.id || 'Articolo';
    return `${sku}${name}`.trim();
  }
}
