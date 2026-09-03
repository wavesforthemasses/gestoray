import type { InvoiceItem, InvoiceStatus } from '../schema';

export interface TransmissionResult {
  success: boolean;
  transmissionId?: string;
  sdiIdentifier?: string;
  error?: string;
}

export interface SyncUpdate {
  invoiceId: string;
  status: InvoiceStatus;
  deliveryDate?: string;
  rejectDate?: string;
  rejectReason?: string;
}

export interface ImportSummary {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface InvoiceBridgePort {
  readonly id: string;
  readonly name: string;

  /**
   * Genera la stringa XML conforme allo standard ministeriale
   */
  generateXml(invoice: InvoiceItem, companyInfo?: any): Promise<string>;

  /**
   * Converte un file XML in un oggetto InvoiceItem strutturato
   */
  parseXml(xmlContent: string): Promise<Partial<InvoiceItem>>;

  /**
   * Trasmette il documento allo SDI o al canale esterno
   */
  transmitInvoice(invoice: InvoiceItem): Promise<TransmissionResult>;

  /**
   * Esegue il polling per verificare notifiche di recapito o scarto
   */
  pollSyncUpdates(): Promise<SyncUpdate[]>;

  /**
   * Importa massivamente file XML storici
   */
  importBatch(files: Array<{ name: string; content: string }>): Promise<ImportSummary>;
}
