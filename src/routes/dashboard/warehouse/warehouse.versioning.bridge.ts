import type { FieldSemanticsType } from '$lib/services/versioningService';

export const WAREHOUSE_FIELD_LABELS: Record<string, string> = {
  'supplierNumber': 'Codice Fornitore',
  'companyName': 'Ragione Sociale Fornitore',
  'vatNumber': 'Partita IVA',
  'taxCode': 'Codice Fiscale',
  'poNumber': 'Numero Ordine di Acquisto',
  'status': 'Stato Ordine',
  'totalNetAmount': 'Totale Imponibile (€)',
  'totalVatAmount': 'Totale IVA (€)',
  'totalGrossAmount': 'Totale Lordo (€)',
  'orderDate': 'Data Ordine',
  'expectedDeliveryDate': 'Data Prevista Consegna',
  'stockQty': 'Giacenza Fisica',
  'availableQty': 'Disponibilità Magazzino',
  'avgUnitCost': 'Costo Medio Ponderato (CMP)',
  'totalValuation': 'Valore Totale Stock (€)',
  'movementNumber': 'Numero Movimento',
  'movementType': 'Tipo Movimento',
  'quantity': 'Quantità Movimentata'
};

export const WAREHOUSE_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'supplierNumber': 'ABSOLUTE',
  'companyName': 'ABSOLUTE',
  'vatNumber': 'ABSOLUTE',
  'poNumber': 'ABSOLUTE',
  'status': 'ABSOLUTE',
  'totalNetAmount': 'ABSOLUTE',
  'totalGrossAmount': 'ABSOLUTE',
  'stockQty': 'ADDITIVE',
  'availableQty': 'ADDITIVE',
  'quantity': 'ADDITIVE',
  'avgUnitCost': 'ABSOLUTE',
  'totalValuation': 'ADDITIVE'
};

export class WarehouseVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return WAREHOUSE_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return WAREHOUSE_SEMANTICS_MAP;
  }

  static getEntityLabel(data: any): string {
    if (!data) return 'Magazzino';
    const orig = data.original || data;
    if (orig.poNumber) return `[${orig.poNumber}] ${orig.supplierName || 'Ordine'}`;
    if (orig.supplierNumber) return `[${orig.supplierNumber}] ${orig.companyName || 'Fornitore'}`;
    if (orig.productName) return `[Stock] ${orig.productName} (${orig.stockQty || 0} ${orig.unit || 'pz'})`;
    if (orig.movementNumber) return `[Movimento ${orig.movementNumber}] ${orig.productName || ''}`;
    return data.id || 'Articolo Magazzino';
  }
}
