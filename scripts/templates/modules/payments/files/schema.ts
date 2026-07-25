export type PaymentMethod = 'bonifico' | 'carta' | 'rid' | 'contanti' | 'assegno';
export type PaymentStatus = 'in_attesa' | 'pagato' | 'scaduto' | 'stornato';

export interface PaymentItem {
  id?: string;
  paymentNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  status: PaymentStatus;
  notes?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
