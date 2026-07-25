import { json, type RequestHandler } from '@sveltejs/kit';
import { TicketSettingsService } from '$lib/services/ticketSettings';
import { TicketsService } from '../../../../dashboard/tickets/tickets.service';
import { db, collection, getDocs, query, where, limit } from '$lib/firebase';
import type { TicketItem } from '../../../../dashboard/tickets/schema';

function parseEmailAddress(input: string): { email: string; name: string } {
  if (!input) return { email: '', name: '' };
  const str = input.trim();
  if (str.includes('<') && str.includes('>')) {
    const nameMatch = str.match(/^(.*?)</);
    const emailMatch = str.match(/<(.*?)>/);
    const name = nameMatch ? nameMatch[1].replace(/["']/g, '').trim() : '';
    const email = emailMatch ? emailMatch[1].trim().toLowerCase() : str;
    return { email, name };
  }
  return { email: str.toLowerCase(), name: '' };
}

function parseAddressesList(input: unknown): string[] {
  if (!input) return [];
  const list: string[] = [];
  const values = Array.isArray(input) ? input : [input];
  for (const val of values) {
    if (typeof val === 'string') {
      const parts = val.split(',');
      for (const p of parts) {
        const parsed = parseEmailAddress(p);
        if (parsed.email && !list.includes(parsed.email)) {
          list.push(parsed.email);
        }
      }
    } else if (val && typeof val === 'object' && 'address' in val && typeof (val as any).address === 'string') {
      const addr = (val as any).address.toLowerCase().trim();
      if (addr && !list.includes(addr)) list.push(addr);
    }
  }
  return list;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const settings = await TicketSettingsService.getSettings();

    if (!settings.allowInboundEmailTickets) {
      return json({ error: 'La ricezione ticket via email è disattivata dalle impostazioni.' }, { status: 403 });
    }

    const secretHeader = request.headers.get('x-webhook-secret');
    const expectedSecret = settings.webhookSecret;

    if (!expectedSecret || secretHeader !== expectedSecret) {
      return json({ error: 'Autenticazione Webhook fallita: secret non valido o non configurato.' }, { status: 401 });
    }

    const body = await request.json();
    const rawFrom = body.from || body.sender || '';
    const rawSubject = body.subject || 'Segnalazione senza oggetto';
    const textBody = body.text || body.body || body.strippedText || body['stripped-text'] || '';
    const rawCc = body.cc || body.CC || [];

    const { email: fromEmail, name: fromName } = parseEmailAddress(rawFrom);
    if (!fromEmail) {
      return json({ error: 'Campo From mancante o non valido.' }, { status: 400 });
    }

    const ccEmails = parseAddressesList(rawCc).filter(e => e !== fromEmail);

    // Cerca se si tratta di una risposta a un ticket esistente (es. Subject contiene "[Ticket #ID]")
    let existingTicketId: string | null = null;
    const ticketMatch = rawSubject.match(/\[Ticket\s*#?([a-zA-Z0-9_-]+)\]/i) || rawSubject.match(/#([a-zA-Z0-9_-]{10,})/);

    if (ticketMatch && ticketMatch[1]) {
      const candidateId = ticketMatch[1].trim();
      const ticket = await TicketsService.getTicket(candidateId);
      if (ticket) {
        existingTicketId = ticket.id || candidateId;
      }
    }

    // Se l'ID non è stato estratto chiaramente, cerca per oggetto pulito
    if (!existingTicketId) {
      const cleanSubject = rawSubject.replace(/^Re:\s*/i, '').replace(/^Fwd:\s*/i, '').trim();
      const q = query(collection(db, 'tickets'), where('subject', '==', cleanSubject), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        existingTicketId = snap.docs[0].id;
      }
    }

    if (existingTicketId) {
      // Aggiungi risposta alla cronologia del ticket esistente
      await TicketsService.addMessageToTicket(existingTicketId, {
        id: 'msg_' + Date.now(),
        senderName: fromName || fromEmail,
        senderRole: 'Cliente (Email)',
        message: textBody.trim() || 'Messaggio ricevuto via email.',
        isInternal: false,
        createdAt: new Date().toISOString()
      });

      return json({
        success: true,
        action: 'reply_added',
        ticketId: existingTicketId,
        message: 'Risposta aggiunta con successo al ticket esistente.'
      });
    } else {
      // Crea un NUOVO Ticket via Inbound Email
      const cleanSubject = rawSubject.replace(/^Re:\s*/i, '').replace(/^Fwd:\s*/i, '').trim();

      const newTicketId = await TicketsService.createTicket({
        subject: cleanSubject,
        description: textBody.trim() || 'Ticket creato da email in ingresso.',
        requesterName: fromName || fromEmail.split('@')[0],
        requesterEmail: fromEmail,
        ccEmails: ccEmails,
        category: 'generale',
        priority: 'media',
        status: 'aperto'
      });

      return json({
        success: true,
        action: 'ticket_created',
        ticketId: newTicketId,
        message: 'Nuovo ticket creato con successo via email in ingresso.'
      });
    }
  } catch (err: any) {
    console.error('Errore durante il processing del webhook ticket inbound:', err);
    return json({ error: 'Errore interno del webhook: ' + err.message }, { status: 500 });
  }
};
