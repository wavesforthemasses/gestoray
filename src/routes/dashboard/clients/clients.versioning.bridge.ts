import type { FieldSemanticsType } from '$lib/services/versioningService';

export const CLIENT_FIELD_LABELS: Record<string, string> = {
  'original.nome': 'Nome / Ragione Sociale',
  'original.cognome': 'Cognome',
  'original.email': 'Email Principale',
  'original.phone': 'Telefono / Cellulare',
  'original.website': 'Sito Web',
  'original.status': 'Stato Anagrafica',
  'original.fiscalId': 'Identificativo Fiscale',
  'original.partitaIva': 'Partita IVA',
  'original.codiceFiscale': 'Codice Fiscale',
  'original.clientCode': 'Codice Cliente ERP',
  'original.clientGroup': 'Gruppo Cliente',
  'original.certificationStatus': 'Stato Certificazione',
  'original.isItalianSubject': 'Soggetto Italiano (SDI)',
  'original.sdiCode': 'Codice Destinatario SDI',
  'original.pec': 'Indirizzo PEC',
  'original.iban': 'Codice IBAN',
  'original.bankName': 'Istituto Bancario',
  'original.paymentTerms': 'Condizioni di Pagamento',
  'original.mainPhone': 'Telefono Centralino',
  'original.referenteTecnico': 'Referente Tecnico',
  'original.telReferente': 'Telefono Referente',
  'original.emailContatto': 'Email di Contatto',
  'original.emailAlternativa': 'Email Alternativa',
  'original.crifCheck': 'Verifica CRIF',
  'original.riskClass': 'Classe di Rischio',
  'original.maxCredit': 'Fido Massimo Accordato',
  'original.residualCredit': 'Fido Residuo Disponibile',
  'original.paymentStatus': 'Regolarità Pagamenti',
  'original.internalAdminNotes': 'Note Amministrative Interne',
  'original.quoteAutoNotes': 'Note Automatiche Preventivi',
  'original.address': 'Indirizzo Sede Legale',
  'original.city': 'Città',
  'original.province': 'Provincia',
  'original.postalCode': 'CAP',
  'original.country': 'Nazione',
  'original.billingAddress': 'Indirizzo Fatturazione',
  'original.billingCity': 'Città Fatturazione',
  'original.billingProvince': 'Provincia Fatturazione',
  'original.billingPostalCode': 'CAP Fatturazione',
  'original.billingCountry': 'Nazione Fatturazione',
  'original.shippingAddress': 'Indirizzo Spedizione Merci',
  'original.shippingCity': 'Città Spedizione',
  'original.shippingProvince': 'Provincia Spedizione',
  'original.shippingPostalCode': 'CAP Spedizione',
  'original.shippingCountry': 'Nazione Spedizione',
  'original.assignedAdminId': 'Commerciale / Admin Assegnato'
};

export const CLIENT_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'original.maxCredit': 'ABSOLUTE',
  'original.residualCredit': 'ADDITIVE',
  'original.status': 'DESCRIPTIVE'
};

export class ClientsVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return CLIENT_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return CLIENT_SEMANTICS_MAP;
  }

  static getEntityLabel(clientData: any): string {
    if (!clientData) return 'Cliente';
    const orig = clientData.original || clientData;
    const name = (orig.ragioneSociale || orig.companyName || orig.nome || orig.cognome || '').trim();
    return name || orig.email || clientData.id || 'Cliente';
  }
}
