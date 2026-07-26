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
  price: number;
  unit: string; // 'pz', 'kg', 'm', 'l', 'ora', 'mc', 'mq', etc.
  stockQty: number;
  description?: string;
  minimoFatturabile?: MinimoFatturabileConfig;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
