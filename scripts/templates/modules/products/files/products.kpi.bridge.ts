import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class ProductsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let productsCount = 0;

    try {
      const snap = await getDocs(collection(db, 'products'));
      productsCount = snap.size;
    } catch (e) {
      console.error('Error fetching products KPIs in bridge:', e);
    }

    return { productsCount };
  }

  static async getProductsForClientDetail() {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const prods: any[] = [];
      snap.forEach((d: any) => {
        const p = d.data()?.original || d.data();
        prods.push({
          id: d.id,
          name: p.name,
          listPrice: p.price ?? p.listPrice ?? p.unitPrice ?? 0,
          minPrice: p.minPrice
        });
      });
      return prods;
    } catch (e) {
      return [];
    }
  }
}
