import { json } from '@sveltejs/kit';
import { TicketSettingsService } from '$lib/services/ticketSettings';
import { TicketsService } from '../../../../dashboard/tickets/tickets.service';
import { db, collection, getDocs, query, where, limit } from '$lib/firebase';
import type { TicketItem } from '../../../../dashboard/tickets/schema';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { fromEmail, fromName, subject, text, token } = body;

    const config = await TicketSettingsService.getSettings();
    if (config.inboundWebhookToken && token !== config.inboundWebhookToken) {
      return json({ error: 'Token non valido' }, { status: 401 });
    }

    if (!fromEmail || !subject) {
      return json({ error: 'fromEmail e subject sono obbligatori' }, { status: 400 });
    }

    let clientId = '';
    let clientName = fromName || fromEmail;

    const clientsQuery = query(collection(db, 'clients'), where('email', '==', fromEmail), limit(1));
    const snap = await getDocs(clientsQuery);
    if (!snap.empty) {
      const clientDoc = snap.docs[0];
      clientId = clientDoc.id;
      clientName = clientDoc.data().name || clientName;
    }

    const newTicket: Omit<TicketItem, 'id' | 'createdAt' | 'updatedAt'> = {
      ticketNumber: `TCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId,
      clientName,
      requesterEmail: fromEmail,
      subject,
      description: text || '',
      category: 'Generale',
      priority: 'media',
      status: 'aperto',
      channel: 'email'
    };

    const ticketId = await TicketsService.createTicket(newTicket);
    return json({ success: true, ticketId });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}
