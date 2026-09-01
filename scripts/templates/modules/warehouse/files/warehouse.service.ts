import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction 
} from '$lib/firebase';
import type { 
  SupplierItem, 
  PurchaseOrderItem, 
  PurchaseOrderItemLine, 
  WarehouseInventoryItem, 
  StockMovementItem, 
  StockMovementType 
} from './schema';
import { WarehouseSettingsService } from './warehouseSettingsService';
import { roundCurrency } from '$lib/utils/math';
import { cleanUndefined } from '$lib/utils/helpers';

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export class OrderStateLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderStateLockedError';
  }
}

export class WarehouseService {
  // =========================================================================
  // MATEMATICA DI DOMINIO & VALORIZZAZIONE (SSOT)
  // =========================================================================

  /**
   * Calcola i totali netti, IVA e lordi di una singola riga d'ordine
   */
  static calculateLineTotals(line: {
    orderedQty: number;
    unitPrice: number;
    vatRate: number;
    discountPercent?: number;
  }): { subtotalNet: number; subtotalVat: number; subtotalGross: number } {
    const qty = Math.max(0, roundCurrency(line.orderedQty, 4));
    const price = Math.max(0, roundCurrency(line.unitPrice, 4));
    const disc = Math.min(100, Math.max(0, roundCurrency(line.discountPercent ?? 0, 2)));
    const vatRate = Math.max(0, roundCurrency(line.vatRate, 2));

    const discountedPrice = price * (1 - disc / 100);
    const subtotalNet = roundCurrency(qty * discountedPrice, 2);
    const subtotalVat = roundCurrency(subtotalNet * (vatRate / 100), 2);
    const subtotalGross = roundCurrency(subtotalNet + subtotalVat, 2);

    return { subtotalNet, subtotalVat, subtotalGross };
  }

  /**
   * Calcola il nuovo Costo Medio Ponderato (CMP) dopo un carico di magazzino
   */
  static calculateCMP(
    currentStock: number,
    currentCMP: number,
    incomingQty: number,
    incomingPrice: number
  ): number {
    const s = Math.max(0, roundCurrency(currentStock, 4));
    const c = Math.max(0, roundCurrency(currentCMP, 4));
    const inQ = Math.max(0, roundCurrency(incomingQty, 4));
    const inP = Math.max(0, roundCurrency(incomingPrice, 4));

    const totalQty = s + inQ;
    if (totalQty <= 0) return c > 0 ? c : inP;

    const totalValue = (s * c) + (inQ * inP);
    return roundCurrency(totalValue / totalQty, 2);
  }

  /**
   * Genera ID composito deterministico per il documento di inventario
   */
  static getInventoryDocId(productId: string, placeId: string = 'default'): string {
    const cleanProd = (productId || 'unknown').trim();
    const cleanPlace = (placeId || 'default').trim();
    return `${cleanProd}_${cleanPlace}`;
  }

  // =========================================================================
  // 1. FORNITORI (SUPPLIERS)
  // =========================================================================

  static async getSuppliers(): Promise<SupplierItem[]> {
    try {
      const q = query(collection(db, 'suppliers'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierItem));
    } catch (err) {
      console.error('Errore getSuppliers:', err);
      return [];
    }
  }

