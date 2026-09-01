import type { FieldSemanticsType } from '$lib/services/versioningService';

export const CONTRACT_FIELD_LABELS: Record<string, string> = {
  'contractNumber': 'Numero Contratto / Preventivo',
  'title': 'Oggetto / Titolo',
  'clientId': 'ID Cliente',
  'clientName': 'Ragione Sociale Cliente',
  'status': 'Stato Contratto',
  'totalAmount': 'Importo Totale (€)',
  'agentId': 'Agente / Commerciale',
  'agentName': 'Nome Agente',
  'coSellerUid': 'Co-Venditore',
  'coSellerShare': 'Quota Co-Venditore (%)',
  'coSellerEmail': 'Email Co-Venditore',
  'items': 'Righe Articoli / Servizi',
  'notes': 'Note Interne',
  'expiryDate': 'Data Scadenza',
  'signedDate': 'Data Sottoscrizione',
  'original.contractNumber': 'Numero Contratto',
  'original.title': 'Oggetto / Titolo',
  'original.clientId': 'ID Cliente',
  'original.clientName': 'Ragione Sociale Cliente',
  'original.status': 'Stato Contratto',
  'original.totalPrice': 'Importo Totale (€)',
  'original.vendorUid': 'Agente / Commerciale',
  'original.products': 'Righe Articoli / Servizi'
};

export const CONTRACT_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'contractNumber': 'ABSOLUTE',
  'title': 'ABSOLUTE',
  'clientId': 'ABSOLUTE',
  'clientName': 'ABSOLUTE',
  'status': 'ABSOLUTE',
  'totalAmount': 'ABSOLUTE',
  'agentId': 'ABSOLUTE',
  'agentName': 'ABSOLUTE',
  'coSellerUid': 'ABSOLUTE',
  'coSellerShare': 'ABSOLUTE',
  'coSellerEmail': 'ABSOLUTE',
  'items': 'ABSOLUTE',
  'expiryDate': 'ABSOLUTE',
  'signedDate': 'ABSOLUTE',
  'original.status': 'ABSOLUTE',
  'original.totalPrice': 'ABSOLUTE'
};

export class ContractsVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return CONTRACT_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return CONTRACT_SEMANTICS_MAP;
  }

  static getEntityLabel(contractData: any): string {
    if (!contractData) return 'Contratto';
    const orig = contractData.original || contractData;
    const num = orig.contractNumber ? `[${orig.contractNumber}] ` : '';
    const title = orig.title || orig.clientName || contractData.id || 'Contratto';
    return `${num}${title}`.trim();
  }
}
