import { db, collection, getDocs, query, where, limit } from '$lib/firebase';

export class ClientsService {
  static async fetchClients(searchVal: string | undefined, activeRole: string, myUid: string | undefined) {
    const isComm = activeRole === 'commerciale';
    let snaps: any[] = [];

    if (!searchVal || !searchVal.trim()) {
      let q;
      if (isComm && myUid) {
        q = query(collection(db, 'clients'), where('original.createdBy', '==', myUid), limit(100));
      } else {
        q = query(collection(db, 'clients'), limit(100));
      }
      const snap = await getDocs(q);
      snaps.push(snap);
    } else {
      const term = searchVal.trim().toLowerCase();

      const queries = [
        getDocs(query(collection(db, 'clients'), where('derived.textSearch', 'array-contains', term), limit(100)))
      ];

      const results = await Promise.all(queries);
      snaps = results;
    }

    const clList: any[] = [];
    const seenIds = new Set<string>();

    snaps.forEach(snap => {
      snap.forEach((doc: any) => {
        if (seenIds.has(doc.id)) return;
        const data = doc.data();
        const orig = data.original || {};

        // Filter in memory for commercials
        if (isComm && orig.createdBy !== myUid) return;

        seenIds.add(doc.id);
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
    });

    return clList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }
}
