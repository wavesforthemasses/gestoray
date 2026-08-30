export type ContractType = 'Ricorrente' | 'Non Ricorrente';
export type ContractStatus = 'bozza' | 'inviato' | 'in_approvazione' | 'approvato' | 'attivo' | 'accettato' | 'in_scadenza' | 'scaduto' | 'rifiutato' | 'sospeso' | 'draft' | 'pending' | 'approved';
export type RecurringFrequency = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale' | 'una_usa';
export type NonRecurringEndDateMode = 'hidden' | 'optional' | 'required';

export interface ContractInstallment {
  id?: string;
  installmentNumber: number;
  dueDate: string;          // YYYY-MM-DD
  expectedAmount: number;   // Importo dovuto
  amount?: number;          // Alias retrocompatibilità (uguale a expectedAmount)
  paidAmount?: number;      // Importo effettivamente incassato
  paidAt?: string;          // Data ISO 8601 dell'incasso
  status: 'in_attesa' | 'pagato' | 'scaduto' | 'annullato' | 'pending' | 'paid';
  notes?: string;
  original?: any;           // Supporto retrocompatibilità
}

export interface ContractProductItem {
  productId: string;
  productName: string;
  name?: string;            // Alias per retrocompatibilità
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
  
  // Co-Selling
  coSellerUid?: string;
  coSellerEmail?: string;
  coSellerName?: string;
  coSellerShare?: number; // Quota percentuale co-venditore (es. 30%)

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
  hasPriceWarning?: boolean;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  original?: any; // Supporto retrocompatibilità
  edits?: {
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    approvedAt?: string;
    approvedBy?: string;
    approvedEmail?: string;
  };
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
    totalPaid?: number;
    totalRemaining?: number;
    paymentsCount?: number;
    installmentsCount?: number;
    paidInstallmentsCount?: number;
    overdueInstallmentsCount?: number;
    nextInstallmentDate?: string | null;
    nextInstallmentAmount?: number | null;
    commissionTotal?: number;
    commissionPrimary?: number;
    commissionSecondary?: number;
  };
}
