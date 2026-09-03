export type InvoiceType = 
  | 'TD01' // Fattura ordinaria
  | 'TD02' // Fattura di acconto
  | 'TD04' // Nota di credito (storno)
  | 'TD05' // Nota di debito
  | 'TD06' // Parcella / Notula professionale
  | 'TD24' // Fattura differita (da bolle / DDT / interventi)
  | 'PROFORMA'; // Documento pro-forma interno non fiscale

export type InvoiceStatus = 
  | 'bozza'
  | 'emessa'
  | 'inviata_sdi'
  | 'consegnata'
  | 'mancata_consegna'
  | 'scartata'
  | 'annullata';

export type PaymentStatus = 
  | 'non_pagata'
  | 'pagata_parziale'
  | 'pagata_saldata';

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  vatRate: number;
  natureCode?: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  bollaId?: string;
  bollaNumber?: string;
  bollaDate?: string;
  productId?: string;
  entryType?: 'labor' | 'material' | 'equipment' | 'service' | 'deduction' | 'other';
}

export interface CastellettoItem {
  rate: number;
  natureCode?: string;
  normativeRef?: string;
  taxableAmount: number;
  vatAmount: number;
}

export interface InvoiceItem {
  id?: string;
  tenantId?: string;
  invoiceNumber: string; // Es. "146/2026" oppure "42/NC"
  number: number;        // Progressivo numerico puro (146)
  year: number;          // Anno di esercizio (2026)
  sezionaleId: string;   // ID del sezionale ("default", "NC", "PA")
  sezionaleCode: string; // Codice visuale ("", "/NC", "/PA")
  type: InvoiceType;
  status: InvoiceStatus;
  date: string;          // YYYY-MM-DD
  dueDate: string;       // YYYY-MM-DD

  clientId: string;
  clientName: string;
  clientVatNumber?: string;
  clientTaxCode?: string;
  clientSdiCode?: string; // 7 caratteri (default "0000000")
  clientPec?: string;
  clientAddress?: string;
  clientCap?: string;
  clientCity?: string;
  clientProvince?: string;
  clientCountry?: string; // Es. "IT"

  lines: InvoiceLine[];
  castelletto: CastellettoItem[];

  totalNet: number;
  totalVat: number;
  totalGross: number;

  // Trattamenti fiscali specifici PMI / Professionisti
  pensionFundRate?: number;       // Rivalsa Cassa (es. 4%)
  pensionFundAmount?: number;
  withholdingTaxRate?: number;    // Ritenuta d'acconto (es. 20%)
  withholdingTaxAmount?: number;
  isSplitPayment?: boolean;       // Scissione pagamenti PA
  splitPaymentAmount?: number;
  netToPay: number;               // Totale effettivo dovuto dal cliente

  paymentStatus: PaymentStatus;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;          // "bonifico", "riba", "pos_carta", "contanti"
  iban?: string;
  notes?: string;

  originType?: 'manual' | 'bolle' | 'contract' | 'order';
  bolleIds?: string[];            // ID degli interventi associati
  contractId?: string;
  contractTitle?: string;
  reversedInvoiceId?: string;     // Riferimento alla fattura stornata (per TD04)
  creditNoteInvoiceId?: string;   // Riferimento alla nota di credito che ha stornato questa fattura

  sdiDetails?: {
    xmlGeneratedAt?: string;
    sdiIdentifier?: string;
    transmissionDate?: string;
    deliveryDate?: string;
    rejectDate?: string;
    rejectReason?: string;
  };

  createdAt?: any;
  updatedAt?: any;
  original?: any;
  derived?: any;
  edits?: any;
}

export interface SezionaleConfig {
  id: string;
  code: string; // "", "/NC", "/PA", "/E"
  name: string;
  isDefault?: boolean;
}

export interface AnnualSequenceConfig {
  year: number;
  sezionaleId: string;
  startNumber: number;
  lastAssignedNumber: number;
  pattern: string; // Es. "{NUM}/{YYYY}" o "{NUM}{SEZ}"
}

export interface InvoiceSettings {
  sezionali: SezionaleConfig[];
  documentTypeSezionaleMapping: Record<string, string>; // Es. { TD01: 'default', TD04: 'NC', TD24: 'default' }
  annualSequences: AnnualSequenceConfig[];
  companyInfo: {
    companyName?: string;
    vatNumber?: string;
    taxCode?: string;
    sdiCode?: string;
    pec?: string;
    address?: string;
    cap?: string;
    city?: string;
    province?: string;
    country?: string;
    fiscalRegime?: string; // Es. "RF01" (Ordinario)
    iban?: string;
  };
  entityNaming: {
    documentLabel: string;
    bollaLabel: string;
    accontoLabel: string;
    stornoLabel: string;
  };
  defaultPaymentMethod: string;
  defaultPaymentTermDays: number;
  enableStampDuty2Euro?: boolean; // Disattivato di default per forfettari
  updatedAt?: string;
}
