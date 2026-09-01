export type ProductType = 'product' | 'service' | 'digital';
export type BillingType = 'one_off' | 'hourly' | 'recurring';
export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ProductUsageType = 'both' | 'sale' | 'purchase';

export interface MinimoFatturabileConfig {
  enabled: boolean;
  minQuantity?: number | null; // Quantità soglia (es. 20)
  flatPrice?: number | null;   // Prezzo fisso applicato se Q < minQuantity (es. 7000)
  displayText?: string;       // Dicitura libera/importata (es. "Sotto i 20 mc 7000€")
}

export interface ProductItem {
  id?: string;
  sku: string;
  name: string;
  category: string;
  type?: ProductType; // 'product' (default) | 'service' | 'digital'
  price: number;      // Prezzo di vendita di listino al cliente
  purchasePrice?: number; // Prezzo/costo indicativo di acquisto da fornitore
  unit: string;       // 'pz', 'kg', 'm', 'l', 'ora', 'mc', 'mq', 'giorno', 'mese', 'forfait', etc.
  
  // Destinazione d'Uso & Disponibilità nei Moduli (Vendita / Acquisto / Entrambi)
  usageType?: ProductUsageType; // 'both' (default) | 'sale' | 'purchase'
  canBeSold?: boolean;          // true se disponibile per preventivi/contratti clienti (default true)
  canBePurchased?: boolean;     // true se disponibile per ordini fornitore PO (default true)

  // Gestione Giacenza & Scorte (Disaccoppiata)
  trackStock?: boolean;             // Se false, nessun monitoraggio di giacenza (default true per product, false per service/digital)
  stockQty?: number;                // Giacenza numerica (può essere <= 0 con backorder, default 0)
  minStockThreshold?: number;       // Soglia scorta minima per alert
  allowOutOfStockSale?: boolean;    // true: vendibile anche se <= 0 (backorder); false: bloccato se esaurito
  
  // Modello di Tariffazione
  billingType?: BillingType;        // 'one_off' | 'hourly' | 'recurring'
  recurrenceInterval?: RecurrenceInterval; // 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  
  description?: string;
  minimoFatturabile?: MinimoFatturabileConfig;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
    deleted?: boolean;
  };
}
