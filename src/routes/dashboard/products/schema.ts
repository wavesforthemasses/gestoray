export interface ProductItem {
  id?: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  unit: string; // 'pz', 'kg', 'm', 'l', 'ora'
  stockQty: number;
  description?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
