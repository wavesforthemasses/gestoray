export type ContractType = 'Canone Ricorrente' | 'Monte Ore' | 'SLA Garantito' | 'Licenza / Abbonamento' | 'Fornitura / Quotazione';
export type ContractStatus = 'attivo' | 'in_scadenza' | 'scaduto' | 'sospeso';
export type RecurringFrequency = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale' | 'una_una';

export interface ContractInstallment {
  id?: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: 'in_attesa' | 'pagato' | 'scaduto';
  notes?: string;
}

export interface ContractProductItem {
  productId: string;
  productName: string;
  unit?: string;
  listPrice: number;
  minPrice?: number;
  priceSold: number;
  quantity: number;
  subtotal: number;
  notes?: string;
}

export interface ContractSettings {
  entityNaming: 'contract' | 'quote'; // 'contract' => "Contratti/Contratto", 'quote' => "Preventivi/Preventivo"
  prefix: string; // e.g. "CTR-" or "PREV-" or ""
  includeYear: boolean; // e.g. true => "CTR-2026-0001"
  numberPadding: number; // e.g. 4
  lastNumber: number; // progressive counter
  resetCounterAnnually: boolean;
  lastCounterYear?: number;
}

export interface ContractItem {
  id?: string;
  contractNumber: string;
  title: string;
  clientId: string;
  clientName: string;
  type: ContractType;
  totalAmount: number;
  billingFrequency: RecurringFrequency;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  notes?: string;
  items?: ContractProductItem[];
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
