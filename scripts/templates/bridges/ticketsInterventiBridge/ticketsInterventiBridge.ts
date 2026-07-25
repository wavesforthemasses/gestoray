import { db, collection, getDocs, query, where } from '$lib/firebase';

export interface TicketInterventionsSummary {
  ticketId: string;
  interventionsCount: number;
  completedInterventions: number;
  interventions: { id: string; title: string; status: string }[];
}

export class TicketsInterventiBridge {
  /**
   * Bridge Service: Escalates customer support tickets into field interventions.
   * Executed only when both 'tickets' and 'interventi' modules are present.
   */
  static async getTicketInterventionsSummary(ticketId: string): Promise<TicketInterventionsSummary> {
    const q = query(
      collection(db, 'interventions'),
      where('ticketId', '==', ticketId)
    );

    const snap = await getDocs(q);
    let completedInterventions = 0;
    const interventions: { id: string; title: string; status: string }[] = [];

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'chiuso' || data.status === 'completato') {
        completedInterventions++;
      }
      interventions.push({
        id: docSnap.id,
        title: data.title || 'Intervento Assistenza',
        status: data.status || 'programmato'
      });
    });

    return {
      ticketId,
      interventionsCount: snap.docs.length,
      completedInterventions,
      interventions
    };
  }
}
