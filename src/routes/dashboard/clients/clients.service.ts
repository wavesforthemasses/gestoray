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
        nome: orig.nome || '',
        cognome: orig.cognome || '',
        email: orig.email,
        phone: orig.phone,
        status: orig.status || 'prospect',
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
