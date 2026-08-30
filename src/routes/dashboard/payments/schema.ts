export type PaymentMethod = string;
export type PaymentStatus = 'registrato' | 'in_verifica' | 'annullato' | 'pagato' | 'stornato';

export interface PaymentAllocationItem {
  contractId: string;
  contractNumber?: string;
  installmentId?: string;
  installmentNumber?: number;
  amount: number;
}

export interface VatRateOption {
  rate: number;
  label: string;
}

export interface PaymentMethodOption {
  id: string;
  label: string;
  enabled: boolean;
  isSystem: boolean;
}

export interface PaymentSettings {
  entityNaming: 'payment' | 'receipt' | 'income'; // 'payment' => "Incassi/Incasso", 'receipt' => "Ricevute/Ricevuta"
  prefix: string; // e.g. "INC-" or "PAY-" or "RIC-"
  includeYear: boolean; // e.g. true => "INC-2026-0001"
  numberPadding: number; // e.g. 4
  lastNumber: number; // progressive counter
  resetCounterAnnually: boolean;
  lastCounterYear?: number;
  defaultVatRate?: number; // e.g. 22
  defaultMethod?: string; // e.g. 'bonifico'
  vatRates?: VatRateOption[];
  paymentMethods?: PaymentMethodOption[];
}

export interface PaymentItem {
  id?: string;
  paymentNumber: string;
  clientId: string;
  clientName: string;

  // Gestione Finanziaria & Scorporo IVA
  grossAmount: number;      // Totale lordo incassato (totale transazione)
  vatRate: number;          // Aliquota IVA percentuale (es. 22, 10, 4, 0)
  vatAmount: number;        // Quota IVA scorporata
  netAmount: number;        // Imponibile netto reale (base calcolo provvigionale e statistico)
  amount?: number;          // Alias retrocompatibilità grossAmount

  paymentDate: string;      // YYYY-MM-DD
  method: PaymentMethod;
  transactionReference?: string; // CRO, TRN, n. assegno o transazione
  status: PaymentStatus;
  notes?: string;

  // Allocazioni opzionali verso contratti (gestite via Dynamic Bridge)
  contractId?: string;      // Riferimento contratto principale opzionale
  installmentId?: string;   // Riferimento rata opzionale
  contractAllocations?: PaymentAllocationItem[];

  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  original?: any;           // Retrocompatibilità
  edits?: {
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    deletedAt?: string;
    deletedBy?: string;
  };
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
    deleted?: boolean;
  };
}
