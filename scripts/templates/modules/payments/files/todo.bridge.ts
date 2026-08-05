import { db, collectionGroup, getDocs } from '$lib/firebase';
import { formatCurrency } from '$lib/utils/formatters';

export class PaymentsTodoBridge {
  static async fetchTodoItems(activeRole: string | null, myUid: string | undefined): Promise<any[]> {
    if (!activeRole || !myUid) return [];
    const isComm = activeRole === 'commerciale';

    const items: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    try {
      const snap = await getDocs(collectionGroup(db, 'installments'));
      snap.forEach((doc: any) => {
        const data = doc.data();
        const status = data.status || data.original?.status;
        const vendorUid = data.vendorUid || data.original?.vendorUid;
        const secondVendorUid = data.secondVendorUid || data.original?.secondVendorUid;

        if (status === 'in_attesa' || status === 'pending') {
          if (!isComm || vendorUid === myUid || secondVendorUid === myUid) {
            const inst = { id: doc.id, ...data.original, ...data };
            const isOverdue = inst.dueDate < todayStr;
            const clientName = inst.clientName || 'Cliente non specificato';
            const clientId = inst.clientId || '';

            if (isOverdue) {
              items.push({
                id: `overdue_${inst.contractId}_${inst.id}`,
                type: 'overdue_payment',
                urgency: 'high',
                title: `Rata Scaduta - ${formatCurrency(inst.expectedAmount || 0)}`,
                description: `Rata insoluta per "${clientName}" (Contratto ${inst.contractId}). Sollecitare telefonicamente o via PEC.`,
                dueDate: inst.dueDate,
                meta: { contractId: inst.contractId, installmentId: inst.id, amount: inst.expectedAmount, clientName, clientId, moduleId: 'payments', component: 'installment' }
              });
            } else {
              items.push({
                id: `future_${inst.contractId}_${inst.id}`,
                type: 'future_payment',
                urgency: 'low',
                title: `Incasso Rata Previsto - ${formatCurrency(inst.expectedAmount || 0)}`,
                description: `Rata in scadenza per "${clientName}" (Contratto ${inst.contractId}).`,
                dueDate: inst.dueDate,
                meta: { contractId: inst.contractId, installmentId: inst.id, amount: inst.expectedAmount, clientName, clientId, moduleId: 'payments', component: 'installment' }
              });
            }
          }
        }
      });
    } catch (e) {
      console.error(e);
    }
    return items;
  }
}
