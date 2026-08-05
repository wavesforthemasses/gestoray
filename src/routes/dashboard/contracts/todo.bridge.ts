import { db, collection, getDocs } from '$lib/firebase';
import { formatCurrency } from '$lib/utils/formatters';

export class ContractsTodoBridge {
  static async fetchTodoItems(activeRole: string | null, myUid: string | undefined): Promise<any[]> {
    if (!activeRole || !myUid) return [];
    const isAdmin = activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione';
    if (!isAdmin) return [];

    const items: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'contracts'));
      snap.forEach((doc: any) => {
        const data = doc.data();
        const status = data.status || data.original?.status || 'bozza';
        if (status === 'bozza' || status === 'inviato' || status === 'pending') {
          const c = { id: doc.id, ...data.original, ...data };
          items.push({
            id: `approval_${c.id}`,
            type: 'pending_approval',
            urgency: 'high',
            title: `Validazione Contratto ${c.id}`,
            description: `Contratto in attesa per "${c.clientName}" - Valore Lordo ${formatCurrency(c.totalPrice || 0)}`,
            dueDate: c.edits?.createdAt || c.createdAt,
            meta: { contractId: c.id, moduleId: 'contracts', component: 'approval' }
          });
        }
      });
    } catch (e) {
      console.error(e);
    }
    return items;
  }
}
