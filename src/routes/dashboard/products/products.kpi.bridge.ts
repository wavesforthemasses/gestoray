import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class ProductsKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Products KPIs.
   */
  static calculateKPIs(productsList: any[]) {
    let count = 0;
    let totalCatalogValue = 0;

    for (const d of productsList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const data = d.data ? d.data() : d;
      count++;
      totalCatalogValue += Number(data.price ?? data.original?.price ?? 0);
    }

    return {
      total_products: count,
      totalProducts: count,
      productsCount: count,
      totalCatalogValue
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
      const snap = await getDocs(collection(db, 'products'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        list.push({ id: d.id, ...data });
      });
      this.cache = { data: list, timestamp: now };
      return list;
    } catch (e) {
      console.error('Error fetching products in bridge:', e);
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
      console.error('Error fetching products KPIs in bridge:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    let allProducts: any[] = [];
    try {
      allProducts = await this.fetchRawData();
    } catch (e) {
      console.error('Error fetching products for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const endMs = new Date(p.end).getTime();

      const activeUpToPeriod = allProducts.filter(data => {
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
    });
  }

  static async getProductsForClientDetail() {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const prods: any[] = [];
      snap.forEach((d: any) => {
        const p = d.data()?.original || d.data();
        if (p?.derived?.deleted) return;
        prods.push({
          id: d.id,
          name: p.name,
          price: p.price ?? 0,
          minPrice: p.minPrice
        });
      });
      return prods;
    } catch (e) {
      return [];
    }
  }
}
