import { db, doc, updateDoc, setDoc, collection, getDocs, collectionGroup, query, where, or } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib';
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
  static async fetchTodoData(activeRole: string | null, myUid: string | undefined): Promise<TodoDataPayload> {
    const payload: TodoDataPayload = {
      clientsList: [],
      contractsList: [],
      installmentsList: []
    };

    if (!activeRole || !myUid) return payload;
    const isComm = activeRole === 'commerciale';
    const isAdmin = activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione';

    const queries: Promise<any>[] = [];

    // 1. Clients: Only prospect or proposal_sent
    let qClients = query(collection(db, 'clients'), where('original.status', 'in', ['prospect', 'proposal_sent']));
    if (isComm) {
      qClients = query(qClients, where('original.createdBy', '==', myUid));
    }
    queries.push(getDocs(qClients).then(snap => {
      snap.forEach((doc: any) => payload.clientsList.push({ id: doc.id, ...doc.data()?.original, derived: doc.data()?.derived, edits: doc.data()?.edits }));
    }));

    // 2. Contracts: Only pending approval (Only for admins)
    if (isAdmin) {
      const qContracts = query(collection(db, 'contracts'), where('original.status', '==', 'pending'));
      queries.push(getDocs(qContracts).then(snap => {
        snap.forEach((doc: any) => payload.contractsList.push({ id: doc.id, ...doc.data()?.original, derived: doc.data()?.derived, edits: doc.data()?.edits }));
      }));
    }

    // 3. Installments: Only pending
    let qInst = query(collectionGroup(db, 'installments'), where('original.status', '==', 'pending'));
    if (isComm) {
      qInst = query(qInst, or(where('original.vendorUid', '==', myUid), where('original.secondVendorUid', '==', myUid)));
    }
    queries.push(getDocs(qInst).then(snap => {
      snap.forEach((doc: any) => payload.installmentsList.push({ id: doc.id, ...doc.data()?.original, edits: doc.data()?.edits }));
    }));

    await Promise.all(queries);
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
    const isAdmin = role === 'superadmin' || role === 'amministrazione' || role === 'direzione';

    // 1. Pending approval contracts
    if (isAdmin) {
      contractsList.forEach(c => {
        items.push({
          id: `approval_${c.id}`,
          type: 'pending_approval',
          urgency: 'high',
          title: `Validazione Contratto ${c.id}`,
          description: `Contratto in attesa per "${c.clientName}" - Valore Lordo ${formatCurrency(c.totalPrice || 0)}`,
          dueDate: c.edits?.createdAt || c.createdAt,
          meta: { contractId: c.id }
        });
      });
    }

    // 2. Overdue or future payments
    installmentsList.forEach(inst => {
      const isOverdue = inst.dueDate < todayStr;
      
      // Fallback per i vecchi documenti senza clientName/clientId
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
          meta: { contractId: inst.contractId, installmentId: inst.id, amount: inst.expectedAmount, clientName, clientId }
        });
      } else {
        items.push({
          id: `future_${inst.contractId}_${inst.id}`,
          type: 'future_payment',
          urgency: 'low',
          title: `Incasso Rata Previsto - ${formatCurrency(inst.expectedAmount || 0)}`,
          description: `Rata in scadenza per "${clientName}" (Contratto ${inst.contractId}).`,
          dueDate: inst.dueDate,
          meta: { contractId: inst.contractId, installmentId: inst.id, amount: inst.expectedAmount, clientName, clientId }
        });
      }
    });

    // 3. Prospects & Quotes (Commerciale mostly)
    clientsList.forEach(cl => {
      const isProspect = cl.status === 'prospect';

      if (isProspect) {
        items.push({
          id: `prospect_${cl.id}`,
          type: 'prospect_followup',
          urgency: 'medium',
          title: `Primo Contatto Lead: ${cl.nome} ${cl.cognome || ''}`.trim(),
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
          title: `Follow-up Preventivo: ${cl.nome} ${cl.cognome || ''}`.trim(),
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

    if (clientId) {
      const activityId = generateId('act');
      const terms = generateSearchTerms(clientName + ' Sollecito Telefonico Posticipata scadenza ' + authObj.email);
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
        },
        derived: {
          textSearch: terms
        }
      });
    }
  }
}
