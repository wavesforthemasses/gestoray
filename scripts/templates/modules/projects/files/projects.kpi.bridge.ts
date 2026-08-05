import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class ProjectsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let activeProjectsCount = 0;
    let totalEstimatedPortfolio = 0;

    try {
      const snap = await getDocs(collection(db, 'projects'));
      snap.forEach((d: any) => {
        const data = d.data();
        const status = data.status || data.original?.status;
        if (status === 'aperto' || status === 'fase_contrattuale') {
          activeProjectsCount += 1;
        }
        totalEstimatedPortfolio += (data.estimatedAmount ?? data.original?.estimatedAmount ?? 0);
      });
    } catch (e) {
      console.error('Error fetching projects KPIs in bridge:', e);
    }

    return { activeProjectsCount, totalEstimatedPortfolio };
  }
}
