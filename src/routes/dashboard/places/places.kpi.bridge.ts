import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class PlacesKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let activePlacesCount = 0;

    try {
      const snap = await getDocs(collection(db, 'places'));
      snap.forEach((d: any) => {
        const data = d.data();
        const status = data.status || data.original?.status;
        if (status !== 'inattivo') {
          activePlacesCount += 1;
        }
      });
    } catch (e) {
      console.error('Error fetching places KPIs in bridge:', e);
    }

    return { activePlacesCount };
  }
}
