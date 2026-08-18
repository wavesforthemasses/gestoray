export type ClientStatus = 'prospect' | 'contacted' | 'proposal_sent' | 'customer' | 'churned';

export interface ClientOriginal {
  // Ragione Sociale & Anagrafica Base
  nome: string;
  cognome?: string;
  email?: string;
  phone?: string;
  website?: string;
  createdBy?: string;
  assignedAdminId?: string;
  status?: ClientStatus | string;

  // Identificativi Fiscali & ERP
  fiscalId?: string;
  partitaIva?: string;
  codiceFiscale?: string;
  clientCode?: string;
  clientGroup?: string;
  certificationStatus?: string;
  isItalianSubject?: boolean;

  // SDI, PEC & Dati Bancari
  sdiCode?: string;
  pec?: string;
  iban?: string;
  bankName?: string;
  paymentTerms?: string;
  mainPhone?: string;

  // Referenti Rapidi
  referenteTecnico?: string;
  telReferente?: string;
  emailContatto?: string;
  emailAlternativa?: string;

  // Affidabilità & Credito
  crifCheck?: string;
  riskClass?: string;
  maxCredit?: number;
  residualCredit?: number;
  paymentStatus?: string;

  // Note ERP & Preventivo
  internalAdminNotes?: string;
  quoteAutoNotes?: string;
  notes?: string[];

  // Sede Principale / Operativa
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  // Sede Legale / Fatturazione
  billingAddress?: string;
  billingCity?: string;
  billingProvince?: string;
  billingPostalCode?: string;
  billingCountry?: string;

  // Sede Spedizione / Cantiere
  shippingAddress?: string;
  shippingCity?: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;

  // Campi personalizzati estensibili
  customFields?: Record<string, any>;
}

export interface ClientDerived {
  textSearch?: string[];
  deleted?: boolean;
  activitiesCount?: number;
  contractsCount?: number;
  cacheChunkId?: string;
}

export interface ClientEdits {
  createdAt?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  aggregateVersion?: number;
  lastLedgerId?: string;
}

export interface ClientItem {
  id: string;
  original: ClientOriginal;
  derived?: ClientDerived;
  edits?: ClientEdits;
}

export interface ClientListItem {
  id: string;
  nome: string;
  cognome?: string;
  email?: string;
  phone?: string;
  status: string;
  clientCode?: string;
  clientGroup?: string;
  certificationStatus?: string;
  isItalianSubject?: boolean;
  partitaIva?: string;
  codiceFiscale?: string;
  sdiCode?: string;
  pec?: string;
  paymentTerms?: string;
  iban?: string;
  referenteTecnico?: string;
  telReferente?: string;
  emailContatto?: string;
  emailAlternativa?: string;
  crifCheck?: string;
  riskClass?: string;
  maxCredit?: number;
  residualCredit?: number;
  paymentStatus?: string;
  internalAdminNotes?: string;
  quoteAutoNotes?: string;
  notes?: string[];
  createdBy?: string;
  createdAt: string;
  derived: ClientDerived;
}
