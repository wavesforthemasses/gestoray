import { db, doc, getDoc, collection, getDocs, query, where } from '$lib/firebase';

export interface MyCommissionsData {
  isFinalized: boolean;
  allocations: any[];
  totalCommissions: number;
  totalSales: number;
}

export class MyCommissionsService {
  /**
   * Recupera unicamente le provvigioni spettanti all'agente loggato
   * per il periodo specificato. Ritorna vuoto se il calcolo non è definitivo.
   */
  static async getMyCommissions(periodId: string, myUid: string): Promise<MyCommissionsData> {
    const result: MyCommissionsData = {
      isFinalized: false,
      allocations: [],
      totalCommissions: 0,
      totalSales: 0
    };

    // 1. Fetch Closing Status
    const closingSnap = await getDoc(doc(db, 'commissions_closings', periodId));
    if (!closingSnap.exists()) {
      return result;
    }

    const closingDoc = closingSnap.data();
    result.isFinalized = (closingDoc.latestStatus === 'finalized');

    // 2. If not finalized, stop here.
    if (!result.isFinalized) {
      return result;
    }

    // 3. Fetch the finalized version to get the breakdown details
    const vSnap = await getDocs(
      query(collection(db, 'commissions_closings', periodId, 'versions'), where('status', '==', 'finalized'))
    );

    if (!vSnap.empty) {
      const finalizedVersion = vSnap.docs[0].data();
      
      // Estrae solo la porzione dedicata al venditore loggato
      const myBreakdown = finalizedVersion.breakdown?.find((b: any) => b.uid === myUid);
      
      if (myBreakdown && myBreakdown.details) {
        result.allocations = myBreakdown.details;
        result.totalCommissions = result.allocations.reduce((sum, alloc) => sum + (alloc.commission || 0), 0);
        result.totalSales = result.allocations.reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0);
      }
    }

    return result;
  }
}
