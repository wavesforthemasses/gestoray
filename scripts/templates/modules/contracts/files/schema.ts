export type ContractType = 'Ricorrente' | 'Non Ricorrente';
export type ContractStatus = 'bozza' | 'inviato' | 'attivo' | 'accettato' | 'in_scadenza' | 'scaduto' | 'rifiutato' | 'sospeso';
export type RecurringFrequency = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale' | 'una_usa';
export type NonRecurringEndDateMode = 'hidden' | 'optional' | 'required';

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
  description?: string;
  unit?: string;
  quantity: number;
  listPrice: number;
  minPrice?: number;
  priceSold: number;
  subtotal: number;
  isOptional?: boolean;
  minimoFatturabileText?: string;
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
  allowedTypes?: ContractType[];
  defaultType?: ContractType;
  defaultInitialStatus?: ContractStatus;
  defaultTermsAndConditions?: string;
  nonRecurringEndDateMode?: NonRecurringEndDateMode;
  enableProjectsBridge?: boolean;
  enablePlacesBridge?: boolean;
}

export interface ContractItem {
  id?: string;
  contractNumber: string;
  title: string;
  clientId: string;
  clientName: string;
  agentId?: string;
  agentName?: string;
  projectId?: string;
  projectName?: string;
  placeId?: string;
  placeName?: string;
  type: ContractType;
  billingFrequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  status: ContractStatus;
  notes?: string;
  clientNotes?: string;
  adminNotes?: string;
  termsAndConditions?: string;
  items?: ContractProductItem[];
  tags?: string[];
  taxableAmount?: number;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  discountAmount?: number;
  totalAmount: number;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
