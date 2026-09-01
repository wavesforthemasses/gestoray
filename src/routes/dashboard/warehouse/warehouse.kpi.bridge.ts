import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class WarehouseKPIBridge {
  /**
   * Single Source of Truth (SSOT) per le metriche KPI di Magazzino
   */
  static calculateKPIs(inventoryList: any[], purchaseOrdersList: any[]) {
    let totalStockValue = 0;
    let lowStockCount = 0;
    let totalItems = 0;
    let pendingOrdersCount = 0;

    for (const inv of inventoryList) {
      if (!inv || inv?.derived?.deleted || inv?.deleted) continue;
      const data = inv.data ? inv.data() : inv;
      totalItems++;
      totalStockValue += Number(data.totalValuation ?? (Number(data.stockQty ?? 0) * Number(data.avgUnitCost ?? 0)));
      if (data.isLowStock || (Number(data.stockQty ?? 0) <= Number(data.minReorderThreshold ?? 5))) {
        lowStockCount++;
      }
    }

    for (const po of purchaseOrdersList) {
      if (!po || po?.derived?.deleted || po?.deleted) continue;
      const data = po.data ? po.data() : po;
      if (data.status === 'bozza' || data.status === 'inviato' || data.status === 'ricevuto_parziale') {
        pendingOrdersCount++;
      }
    }

    return {
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      total_stock_value: Math.round(totalStockValue * 100) / 100,
      lowStockCount,
      low_stock_items: lowStockCount,
      pendingOrdersCount,
      pending_purchase_orders: pendingOrdersCount,
      totalInventoryItems: totalItems
    };
  }

  private static cacheInv: { data: any[]; timestamp: number } | null = null;
  private static cachePO: { data: any[]; timestamp: number } | null = null;
  private static readonly TTL_MS = 30000;

  static async fetchRawData(): Promise<{ inventory: any[]; purchaseOrders: any[] }> {
    const now = Date.now();
    let inventory: any[] = [];
    let purchaseOrders: any[] = [];

    if (this.cacheInv && (now - this.cacheInv.timestamp) < this.TTL_MS) {
      inventory = this.cacheInv.data;
    } else {
      try {
        const snap = await getDocs(collection(db, 'warehouse_inventory'));
        inventory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.cacheInv = { data: inventory, timestamp: now };
      } catch (e) {
        inventory = [];
      }
    }

    if (this.cachePO && (now - this.cachePO.timestamp) < this.TTL_MS) {
      purchaseOrders = this.cachePO.data;
    } else {
      try {
        const snap = await getDocs(collection(db, 'purchase_orders'));
        purchaseOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.cachePO = { data: purchaseOrders, timestamp: now };
      } catch (e) {
        purchaseOrders = [];
      }
    }

    return { inventory, purchaseOrders };
  }

  static invalidateCache() {
    this.cacheInv = null;
    this.cachePO = null;
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    try {
      const { inventory, purchaseOrders } = await this.fetchRawData();
      return this.calculateKPIs(inventory, purchaseOrders);
    } catch (e) {
      console.error('Error fetching warehouse KPIs:', e);
      return this.calculateKPIs([], []);
    }
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    try {
      const { inventory } = await this.fetchRawData();
      return periods.map(() => {
        let sum = 0;
        for (const item of inventory) {
          sum += Number(item.totalValuation ?? (Number(item.stockQty ?? 0) * Number(item.avgUnitCost ?? 0)));
        }
        return Math.round(sum * 100) / 100;
      });
    } catch (e) {
      return periods.map(() => 0);
    }
  }
}
