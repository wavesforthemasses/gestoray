import { db, doc, setDoc, collection, getDocs, query, where, limit, startAfter, orderBy } from '$lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { generateSearchTerms } from '$lib';

export interface PaymentFetchResult {
  list: any[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export class PaymentsService {
  static async fetchPayments(
    itemsPerPage: number = 50,
    lastVisible: QueryDocumentSnapshot | null = null,
    searchQuery: string = ''
  ): Promise<PaymentFetchResult> {
    
    let q: any = collection(db, 'payments');

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      q = query(q, where('derived.textSearch', 'array-contains', qLower));
    }

    q = query(q, orderBy('edits.createdAt', 'desc'));

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    q = query(q, limit(itemsPerPage));

    const snap = await getDocs(q);
    const pList: any[] = [];
    
    snap.forEach((doc: any) => {
      const d = doc.data();
      const orig = d.original || {};
      pList.push({
        id: doc.id,
        clientId: orig.clientId,
        clientName: orig.clientName,
        contractId: orig.contractId || 'Vedi dettaglio',
        amount: orig.amount,
        date: orig.date,
        recordedBy: orig.recordedBy,
        recordedEmail: orig.recordedEmail
      });
    });

    const hasMore = snap.docs.length === itemsPerPage;
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return { list: pList, lastDoc: newLastDoc, hasMore };
  }

  static async fetchClients() {
    const snap = await getDocs(collection(db, 'clients'));
    const clList: any[] = [];
    snap.forEach((doc: any) => {
      const d = doc.data()?.original || doc.data() || {};
      clList.push({
        id: doc.id,
        nome: d.nome || '',
        cognome: d.cognome || '',
        email: d.email || ''
      });
    });
    return clList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }

  static async fetchClientContracts(clientId: string) {
    if (!clientId) return [];
    
    const q = query(collection(db, 'contracts'), where('original.clientId', '==', clientId));
    const snap = await getDocs(q);
    const coList: any[] = [];
    snap.forEach((doc: any) => {
      const d = doc.data();
      const orig = d.original || {};
      coList.push({
        id: doc.id,
        clientId: orig.clientId,
        clientName: orig.clientName,
        totalPrice: orig.totalPrice,
        status: orig.status
      });
    });
    return coList;
  }

  static async registerPayment(
    selectedClientId: string, 
    selectedContractId: string, 
    amountInput: number, 
    clientsList: any[], 
    authUser: any
  ) {
    if (!selectedClientId || !selectedContractId || amountInput === null || !authUser) {
      throw new Error("Dati mancanti per registrare l'incasso.");
    }

    const client = clientsList.find(c => c.id === selectedClientId);
    const clientFullName = client ? `${client.nome} ${client.cognome || ''}`.trim() : 'Sconosciuto';
    const now = new Date().toISOString();
    const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
    
    const terms = generateSearchTerms(clientFullName + ' ' + selectedContractId + ' ' + authUser.email);

    // 1. Create top-level payment document
    const newPayment = {
      original: {
        clientId: selectedClientId,
        clientName: clientFullName,
        contractId: selectedContractId,
        amount: amountInput,
        date: now,
        recordedBy: authUser.uid,
        recordedEmail: authUser.email
      },
      edits: {
        createdAt: now,
        createdBy: authUser.uid
      },
      derived: {
        textSearch: terms
      }
    };
    await setDoc(doc(db, 'payments', paymentId), newPayment);

    // 2. Create payment contract allocation sub-document
    await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', selectedContractId), {
      original: {
        contractId: selectedContractId,
        paymentId: paymentId,
        amount: amountInput,
        clientId: selectedClientId,
        clientName: clientFullName,
        date: now
      },
      edits: {
        createdAt: now,
        createdBy: authUser.uid
      }
    });

    return { paymentId, amountInput };
  }
}
