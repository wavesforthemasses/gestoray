export interface TicketSchema {
  subject: string;
  description: string;
  clientId?: string;
  clientName?: string;
  requesterEmail?: string;
  requesterName?: string;
  requesterUid?: string;
  createdBy?: string;
  ccEmails?: string[];
  assignedTo?: string;
  assignedToName?: string;
  priority: 'bassa' | 'media' | 'alta' | 'urgente';
  category: string;
  status: 'aperto' | 'in_lavorazione' | 'in_attesa_cliente' | 'risolto' | 'chiuso';
  slaDueDate?: string | null;
  customFields?: Record<string, any>;
}

export interface TicketMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketItem {
  id?: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  clientId?: string;
  clientName?: string;
  requesterEmail?: string;
  requesterName?: string;
  requesterUid?: string;
  createdBy?: string;
  ccEmails?: string[];
  assignedTo?: string;
  assignedToName?: string;
  priority: 'bassa' | 'media' | 'alta' | 'urgente';
  category: string;
  status: 'aperto' | 'in_lavorazione' | 'in_attesa_cliente' | 'risolto' | 'chiuso';
  channel?: string;
  slaDueDate?: string | null;
  customFields?: Record<string, any>;
  messages?: TicketMessage[];
  createdAt?: any;
  updatedAt?: any;
  resolvedAt?: string;
  closedAt?: string;
  resolutionTimeHours?: number;
}

export interface TicketKPIs {
  totalTickets: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  avgResolutionTimeHours: number;
  resolutionRatePercentage: number;
}