  static async getSupplierById(id: string): Promise<SupplierItem | null> {
    try {
      const snap = await getDoc(doc(db, 'suppliers', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as SupplierItem;
    } catch (err) {
      console.error('Errore getSupplierById:', err);
      return null;
    }
  }

  static async createSupplier(data: Omit<SupplierItem, 'id'>): Promise<string> {
    const settings = await WarehouseSettingsService.getSettings();
    const snap = await getDocs(collection(db, 'suppliers'));
    const nextNum = (snap.size + 1).toString().padStart(4, '0');
    const supplierNumber = data.supplierNumber || `${settings.supplierPrefix}${nextNum}`;

    const newDocRef = doc(collection(db, 'suppliers'));
    const now = new Date().toISOString();

    const payload = cleanUndefined({
      ...data,
      id: newDocRef.id,
      supplierNumber,
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now
    });

    await setDoc(newDocRef, payload);
    return newDocRef.id;
  }

  static async updateSupplier(id: string, data: Partial<SupplierItem>): Promise<void> {
    const ref = doc(db, 'suppliers', id);
    const now = new Date().toISOString();
    await updateDoc(ref, cleanUndefined({ ...data, updatedAt: now }));
  }

  static async deleteSupplier(id: string): Promise<void> {
    await deleteDoc(doc(db, 'suppliers', id));
  }

  // =========================================================================
  // 2. ORDINI DI ACQUISTO (PURCHASE ORDERS)
  // =========================================================================

  static async getPurchaseOrders(statusFilter?: string): Promise<PurchaseOrderItem[]> {
    try {
      const snap = await getDocs(collection(db, 'purchase_orders'));
      let orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrderItem));
      if (statusFilter && statusFilter !== 'all') {
        orders = orders.filter(o => o.status === statusFilter);
      }
      return orders.sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
    } catch (err) {
      console.error('Errore getPurchaseOrders:', err);
      return [];
    }
  }

