import { db, collection, getDocs, query, where } from '$lib/firebase';

export interface ProductUsageSummary {
  productId: string;
  totalQuantityUsed: number;
  totalMaterialCost: number;
  interventionsCount: number;
}

export class ProductsInterventiBridge {
  /**
   * Bridge Service: Links Parts Catalog ('products') with Materials used in Interventions ('interventi').
   * Executed only when both 'products' and 'interventi' modules are present.
   */
  static async getProductUsageSummary(productId: string): Promise<ProductUsageSummary> {
    const q = query(
      collection(db, 'interventions')
    );

    const snap = await getDocs(q);
    let totalQuantityUsed = 0;
    let totalMaterialCost = 0;
    let interventionsCount = 0;

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const items: any[] = data.items || [];
      const matchItem = items.find(item => item.productId === productId);

      if (matchItem) {
        interventionsCount++;
        const qty = matchItem.quantity || 1;
        const price = matchItem.price || 0;
        totalQuantityUsed += qty;
        totalMaterialCost += qty * price;
      }
    });

    return {
      productId,
      totalQuantityUsed,
      totalMaterialCost,
      interventionsCount
    };
  }
}
