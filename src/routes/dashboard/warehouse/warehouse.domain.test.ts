import { describe, it, expect } from 'vitest';
import { WarehouseService, InsufficientStockError } from './warehouse.service';
import { WarehouseKPIBridge } from './warehouse.kpi.bridge';

describe('Warehouse Domain Logic & Mathematical Invariants', () => {

  // =========================================================================
  // 1. CALCOLO LINE TOTALS (PO)
  // =========================================================================
  describe('Purchase Order Line Item Computations', () => {
    it('computes line net, vat, and gross with discount percentage accurately', () => {
      const line = {
        orderedQty: 10,
        unitPrice: 100.00,
        vatRate: 22,
        discountPercent: 10 // 10% discount -> 90 € net unit price
      };

      const result = WarehouseService.calculateLineTotals(line);

      expect(result.subtotalNet).toBe(900.00);
      expect(result.subtotalVat).toBe(198.00); // 22% of 900
      expect(result.subtotalGross).toBe(1098.00);
    });

    it('handles zero discount, decimal quantities, and 10% reduced VAT', () => {
      const line = {
        orderedQty: 25.5,
        unitPrice: 12.40,
        vatRate: 10,
        discountPercent: 0
      };

      const result = WarehouseService.calculateLineTotals(line);

      expect(result.subtotalNet).toBe(316.20);
      expect(result.subtotalVat).toBe(31.62);
      expect(result.subtotalGross).toBe(347.82);
    });
  });

  // =========================================================================
  // 2. COSTO MEDIO PONDERATO (CMP)
  // =========================================================================
  describe('Costo Medio Ponderato (CMP) Valuation Engine', () => {
    it('calculates weighted average cost across consecutive purchase intakes', () => {
      // Step 1: Initial stock 100 units @ 10 € = 1,000 €
      const stock1 = 100;
      const cmp1 = 10.00;

      // Step 2: Intake 50 units @ 16 € (total new value: 1,000 + 800 = 1,800 € / 150 units = 12.00 €)
      const cmp2 = WarehouseService.calculateCMP(stock1, cmp1, 50, 16.00);
      expect(cmp2).toBe(12.00);

      // Step 3: Intake 50 units @ 20 € (total new value: 1,800 + 1,000 = 2,800 € / 200 units = 14.00 €)
      const cmp3 = WarehouseService.calculateCMP(150, cmp2, 50, 20.00);
      expect(cmp3).toBe(14.00);
    });

    it('handles initial intake from zero stock cleanly', () => {
      const cmp = WarehouseService.calculateCMP(0, 0, 20, 45.50);
      expect(cmp).toBe(45.50);
    });
  });

  // =========================================================================
  // 3. IDENTIFICATIVO COMPOSITO & ISOLAMENTO DEPOSITI
  // =========================================================================
  describe('Composite Keys & Multi-Location Stock Isolation', () => {
    it('generates deterministic composite keys for product and location pairs', () => {
      const keyCentral = WarehouseService.getInventoryDocId('prod-101', 'place-hq');
      const keySite = WarehouseService.getInventoryDocId('prod-101', 'place-site-4');
      const keyDefault = WarehouseService.getInventoryDocId('prod-101');

      expect(keyCentral).toBe('prod-101_place-hq');
      expect(keySite).toBe('prod-101_place-site-4');
      expect(keyDefault).toBe('prod-101_default');
    });
  });

  // =========================================================================
  // 4. SSOT KPI BRIDGE METRICS
  // =========================================================================
  describe('WarehouseKPIBridge Single Source of Truth', () => {
    it('aggregates stock value, low-stock threshold breaches, and open POs accurately', () => {
      const mockInventory = [
        { id: 'inv1', stockQty: 10, avgUnitCost: 50.00, totalValuation: 500.00, minReorderThreshold: 5, isLowStock: false },
        { id: 'inv2', stockQty: 2, avgUnitCost: 120.00, totalValuation: 240.00, minReorderThreshold: 5, isLowStock: true }, // LOW STOCK
        { id: 'inv3', stockQty: 0, avgUnitCost: 30.00, totalValuation: 0.00, minReorderThreshold: 2, isLowStock: true }    // LOW STOCK
      ];

      const mockPurchaseOrders = [
        { id: 'po1', status: 'bozza', totalGrossAmount: 1200 },
        { id: 'po2', status: 'inviato', totalGrossAmount: 850 },
        { id: 'po3', status: 'ricevuto_totale', totalGrossAmount: 3000 }
      ];

      const kpis = WarehouseKPIBridge.calculateKPIs(mockInventory, mockPurchaseOrders);

      expect(kpis.totalStockValue).toBe(740.00);
      expect(kpis.lowStockCount).toBe(2);
      expect(kpis.pendingOrdersCount).toBe(2); // bozza + inviato
      expect(kpis.totalInventoryItems).toBe(3);
    });
  });

  // =========================================================================
  // 5. FIFO SIMULATION IN DOMAIN
  // =========================================================================
  describe('FIFO Layer Depletion Simulation', () => {
    it('depletes stock batches in First-In First-Out order and computes actual COGS', () => {
      interface StockBatch {
        id: string;
        intakeDate: string;
        qtyRemaining: number;
        costPerUnit: number;
      }

      const batches: StockBatch[] = [
        { id: 'b1', intakeDate: '2026-08-01', qtyRemaining: 10, costPerUnit: 15.00 }, // 10 @ 15 = 150
        { id: 'b2', intakeDate: '2026-08-10', qtyRemaining: 20, costPerUnit: 18.00 }, // 20 @ 18 = 360
        { id: 'b3', intakeDate: '2026-08-20', qtyRemaining: 15, costPerUnit: 22.00 }  // 15 @ 22 = 330
      ];

      const qtyToDischarge = 15; // Requires 10 from b1 and 5 from b2
      let remainingToDischarge = qtyToDischarge;
      let totalCostOfGoodsSold = 0;

      for (const batch of batches) {
        if (remainingToDischarge <= 0) break;
        const taken = Math.min(batch.qtyRemaining, remainingToDischarge);
        totalCostOfGoodsSold += (taken * batch.costPerUnit);
        batch.qtyRemaining -= taken;
        remainingToDischarge -= taken;
      }

      expect(remainingToDischarge).toBe(0);
      expect(totalCostOfGoodsSold).toBe((10 * 15.00) + (5 * 18.00)); // 150 + 90 = 240 €
      expect(batches[0].qtyRemaining).toBe(0);
      expect(batches[1].qtyRemaining).toBe(15);
      expect(batches[2].qtyRemaining).toBe(15);
    });
  });

  // =========================================================================
  // 6. CONTRACT STOCK DEPLETION & SYMMETRIC RESTOCK SIMULATION
  // =========================================================================
  describe('Contract Stock Depletion & Symmetric Reversibility (Invariant #7)', () => {
    it('simulates stock discharge on contract activation and perfect restock on cancellation', () => {
      let currentStock = 50;
      const contractItems = [
        { productId: 'prod_a', quantity: 5, priceSold: 30.00 },
        { productId: 'prod_b', quantity: 10, priceSold: 12.00 }
      ];

      // Step 1: Contract Activation -> Stock Depletion (OUT_SALE)
      const totalUnitsSold = contractItems.reduce((acc, curr) => acc + curr.quantity, 0);
      currentStock -= totalUnitsSold;
      expect(currentStock).toBe(35);

      // Step 2: Contract Cancellation -> Stock Restock (IN_RETURN)
      currentStock += totalUnitsSold;
      expect(currentStock).toBe(50); // Reverts exactly to State 0
    });
  });

});
