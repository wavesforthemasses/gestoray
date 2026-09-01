import type { FieldSemanticsType } from '$lib/services/versioningService';

export const TICKET_FIELD_LABELS: Record<string, string> = {
  'subject': 'Oggetto Ticket',
  'description': 'Descrizione Problema',
  'status': 'Stato Ticket',
  'priority': 'Priorità SLA',
  'category': 'Categoria Assistenza',
  'assignedTo': 'Operatore Assegnato (UID)',
  'assignedToName': 'Nome Operatore Assegnato',
  'requesterName': 'Richiedente',
  'requesterEmail': 'Email Richiedente',
  'requesterPhone': 'Telefono Richiedente',
  'clientId': 'ID Cliente',
  'clientName': 'Cliente Associato',
  'slaDueDate': 'Scadenza SLA Risoluzione',
  'resolvedAt': 'Data Risoluzione',
  'closedAt': 'Data Chiusura',
  'resolutionTimeHours': 'Tempo di Risoluzione (Ore)'
};

export const TICKET_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'subject': 'ABSOLUTE',
  'description': 'DESCRIPTIVE',
  'status': 'ABSOLUTE',
  'priority': 'ABSOLUTE',
  'category': 'ABSOLUTE',
  'assignedTo': 'ABSOLUTE',
  'assignedToName': 'ABSOLUTE',
  'clientId': 'ABSOLUTE',
  'clientName': 'ABSOLUTE',
  'slaDueDate': 'ABSOLUTE',
  'resolvedAt': 'ABSOLUTE',
  'closedAt': 'ABSOLUTE',
  'resolutionTimeHours': 'ABSOLUTE'
};

export class TicketsVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return TICKET_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return TICKET_SEMANTICS_MAP;
  }

  static getEntityLabel(ticketData: any): string {
    if (!ticketData) return 'Ticket';
    const num = ticketData.ticketNumber ? `[${ticketData.ticketNumber}] ` : '';
    const subj = ticketData.subject || ticketData.id || 'Ticket Assistenza';
    return `${num}${subj}`.trim();
  }
}
