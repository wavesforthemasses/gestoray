import { db, doc, updateDoc, setDoc, collection, getDocs, collectionGroup, query, where } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { ContractService } from '$lib/services/ContractService';
import { formatCurrency } from '$lib/utils/formatters';

export interface TodoDataPayload {
  clientsList: any[];
  contractsList: any[];
  installmentsList: any[];
}

export interface TodoItem {
  id: string;
  type: 'overdue_payment' | 'pending_approval' | 'prospect_followup' | 'quote_followup' | 'future_payment';
  urgency: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  dueDate?: string;
  meta?: any;
}

export class TodoService {
  static async fetchTodoData(): Promise<TodoDataPayload> {
    const payload: TodoDataPayload = {
      clientsList: [],
      contractsList: [],
      installmentsList: []
    };

    const [clientsSnapshot, contractsSnapshot, installmentsSnapshot] = await Promise.all([
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'contracts')),
      getDocs(query(collectionGroup(db, 'installments'), where('original.status', '==', 'pending')))
    ]);

    clientsSnapshot.forEach((doc: any) => {
      const d = doc.data();
      payload.clientsList.push({ id: doc.id, ...d.original, derived: d.derived, edits: d.edits });
    });

    contractsSnapshot.forEach((doc: any) => {
      const d = doc.data();
      payload.contractsList.push({ id: doc.id, ...d.original, derived: d.derived, edits: d.edits });
    });

    installmentsSnapshot.forEach((doc: any) => {
      const d = doc.data();
      payload.installmentsList.push({ id: doc.id, ...d.original, edits: d.edits });
    });

    return payload;
  }

  static buildTodoItems(
    clientsList: any[], 
    contractsList: any[], 
    installmentsList: any[], 
    activeRole: string | null, 
    myUid: string | undefined
  ): TodoItem[] {
    const role = activeRole;
    if (!role || !myUid) return [];

    const items: TodoItem[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Pending approval contracts
    contractsList.forEach(c => {
      const belongs = role !== 'commerciale' || c.vendorUid === myUid || c.secondVendorUid === myUid;
      if (!belongs) return;

      if (c.status === 'pending' && (role === 'superadmin' || role === 'amministrazione' || role === 'direzione')) {
        items.push({
          id: `approval_${c.id}`,
          type: 'pending_approval',
          urgency: 'high',
          title: `Validazione Contratto ${c.id}`,
          description: `Contratto in attesa per "${c.clientName}" - Valore Lordo ${formatCurrency(c.totalPrice || 0)}`,
          dueDate: c.edits?.createdAt || c.createdAt,
          meta: { contractId: c.id }
        });
      }
    });

    // 2. Overdue or future payments
    installmentsList.forEach(inst => {
      const c = contractsList.find(x => x.id === inst.contractId);
      if (!c) return;

      const belongs = role !== 'commerciale' || c.vendorUid === myUid || c.secondVendorUid === myUid;
      if (!belongs) return;

      if (inst.status === 'paid') return;

      const isOverdue = inst.dueDate < todayStr;

      if (isOverdue) {
        items.push({
          id: `overdue_${inst.contractId}_${inst.id}`,
          type: 'overdue_payment',
          urgency: 'high',
          title: `Rata Scaduta - ${formatCurrency(inst.expectedAmount || 0)}`,
          description: `Rata insoluta per "${c.clientName}" (Contratto ${c.id}). Sollecitare telefonicamente o via PEC.`,
          dueDate: inst.dueDate,
          meta: { contractId: c.id, installmentId: inst.id, amount: inst.expectedAmount, clientName: c.clientName, clientId: c.clientId }
        });
      } else {
        items.push({
          id: `future_${inst.contractId}_${inst.id}`,
          type: 'future_payment',
          urgency: 'low',
          title: `Incasso Rata Previsto - ${formatCurrency(inst.expectedAmount || 0)}`,
          description: `Rata in scadenza per "${c.clientName}" (Contratto ${c.id}).`,
          dueDate: inst.dueDate,
          meta: { contractId: c.id, installmentId: inst.id, amount: inst.expectedAmount, clientName: c.clientName, clientId: c.clientId }
        });
      }
    });

    // 3. Prospects & Quotes (Commerciale mostly)
    clientsList.forEach(cl => {
      const isOwner = role !== 'commerciale' || cl.createdBy === myUid;
      if (!isOwner) return;

      const hasComms = (cl.derived?.activitiesCount || 0) > 0;
      const isProspect = cl.status === 'prospect' || !hasComms;

      if (isProspect) {
        items.push({
          id: `prospect_${cl.id}`,
          type: 'prospect_followup',
          urgency: 'medium',
          title: `Primo Contatto Lead: ${cl.nome}`,
          description: `Lead registrato ma non ancora contattato. Effettua una telefonata conoscitiva.`,
          dueDate: cl.edits?.createdAt || cl.createdAt,
          meta: { clientId: cl.id }
        });
      }

      // 4. Quotes pending follow-up
      const hasQuotes = cl.status === 'proposal_sent';
      if (hasQuotes) {
        items.push({
          id: `quote_${cl.id}`,
          type: 'quote_followup',
          urgency: 'medium',
          title: `Follow-up Preventivo: ${cl.nome}`,
          description: `Proposta inviata al cliente. Ricontatta il referente per negoziare la firma del contratto.`,
          dueDate: cl.edits?.createdAt || cl.createdAt,
          meta: { clientId: cl.id }
        });
      }
    });

    const urgencyWeight = { high: 3, medium: 2, low: 1 };
    return items.sort((a, b) => {
      const uDiff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (uDiff !== 0) return uDiff;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });
  }

  static async postponeInstallment(
    contractId: string, 
    installmentId: string, 
    newDate: string, 
    clientId: string, 
    clientName: string, 
    authObj: { uid: string, email: string }
  ) {
    const now = new Date().toISOString();

    await updateDoc(doc(db, 'contracts', contractId, 'installments', installmentId), {
      'original.dueDate': newDate,
      'edits.modifiedAt': now,
      'edits.modifiedBy': authObj.uid
    });

    const activityId = generateId('act');
    await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
      original: {
        clientId,
        clientName,
        type: 'Sollecito Telefonico',
        notes: `Posticipata scadenza pagamento al ${newDate}`,
        date: now,
        loggedBy: authObj.uid,
        loggedEmail: authObj.email,
        status: 'completata'
      },
      edits: {
        createdAt: now,
        createdBy: authObj.uid
      }
    });
  }

  static async collectInstallment(contractId: string, installmentId: string, actualAmount: number, authObj: { uid: string, email: string }) {
    await ContractService.collectInstallment(contractId, installmentId, actualAmount, authObj.uid, authObj.email);
  }

  static async approveContract(contractId: string, authObj: { uid: string, email: string }) {
    await ContractService.approveAndCollectFull(contractId, authObj.uid, authObj.email);
  }
}
