import { db, collection, getDocs, query, where, limit, startAfter, orderBy, or } from '$lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

export interface ContractsFetchResult {
  list: any[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export class ContractsService {
  static async fetchUsers() {
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    const uList: any[] = [];
    usersSnapshot.forEach((doc: any) => {
      const data = doc.data();
      uList.push({
        uid: doc.id,
        email: data.original?.email || data.email,
        nome: data.original?.nome || data.nome,
        cognome: data.original?.cognome || data.cognome,
        roles: data.original?.roles || data.roles || [],
        qualification: data.original?.qualification || data.qualification || 'junior',
        derived: data.derived || {}
      });
    });
    return uList;
  }

  static async fetchContracts(
    activeRole: string, 
    activeTab: string, 
    uid: string | undefined,
    itemsPerPage: number = 50,
    lastVisible: QueryDocumentSnapshot | null = null
  ): Promise<ContractsFetchResult> {
    
    let q: any = collection(db, 'contracts');

    if (activeRole === 'commerciale') {
      if (uid) {
        q = query(q, or(where('original.vendorUid', '==', uid), where('original.secondVendorUid', '==', uid)));
      }
    } else {
      if (activeTab === 'pending') {
        q = query(q, where('original.status', '==', 'pending'));
      } else if (activeTab === 'approved') {
        q = query(q, where('original.status', '==', 'approved'));
      }
    }

    q = query(q, orderBy('edits.createdAt', 'desc'));

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    q = query(q, limit(itemsPerPage));

    const snap = await getDocs(q);
    const cList: any[] = [];
    
    snap.forEach((doc: any) => {
      cList.push({ id: doc.id, ...doc.data() });
    });

    const hasMore = snap.docs.length === itemsPerPage;
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return { list: cList, lastDoc: newLastDoc, hasMore };
  }

  static computeCommercialStats(usersList: any[], uid: string | undefined) {
    const myUser = usersList.find(u => u.uid === uid);
    const uDerived = myUser?.derived || {};
    return {
      sospese: uDerived.totalCommissionPending || 0,
      maturate: uDerived.totalCommissionEarned || 0,
      totalVenduto: (uDerived.totalPendingSales || 0) + (uDerived.totalApprovedSales || 0)
    };
  }
}
