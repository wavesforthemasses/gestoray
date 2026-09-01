export type SupplierStatus = 'active' | 'inactive';

export interface SupplierItem {
  id: string;
  supplierNumber: string;
  companyName: string;
  vatNumber?: string;
  taxCode?: string;
  email?: string;
  phone?: string;
  pec?: string;
  sdiCode?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  province?: string;
  paymentTerms?: string;
  contactPerson?: string;
  status: SupplierStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  edits?: Record<string, any>;
  original?: Record<string, any>;
  derived?: Record<string, any>;
}

export type PurchaseOrderStatus = 'bozza' | 'inviato' | 'ricevuto_parziale' | 'ricevuto_totale' | 'annullato';

export interface PurchaseOrderItemLine {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  vatRate: number; // e.g. 22, 10, 4
  discountPercent?: number;
  subtotalNet: number;
  subtotalVat: number;
  subtotalGross: number;
}

export interface PurchaseOrderItem {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: PurchaseOrderStatus;
  destinationPlaceId?: string; // Optional placeId (warehouse/site)
  destinationPlaceName?: string;
  items: PurchaseOrderItemLine[];
  totalNetAmount: number;
  totalVatAmount: number;
  totalGrossAmount: number;
  deliveryNotes?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  edits?: Record<string, any>;
  original?: Record<string, any>;
  derived?: Record<string, any>;
}

export interface WarehouseInventoryItem {
  id: string; // composite key: `${productId}_${placeId || 'default'}`
  productId: string;
  productName: string;
  sku: string;
  category?: string;
  unit: string;
  placeId: string; // 'default' or specific placeId
  placeName: string;
  stockQty: number;
  allocatedQty: number;
  availableQty: number; // stockQty - allocatedQty
  minReorderThreshold: number;
  reorderQty?: number;
  avgUnitCost: number; // CMP (Costo Medio Ponderato)
  lastPurchasePrice?: number;
  totalValuation: number; // stockQty * avgUnitCost
  isLowStock: boolean; // stockQty <= minReorderThreshold
  updatedAt?: string;
  edits?: Record<string, any>;
  original?: Record<string, any>;
  derived?: Record<string, any>;
}

export type StockMovementType =
  | 'IN_PURCHASE'      // Carico da Ordine Fornitore / DDT
  | 'IN_INITIAL'       // Inventario Iniziale / Rettifica Positiva
  | 'IN_RETURN'        // Reso da cantiere o cliente
  | 'OUT_SITE_USAGE'   // Scarico per utilizzo in cantiere / luogo
  | 'OUT_SALE'         // Scarico per vendita cliente / contratto
  | 'OUT_SCRAP'        // Scarico per rottamazione / difettoso / scaduto
  | 'TRANSFER';        // Trasferimento interno tra magazzini

export interface StockMovementItem {
  id: string;
  movementNumber: string;
  movementType: StockMovementType;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number; // Always positive magnitude
  unitCost: number;
  totalCost: number;
  fromPlaceId?: string;
  fromPlaceName?: string;
  toPlaceId?: string;
  toPlaceName?: string;
  batchNumber?: string;
  expiryDate?: string;
  movementDate: string;
  performedByUid?: string;
  performedByName?: string;
  relatedDocType?: 'purchase_order' | 'place' | 'contract' | 'manual';
  relatedDocId?: string;
  notes?: string;
  createdAt?: string;
  edits?: Record<string, any>;
  original?: Record<string, any>;
}

export interface WarehouseSettings {
  poPrefix: string;
  movementPrefix: string;
  supplierPrefix: string;
  valuationMethod: 'CMP' | 'FIFO';
  allowNegativeStock: boolean;
  defaultMinThreshold: number;
}
