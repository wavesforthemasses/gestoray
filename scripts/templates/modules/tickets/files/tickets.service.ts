import { db, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy } from '$lib/firebase';
import type { TicketItem, TicketMessage, TicketKPIs } from './schema';
import { TicketSettingsService } from '$lib/services/ticketSettings';

const COLLECTION_NAME = 'tickets';

export const TicketsService = {
  async getTickets(isExecutive: boolean = false, userUid?: string, userEmail?: string): Promise<TicketItem[]> {
    try {
      if (isExecutive || (!userUid && !userEmail)) {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as TicketItem));
        return items.sort((a: TicketItem, b: TicketItem) => (b.createdAt > a.createdAt ? 1 : -1));
      }

      const ticketsMap = new Map<string, TicketItem>();

      if (userUid) {
        const qAssigned = query(collection(db, COLLECTION_NAME), where('assignedTo', '==', userUid));
        const snapAssigned = await getDocs(qAssigned);
        snapAssigned.docs.forEach((d: any) => {
          ticketsMap.set(d.id, { id: d.id, ...d.data() } as TicketItem);
        });
      }

      if (userEmail) {
        const qRequested = query(collection(db, COLLECTION_NAME), where('requesterEmail', '==', userEmail));
        const snapRequested = await getDocs(qRequested);
        snapRequested.docs.forEach((d: any) => {
          ticketsMap.set(d.id, { id: d.id, ...d.data() } as TicketItem);
        });
      }

      const items = Array.from(ticketsMap.values());
      return items.sort((a: TicketItem, b: TicketItem) => (b.createdAt > a.createdAt ? 1 : -1));
    } catch (e) {
      console.error('Errore getTickets:', e);
      return [];
    }
  },

  async getTicket(id: string): Promise<TicketItem | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TicketItem;
    } catch (e) {
      console.error('Errore getTicket:', e);
      return null;
    }
  },

  async createTicket(data: Partial<TicketItem>): Promise<string> {
    const now = new Date().toISOString();
    const settings = await TicketSettingsService.getSettings();

    const priority = data.priority || 'media';
    const category = data.category || 'generale';

    // Auto-Routing su categoria se non è già stato assegnato manualmente
    let assignedTo = data.assignedTo || '';
    let assignedToName = data.assignedToName || '';

    if (!assignedTo && settings.categories) {
      const matchedCat = settings.categories.find(c => c.id === category);
      if (matchedCat && matchedCat.defaultAssigneeUid) {
        assignedTo = matchedCat.defaultAssigneeUid;
      }
    }

    // Calcolo SLA Due Date
    const hours = (settings.slaHours && settings.slaHours[priority]) || 24;
    const slaDueDate = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const docData = {
      ...data,
      status: data.status || 'aperto',
      priority,
      category,
      assignedTo,
      assignedToName,
      slaDueDate: data.slaDueDate || slaDueDate,
      messages: data.messages || [],
      createdAt: now,
      updatedAt: now
    };
    const ref = await addDoc(collection(db, COLLECTION_NAME), docData);
    return ref.id;
  },

  async updateTicket(id: string, data: Partial<TicketItem>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const current = await this.getTicket(id);
    const now = new Date().toISOString();
    const updatePayload: any = {
      ...data,
      updatedAt: now
    };

    // Se la priorità è cambiata, ricalcola il valore di slaDueDate
    if (data.priority && current && data.priority !== current.priority) {
      const settings = await TicketSettingsService.getSettings();
      const hours = (settings.slaHours && settings.slaHours[data.priority]) || 24;
      updatePayload.slaDueDate = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    // Se lo stato cambia in 'risolto' o 'chiuso', calcola il tempo di risoluzione
    if (data.status && (data.status === 'risolto' || data.status === 'chiuso') && current) {
      if (!current.resolvedAt) {
        updatePayload.resolvedAt = now;
        const createdMs = new Date(current.createdAt || now).getTime();
        const resolvedMs = new Date(now).getTime();
        const hours = Math.max(0.1, Number(((resolvedMs - createdMs) / (1000 * 60 * 60)).toFixed(1)));
        updatePayload.resolutionTimeHours = hours;
      }
      if (data.status === 'chiuso' && !current.closedAt) {
        updatePayload.closedAt = now;
      }
    }

    await updateDoc(docRef, updatePayload);
  },

  async addMessageToTicket(id: string, message: TicketMessage): Promise<void> {
    const current = await this.getTicket(id);
    if (!current) return;

    const messages = [...(current.messages || []), message];
    await this.updateTicket(id, { messages });

    // Invia notifiche se non si tratta di una nota interna
    if (!message.isInternal) {
      await this.sendTicketNotifications(current, message.senderName, `Nuova risposta inserita da ${message.senderName}: "${message.message.slice(0, 80)}..."`);
    }
  },

  async sendTicketNotifications(ticket: TicketItem, senderIdentifier?: string, actionContext?: string): Promise<void> {
    try {
      const settings = await TicketSettingsService.getSettings();
      if (!settings.allowEmailNotifications) return;

      const recipients = new Set<string>();

      if (ticket.requesterEmail) recipients.add(ticket.requesterEmail.toLowerCase().trim());
      if (ticket.ccEmails && Array.isArray(ticket.ccEmails)) {
        ticket.ccEmails.forEach(e => {
          if (e) recipients.add(e.toLowerCase().trim());
        });
      }

      // Escludi il mittente se la sua email è nota
      if (senderIdentifier && senderIdentifier.includes('@')) {
        recipients.delete(senderIdentifier.toLowerCase().trim());
      }

      const finalRecipientsList = Array.from(recipients);
      if (finalRecipientsList.length > 0) {
        console.log(`[Outbound Email Notifier] Inviata notifica email a ${finalRecipientsList.join(', ')} per Ticket #${ticket.id} (${ticket.subject}) - Context: ${actionContext || 'Aggiornamento'}`);
      }
    } catch (e) {
      console.error('Errore invio notifiche email ticket:', e);
    }
  },

  async deleteTicket(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  computeKPIs(tickets: TicketItem[]): TicketKPIs {
    const totalTickets = tickets.length;
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;
    let totalResolutionHours = 0;
    let resolvedWithHoursCount = 0;

    for (const t of tickets) {
      if (t.status === 'aperto') openCount++;
      else if (t.status === 'in_lavorazione' || t.status === 'in_attesa_cliente') inProgressCount++;
      else if (t.status === 'risolto') resolvedCount++;
      else if (t.status === 'chiuso') closedCount++;

      if (t.resolutionTimeHours && t.resolutionTimeHours > 0) {
        totalResolutionHours += t.resolutionTimeHours;
        resolvedWithHoursCount++;
      }
    }

    const completedTotal = resolvedCount + closedCount;
    const resolutionRatePercentage = totalTickets > 0 ? Math.round((completedTotal / totalTickets) * 100) : 0;
    const avgResolutionTimeHours = resolvedWithHoursCount > 0 ? Number((totalResolutionHours / resolvedWithHoursCount).toFixed(1)) : 0;

    return {
      totalTickets,
      openCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      avgResolutionTimeHours,
      resolutionRatePercentage
    };
  }
};
