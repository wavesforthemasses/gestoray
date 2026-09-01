import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class PlacesKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Places KPIs.
   */
  static calculateKPIs(placesList: any[], referenceDate = new Date()) {
    let activePlaces = 0;
    let newPlaces = 0;
    let totalPlaces = 0;

    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1).getTime();

    for (const d of placesList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const data = d.data ? d.data() : d;
      totalPlaces++;

      const status = data.status || data.original?.status;
      if (status !== 'inattivo') {
        activePlaces += 1;
      }

      const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
      let ms = 0;
      if (dt) {
        if (typeof dt === 'string') ms = new Date(dt).getTime();
        else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
        else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
        else if (dt instanceof Date) ms = dt.getTime();
      }
      if (ms >= startOfMonth) {
        newPlaces += 1;
      }
    }

    return {
      active_places: activePlaces,
      new_places: newPlaces,
      places_attivi: activePlaces,
      activePlacesCount: activePlaces,
      totalPlacesCount: totalPlaces,
      total_places: totalPlaces
    };
  }

  private static cache: { data: any[]; timestamp: number } | null = null;
  private static readonly TTL_MS = 30000;

  static async fetchRawData(): Promise<any[]> {
    const now = Date.now();
    if (this.cache && (now - this.cache.timestamp) < this.TTL_MS) {
      return this.cache.data;
    }
    try {
      const snap = await getDocs(collection(db, 'places'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        list.push({ id: d.id, ...data });
      });
      this.cache = { data: list, timestamp: now };
      return list;
    } catch (e) {
      console.error('Error fetching places in bridge:', e);
      return this.cache ? this.cache.data : [];
    }
  }

  static invalidateCache() {
    this.cache = null;
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    try {
      const list = await this.fetchRawData();
      return this.calculateKPIs(list);
    } catch (e) {
      console.error('Error fetching places KPIs in bridge:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    if (tab !== 'places' && tab !== 'active_places' && tab !== 'new_places') return [];

    let items: any[] = [];
    try {
      const allPlaces = await this.fetchRawData();
      allPlaces.forEach((data: any) => {
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') ms = new Date(dt).getTime();
          else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
          else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
          else if (dt instanceof Date) ms = dt.getTime();
        }
        if (ms > 0 && ms >= period.start.getTime() && ms <= period.end.getTime()) {
          items.push(data);
        }
      });
    } catch (e) {
      console.error('Error fetching places drill down in bridge:', e);
    }

    return items.map((item) => {
      const orig = item.original || {};
      return {
        id: item.id,
        cliente: item.clientName || orig.clientName || 'Cliente non specificato',
        consulente: item.address?.city || orig.address?.city || 'Sede',
        data: formatDate(item.createdAt || orig.createdAt),
        valore: item.code || orig.code || '-',
        dettaglio: item.name || orig.name || 'Luogo / Cantiere',
        status: item.status || orig.status || 'Attivo',
        link: `/dashboard/places/${item.id}`
      };
    });
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    if (tab !== 'active_places' && tab !== 'places_attivi' && tab !== 'new_places') {
      return periods.map(() => 0);
    }

    let allPlaces: any[] = [];
    try {
      allPlaces = await this.fetchRawData();
    } catch (e) {
      console.error('Error fetching places for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();

      if (tab === 'new_places') {
        const placesInPeriod = allPlaces.filter(data => {
          const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
          let ms = 0;
          if (dt) {
            if (typeof dt === 'string') ms = new Date(dt).getTime();
            else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
            else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
            else if (dt instanceof Date) ms = dt.getTime();
          }
          return ms > 0 && ms >= startMs && ms <= endMs;
        });
        return placesInPeriod.length;
      }

      if (tab === 'active_places' || tab === 'places_attivi') {
        const activeUpToPeriod = allPlaces.filter(data => {
          const status = data.status || data.original?.status;
          if (status === 'inattivo') return false;

          const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
          let ms = 0;
          if (dt) {
            if (typeof dt === 'string') ms = new Date(dt).getTime();
            else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
            else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
            else if (dt instanceof Date) ms = dt.getTime();
          }
          return ms === 0 || ms <= endMs;
        });
        return activeUpToPeriod.length;
      }

      return 0;
    });
  }
}
