import { db, collection, getDocs, query, where } from '$lib/firebase';

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

  static async fetchContracts(activeRole: string, activeTab: string, uid: string | undefined) {
    const cList: any[] = [];

    if (activeRole === 'commerciale') {
      // Query primary vendor
      const primaryQuery = query(collection(db, 'contracts'), where('original.vendorUid', '==', uid));
      const primarySnap = await getDocs(primaryQuery);
      primarySnap.forEach((doc: any) => {
        cList.push({ id: doc.id, ...doc.data() });
      });

      // Query secondary vendor
      const secondaryQuery = query(collection(db, 'contracts'), where('original.secondVendorUid', '==', uid));
      const secondarySnap = await getDocs(secondaryQuery);
      secondarySnap.forEach((doc: any) => {
        if (!cList.some(x => x.id === doc.id)) {
          cList.push({ id: doc.id, ...doc.data() });
        }
      });
    } else {
      let q;
      if (activeTab === 'pending') {
        q = query(collection(db, 'contracts'), where('original.status', '==', 'pending'));
      } else if (activeTab === 'approved') {
        q = query(collection(db, 'contracts'), where('original.status', '==', 'approved'));
      } else {
        q = query(collection(db, 'contracts'));
      }
      const snap = await getDocs(q);
      snap.forEach((doc: any) => {
        cList.push({ id: doc.id, ...doc.data() });
      });
    }

    return cList.sort((a, b) => new Date(b.edits?.createdAt || b.original?.createdAt).getTime() - new Date(a.edits?.createdAt || a.original?.createdAt).getTime());
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
