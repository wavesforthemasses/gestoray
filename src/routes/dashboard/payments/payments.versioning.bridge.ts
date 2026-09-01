import type { FieldSemanticsType } from '$lib/services/versioningService';

export const PAYMENT_FIELD_LABELS: Record<string, string> = {
  'paymentNumber': 'Numero Incasso / Ricevuta',
  'clientId': 'ID Cliente',
  'clientName': 'Ragione Sociale Cliente',
  'grossAmount': 'Importo Lordo Incassato (€)',
  'vatRate': 'Aliquota IVA (%)',
  'vatAmount': 'Quota IVA (€)',
  'netAmount': 'Imponibile Netto (€)',
  'paymentDate': 'Data Incasso',
  'method': 'Metodo di Pagamento',
  'transactionReference': 'Riferimento Transazione (CRO / TRN)',
  'status': 'Stato Pagamento',
  'notes': 'Note Interne',
  'contractId': 'ID Contratto Collegato',
  'installmentId': 'ID Rata Collegata',
  'contractAllocations': 'Allocazioni Contrattuali'
};

export const PAYMENT_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'paymentNumber': 'ABSOLUTE',
  'clientId': 'ABSOLUTE',
  'clientName': 'ABSOLUTE',
  'grossAmount': 'ABSOLUTE',
  'vatRate': 'ABSOLUTE',
  'vatAmount': 'ABSOLUTE',
  'netAmount': 'ABSOLUTE',
  'paymentDate': 'ABSOLUTE',
  'method': 'ABSOLUTE',
  'transactionReference': 'ABSOLUTE',
  'status': 'ABSOLUTE',
  'contractId': 'ABSOLUTE',
  'installmentId': 'ABSOLUTE'
};

export class PaymentsVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return PAYMENT_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return PAYMENT_SEMANTICS_MAP;
  }

  static getEntityLabel(paymentData: any): string {
    if (!paymentData) return 'Incasso';
    const orig = paymentData.original || paymentData;
    const num = orig.paymentNumber ? `[${orig.paymentNumber}] ` : '';
    const client = orig.clientName || paymentData.id || 'Incasso';
    return `${num}${client}`.trim();
  }
}