  static async getPurchaseOrderById(id: string): Promise<PurchaseOrderItem | null> {
    try {
      const snap = await getDoc(doc(db, 'purchase_orders', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as PurchaseOrderItem;
    } catch (err) {
      console.error('Errore getPurchaseOrderById:', err);
      return null;
    }
  }

  static async createPurchaseOrder(data: Omit<PurchaseOrderItem, 'id' | 'poNumber' | 'totalNetAmount' | 'totalVatAmount' | 'totalGrossAmount'>): Promise<string> {
    const settings = await WarehouseSettingsService.getSettings();
    const snap = await getDocs(collection(db, 'purchase_orders'));
    const nextNum = (snap.size + 1).toString().padStart(4, '0');
    const year = new Date().getFullYear();
    const poNumber = `${settings.poPrefix}${year}-${nextNum}`;

    let totalNetAmount = 0;
    let totalVatAmount = 0;
    let totalGrossAmount = 0;

    const recalculatedItems = (data.items || []).map(item => {
      const totals = this.calculateLineTotals(item);
      totalNetAmount += totals.subtotalNet;
      totalVatAmount += totals.subtotalVat;
      totalGrossAmount += totals.subtotalGross;
      return {
        ...item,
        receivedQty: item.receivedQty || 0,
        subtotalNet: totals.subtotalNet,
        subtotalVat: totals.subtotalVat,
        subtotalGross: totals.subtotalGross
      };
    });

    const newDocRef = doc(collection(db, 'purchase_orders'));
    const now = new Date().toISOString();

    const payload = cleanUndefined({
      ...data,
      id: newDocRef.id,
      poNumber,
      status: data.status || 'bozza',
      items: recalculatedItems,
      totalNetAmount: roundCurrency(totalNetAmount),
      totalVatAmount: roundCurrency(totalVatAmount),
      totalGrossAmount: roundCurrency(totalGrossAmount),
      createdAt: now,
      updatedAt: now
    });

    await setDoc(newDocRef, payload);
    return newDocRef.id;
  }

  static async updatePurchaseOrder(id: string, data: Partial<PurchaseOrderItem>): Promise<void> {
    const existing = await this.getPurchaseOrderById(id);
    if (!existing) throw new Error('Ordine di acquisto non trovato');

    if (existing.status === 'ricevuto_totale' && data.items) {
      throw new OrderStateLockedError('Impossibile modificare le righe di un ordine fornitore già interamente ricevuto.');
    }

    let items = data.items || existing.items;
    let totalNetAmount = 0;
    let totalVatAmount = 0;
    let totalGrossAmount = 0;

    items = items.map(item => {
      const totals = this.calculateLineTotals(item);
      totalNetAmount += totals.subtotalNet;
      totalVatAmount += totals.subtotalVat;
      totalGrossAmount += totals.subtotalGross;
      return {
        ...item,
        subtotalNet: totals.subtotalNet,
        subtotalVat: totals.subtotalVat,
        subtotalGross: totals.subtotalGross
      };
    });

    const now = new Date().toISOString();
    const payload = cleanUndefined({
      ...data,
      items,
      totalNetAmount: roundCurrency(totalNetAmount),
      totalVatAmount: roundCurrency(totalVatAmount),
      totalGrossAmount: roundCurrency(totalGrossAmount),
      updatedAt: now
    });

    await updateDoc(doc(db, 'purchase_orders', id), payload);
  }

  static async deletePurchaseOrder(id: string): Promise<void> {
    const existing = await this.getPurchaseOrderById(id);
    if (!existing) return;
    if (existing.status === 'ricevuto_parziale' || existing.status === 'ricevuto_totale') {
      throw new OrderStateLockedError('Non è possibile eliminare un ordine di acquisto con merce già ricevuta a magazzino.');
    }
    await deleteDoc(doc(db, 'purchase_orders', id));
  }

  /**
   * Wizard atomico transazionale di ricezione merce da Ordine Fornitore (DDT Entrata)
   */
  static async receiveOrderItems(
    poId: string,
    receivedLines: Array<{ productId: string; receivedQtyDelta: number; batchNumber?: string; expiryDate?: string }>,
    destinationPlaceId: string = 'default',
    destinationPlaceName: string = 'Magazzino Centrale',
    performerUid?: string,
    performerName?: string,
    notes?: string
  ): Promise<void> {
    const settings = await WarehouseSettingsService.getSettings();

    await runTransaction(db, async (transaction) => {
      const poRef = doc(db, 'purchase_orders', poId);
      const poSnap = await transaction.get(poRef);
      if (!poSnap.exists()) throw new Error(`Ordine di acquisto ${poId} non trovato`);

      const po = poSnap.data() as PurchaseOrderItem;
      const now = new Date().toISOString();
      const year = new Date().getFullYear();

      // Mappa delle righe dell'ordine aggiornate
      const updatedLines = po.items.map(line => {
        const match = receivedLines.find(r => r.productId === line.productId);
        if (match && match.receivedQtyDelta > 0) {
          const newRec = roundCurrency((line.receivedQty || 0) + match.receivedQtyDelta, 4);
          return { ...line, receivedQty: newRec };
        }
        return line;
      });

      // Valuta nuovo stato PO
      const allComplete = updatedLines.every(l => (l.receivedQty || 0) >= l.orderedQty);
      const anyReceived = updatedLines.some(l => (l.receivedQty || 0) > 0);
      const newStatus = allComplete ? 'ricevuto_totale' : (anyReceived ? 'ricevuto_parziale' : po.status);

      transaction.update(poRef, {
        items: updatedLines,
        status: newStatus,
        updatedAt: now
      });

      // Per ogni riga ricevuta, aggiorna inventario ed emette movimento
      for (const rec of receivedLines) {
        if (rec.receivedQtyDelta <= 0) continue;

        const line = po.items.find(l => l.productId === rec.productId);
        if (!line) continue;

        const invDocId = this.getInventoryDocId(rec.productId, destinationPlaceId);
        const invRef = doc(db, 'warehouse_inventory', invDocId);
        const invSnap = await transaction.get(invRef);

        let currentStock = 0;
        let currentCMP = line.unitPrice;
        let currentAllocated = 0;
        let minThreshold = settings.defaultMinThreshold;

        if (invSnap.exists()) {
          const invData = invSnap.data() as WarehouseInventoryItem;
          currentStock = invData.stockQty || 0;
          currentCMP = invData.avgUnitCost || line.unitPrice;
          currentAllocated = invData.allocatedQty || 0;
          minThreshold = typeof invData.minReorderThreshold === 'number' ? invData.minReorderThreshold : minThreshold;
        }

        const newStock = roundCurrency(currentStock + rec.receivedQtyDelta, 4);
        const newCMP = this.calculateCMP(currentStock, currentCMP, rec.receivedQtyDelta, line.unitPrice);
        const newAvailable = roundCurrency(newStock - currentAllocated, 4);
        const newTotalValuation = roundCurrency(newStock * newCMP, 2);
        const isLowStock = newStock <= minThreshold;

        const invPayload: WarehouseInventoryItem = {
          id: invDocId,
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          unit: line.unit,
          placeId: destinationPlaceId,
          placeName: destinationPlaceName,
          stockQty: newStock,
          allocatedQty: currentAllocated,
          availableQty: newAvailable,
          minReorderThreshold: minThreshold,
          avgUnitCost: newCMP,
          lastPurchasePrice: line.unitPrice,
          totalValuation: newTotalValuation,
          isLowStock,
          updatedAt: now
        };

        transaction.set(invRef, cleanUndefined(invPayload), { merge: true });

        // Registra movimento di carico
        const movRef = doc(collection(db, 'stock_movements'));
        const movNumber = `${settings.movementPrefix}${year}-${Math.floor(1000 + Math.random() * 9000)}`;

        const movPayload = cleanUndefined({
          id: movRef.id,
          movementNumber: movNumber,
          movementType: 'IN_PURCHASE',
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          unit: line.unit,
          quantity: rec.receivedQtyDelta,
          unitCost: line.unitPrice,
          totalCost: roundCurrency(rec.receivedQtyDelta * line.unitPrice, 2),
          toPlaceId: destinationPlaceId,
          toPlaceName: destinationPlaceName,
          batchNumber: rec.batchNumber || '',
          expiryDate: rec.expiryDate || '',
          movementDate: now,
          performedByUid: performerUid || '',
          performedByName: performerName || '',
          relatedDocType: 'purchase_order',
          relatedDocId: poId,
          notes: notes || `Ricezione da Ordine ${po.poNumber}`,
          createdAt: now
        });

        transaction.set(movRef, movPayload);
      }
    });
  }

  // =========================================================================
  // 3. GIACENZE & MOVIMENTAZIONI (INVENTORY & STOCK MOVEMENTS)
  // =========================================================================

  static async getInventory(placeIdFilter?: string): Promise<WarehouseInventoryItem[]> {
    try {
      const snap = await getDocs(collection(db, 'warehouse_inventory'));
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as WarehouseInventoryItem));
      if (placeIdFilter && placeIdFilter !== 'all') {
        list = list.filter(i => i.placeId === placeIdFilter);
      }
      return list.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));
    } catch (err) {
      console.error('Errore getInventory:', err);
      return [];
    }
  }

  static async getLowStockItems(): Promise<WarehouseInventoryItem[]> {
    try {
      const items = await this.getInventory();
      return items.filter(i => i.isLowStock);
    } catch (err) {
      console.error('Errore getLowStockItems:', err);
      return [];
    }
  }

  static async getMovements(limitCount: number = 100): Promise<StockMovementItem[]> {
    try {
      const snap = await getDocs(collection(db, 'stock_movements'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovementItem));
      return list
        .sort((a, b) => (b.movementDate || '').localeCompare(a.movementDate || ''))
        .slice(0, limitCount);
    } catch (err) {
      console.error('Errore getMovements:', err);
      return [];
    }
  }

  /**
   * Esegue una movimentazione di magazzino generica con transazione atomica e verifica giacenze
   */
  static async recordManualMovement(input: {
    movementType: StockMovementType;
    productId: string;
    productName: string;
    sku: string;
    unit: string;
    quantity: number;
    unitCost?: number;
    fromPlaceId?: string;
    fromPlaceName?: string;
    toPlaceId?: string;
    toPlaceName?: string;
    batchNumber?: string;
    expiryDate?: string;
    performedByUid?: string;
    performedByName?: string;
    relatedDocType?: 'purchase_order' | 'place' | 'contract' | 'manual';
    relatedDocId?: string;
    notes?: string;
  }): Promise<string> {
    const qty = Math.max(0, roundCurrency(input.quantity, 4));
    if (qty <= 0) throw new Error('La quantità del movimento deve essere maggiore di 0');

    const settings = await WarehouseSettingsService.getSettings();
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    let createdMovId = '';

    await runTransaction(db, async (transaction) => {
      const movRef = doc(collection(db, 'stock_movements'));
      createdMovId = movRef.id;
      const movNumber = `${settings.movementPrefix}${year}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (input.movementType === 'IN_INITIAL' || input.movementType === 'IN_RETURN') {
        // Carico positivo
        const targetPlace = input.toPlaceId || 'default';
        const targetPlaceName = input.toPlaceName || 'Magazzino Centrale';
        const invId = this.getInventoryDocId(input.productId, targetPlace);
        const invRef = doc(db, 'warehouse_inventory', invId);
        const invSnap = await transaction.get(invRef);

        let currentStock = 0;
        let currentCMP = input.unitCost || 0;
        let currentAllocated = 0;
        let minThreshold = settings.defaultMinThreshold;

        if (invSnap.exists()) {
          const d = invSnap.data() as WarehouseInventoryItem;
          currentStock = d.stockQty || 0;
          currentCMP = d.avgUnitCost || input.unitCost || 0;
          currentAllocated = d.allocatedQty || 0;
          minThreshold = typeof d.minReorderThreshold === 'number' ? d.minReorderThreshold : minThreshold;
        }

        const newStock = roundCurrency(currentStock + qty, 4);
        const newCMP = input.unitCost ? this.calculateCMP(currentStock, currentCMP, qty, input.unitCost) : currentCMP;
        const newAvailable = roundCurrency(newStock - currentAllocated, 4);
        const totalVal = roundCurrency(newStock * newCMP, 2);

        transaction.set(invRef, cleanUndefined({
          id: invId,
          productId: input.productId,
          productName: input.productName,
          sku: input.sku,
          unit: input.unit,
          placeId: targetPlace,
          placeName: targetPlaceName,
          stockQty: newStock,
          allocatedQty: currentAllocated,
          availableQty: newAvailable,
          minReorderThreshold: minThreshold,
          avgUnitCost: newCMP,
          totalValuation: totalVal,
          isLowStock: newStock <= minThreshold,
          updatedAt: now
        } as WarehouseInventoryItem), { merge: true });

      } else if (input.movementType === 'OUT_SITE_USAGE' || input.movementType === 'OUT_SALE' || input.movementType === 'OUT_SCRAP') {
        // Scarico negativo
        const sourcePlace = input.fromPlaceId || 'default';
        const invId = this.getInventoryDocId(input.productId, sourcePlace);
        const invRef = doc(db, 'warehouse_inventory', invId);
        const invSnap = await transaction.get(invRef);

        if (!invSnap.exists()) {
          if (!settings.allowNegativeStock) {
            throw new InsufficientStockError(`Nessuna giacenza registrata per l'articolo ${input.productName} nel magazzino selezionato.`);
          }
        }

        const currentData = invSnap.exists() ? (invSnap.data() as WarehouseInventoryItem) : null;
        const currentStock = currentData ? currentData.stockQty : 0;
        const currentAvailable = currentData ? currentData.availableQty : 0;
        const currentCMP = currentData ? currentData.avgUnitCost : (input.unitCost || 0);
        const currentAllocated = currentData ? currentData.allocatedQty : 0;
        const minThreshold = currentData ? currentData.minReorderThreshold : settings.defaultMinThreshold;

        if (!settings.allowNegativeStock && currentAvailable < qty) {
          throw new InsufficientStockError(`Disponibilità insufficiente per ${input.productName}: richiesti ${qty}, disponibili ${currentAvailable}`);
        }

        const newStock = roundCurrency(currentStock - qty, 4);
        const newAvailable = roundCurrency(newStock - currentAllocated, 4);
        const totalVal = roundCurrency(Math.max(0, newStock) * currentCMP, 2);

        transaction.set(invRef, cleanUndefined({
          id: invId,
          productId: input.productId,
          productName: input.productName,
          sku: input.sku,
          unit: input.unit,
          placeId: sourcePlace,
          placeName: input.fromPlaceName || 'Magazzino Centrale',
          stockQty: newStock,
          allocatedQty: currentAllocated,
          availableQty: newAvailable,
          minReorderThreshold: minThreshold,
          avgUnitCost: currentCMP,
          totalValuation: totalVal,
          isLowStock: newStock <= minThreshold,
          updatedAt: now
        } as WarehouseInventoryItem), { merge: true });

      } else if (input.movementType === 'TRANSFER') {
        // Trasferimento interno da source a target
        const fromPlace = input.fromPlaceId || 'default';
        const toPlace = input.toPlaceId || 'default';
        if (fromPlace === toPlace) throw new Error('Il deposito di origine e destinazione devono essere differenti');

        const fromId = this.getInventoryDocId(input.productId, fromPlace);
        const toId = this.getInventoryDocId(input.productId, toPlace);
        const fromRef = doc(db, 'warehouse_inventory', fromId);
        const toRef = doc(db, 'warehouse_inventory', toId);

        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);

        const fromData = fromSnap.exists() ? (fromSnap.data() as WarehouseInventoryItem) : null;
        const fromStock = fromData ? fromData.stockQty : 0;
        const fromAvailable = fromData ? fromData.availableQty : 0;
        const cmp = fromData ? fromData.avgUnitCost : (input.unitCost || 0);

        if (!settings.allowNegativeStock && fromAvailable < qty) {
          throw new InsufficientStockError(`Impossibile trasferire: quantità non disponibile in origine (richiesti ${qty}, disponibili ${fromAvailable})`);
        }

        // Scala da origine
        const newFromStock = roundCurrency(fromStock - qty, 4);
        transaction.set(fromRef, cleanUndefined({
          ...fromData,
          id: fromId,
          productId: input.productId,
          productName: input.productName,
          sku: input.sku,
          unit: input.unit,
          placeId: fromPlace,
          placeName: input.fromPlaceName || fromPlace,
          stockQty: newFromStock,
          availableQty: roundCurrency(newFromStock - (fromData?.allocatedQty || 0), 4),
          totalValuation: roundCurrency(Math.max(0, newFromStock) * cmp, 2),
          isLowStock: newFromStock <= (fromData?.minReorderThreshold || settings.defaultMinThreshold),
          updatedAt: now
        }), { merge: true });

        // Incrementa su destinazione
        const toData = toSnap.exists() ? (toSnap.data() as WarehouseInventoryItem) : null;
        const toStock = toData ? toData.stockQty : 0;
        const newToStock = roundCurrency(toStock + qty, 4);

        transaction.set(toRef, cleanUndefined({
          ...toData,
          id: toId,
          productId: input.productId,
          productName: input.productName,
          sku: input.sku,
          unit: input.unit,
          placeId: toPlace,
          placeName: input.toPlaceName || toPlace,
          stockQty: newToStock,
          availableQty: roundCurrency(newToStock - (toData?.allocatedQty || 0), 4),
          minReorderThreshold: toData?.minReorderThreshold || settings.defaultMinThreshold,
          avgUnitCost: cmp,
          totalValuation: roundCurrency(newToStock * cmp, 2),
          isLowStock: newToStock <= (toData?.minReorderThreshold || settings.defaultMinThreshold),
          updatedAt: now
        }), { merge: true });
      }

      // Registra documento immutabile in stock_movements
      const cost = input.unitCost || 0;
      const movPayload = cleanUndefined({
        id: movRef.id,
        movementNumber: movNumber,
        movementType: input.movementType,
        productId: input.productId,
        productName: input.productName,
        sku: input.sku,
        unit: input.unit,
        quantity: qty,
        unitCost: cost,
        totalCost: roundCurrency(qty * cost, 2),
        fromPlaceId: input.fromPlaceId,
        fromPlaceName: input.fromPlaceName,
        toPlaceId: input.toPlaceId,
        toPlaceName: input.toPlaceName,
        batchNumber: input.batchNumber || '',
        expiryDate: input.expiryDate || '',
        movementDate: now,
        performedByUid: input.performedByUid || '',
        performedByName: input.performedByName || '',
        relatedDocType: input.relatedDocType || 'manual',
        relatedDocId: input.relatedDocId || '',
        notes: input.notes || '',
        createdAt: now
      });

      transaction.set(movRef, movPayload);
    });

    return createdMovId;
  }
}
