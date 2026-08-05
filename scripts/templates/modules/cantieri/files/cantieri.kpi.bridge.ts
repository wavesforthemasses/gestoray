import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class CantieriKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let activeCantieriCount = 0;
    let totalEstimatedPortfolio = 0;

    try {
      const snap = await getDocs(collection(db, 'cantieri'));
      snap.forEach((d: any) => {
        const data = d.data();
        const status = data.status || data.original?.status;
        if (status === 'aperto' || status === 'fase_contrattuale') {
          activeCantieriCount += 1;
        }
        totalEstimatedPortfolio += (data.estimatedAmount ?? data.original?.estimatedAmount ?? 0);
      });
    } catch (e) {
      console.error('Error fetching cantieri KPIs in bridge:', e);
    }

    return { activeCantieriCount, totalEstimatedPortfolio };
  }
}
