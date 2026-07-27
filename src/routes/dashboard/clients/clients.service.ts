import { db, collection, getDocs, query, where, limit, startAfter, orderBy } from '$lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

export interface ClientsFetchResult {
  list: any[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export class ClientsService {
  static async fetchClients(
    searchVal: string | undefined,
    activeRole: string,
    myUid: string | undefined,
    itemsPerPage: number = 50,
    lastVisible: QueryDocumentSnapshot | null = null
  ): Promise<ClientsFetchResult> {
    const isComm = activeRole === 'commerciale';
    let q: any = collection(db, 'clients');

    if (searchVal && searchVal.trim()) {
      const term = searchVal.trim().toLowerCase();
      q = query(q, where('derived.textSearch', 'array-contains', term));
    }

    if (isComm && myUid) {
      q = query(q, where('original.createdBy', '==', myUid));
    }

    // Default order by createdAt desc
    q = query(q, orderBy('edits.createdAt', 'desc'));

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    q = query(q, limit(itemsPerPage));

    const snap = await getDocs(q);
    const clList: any[] = [];

    snap.forEach((doc: any) => {
      const data = doc.data();
      const orig = data.original || {};

      clList.push({
        id: doc.id,
        nome: orig.nome || orig.ragioneSociale || '',
        cognome: orig.cognome || '',
        email: orig.email || orig.emailContatto || '',
        phone: orig.phone || orig.mainPhone || '',
        status: orig.status || 'prospect',
        clientCode: orig.clientCode || orig.codiceCliente || '',
        clientGroup: orig.clientGroup || orig.gruppoCliente || '',
        certificationStatus: orig.certificationStatus || orig.statoCertificazione || '',
        isItalianSubject: orig.isItalianSubject !== undefined ? orig.isItalianSubject : true,
        partitaIva: orig.partitaIva || '',
        codiceFiscale: orig.codiceFiscale || '',
        sdiCode: orig.sdiCode || orig.codiceSdi || '',
        pec: orig.pec || '',
        paymentTerms: orig.paymentTerms || orig.condizioniPagamento || '',
        iban: orig.iban || '',
        referenteTecnico: orig.referenteTecnico || '',
        telReferente: orig.telReferente || '',
        emailContatto: orig.emailContatto || orig.email || '',
        emailAlternativa: orig.emailAlternativa || '',
        crifCheck: orig.crifCheck || orig.controlloCrif || '',
        riskClass: orig.riskClass || orig.classeRischio || '',
        maxCredit: orig.maxCredit || orig.fidoMassimo || 0,
        residualCredit: orig.residualCredit || orig.fidoResiduo || 0,
        paymentStatus: orig.paymentStatus || orig.statoPagamenti || 'Regolare',
        internalAdminNotes: orig.internalAdminNotes || orig.noteAmministrative || '',
        quoteAutoNotes: orig.quoteAutoNotes || orig.notePreventivo || '',
        notes: orig.notes || [],
        createdBy: orig.createdBy || '',
        createdAt: data.edits?.createdAt || orig.createdAt || new Date().toISOString(),
        derived: data.derived || {}
      });
    });

    const hasMore = snap.docs.length === itemsPerPage;
    const newLastDoc = snap.docs.length > 0 ? (snap.docs[snap.docs.length - 1] as unknown as QueryDocumentSnapshot) : null;

    return { list: clList, lastDoc: newLastDoc, hasMore };
  }
}
