import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction
} from '$lib/firebase';
import type { ContractItem, ContractInstallment, ContractProductItem } from './schema';
import { ContractSettingsService } from './contractSettingsService';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';
import { generateId } from '$lib/utils/helpers';
import { menuConfigStore } from '$lib/stores/menu';
import { get } from 'svelte/store';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { ContractsVersioningBridge } from './contracts.versioning.bridge';


function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = sanitizeFirestoreData(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item !== null && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)
          ? sanitizeFirestoreData(item)
          : item === undefined ? null : item
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export class ContractsService {
  private static COLLECTION_NAME = 'contracts';

  /**
   * Helper di normalizzazione resiliente (Dual-Schema):
   * Mappa trasparentemente sia i documenti con chiavi root sia quelli storici annidati in original.*
   */
  static normalizeContractData(data: any, id?: string): ContractItem {
    if (!data) return {} as ContractItem;
    const orig = data.original || {};

    const rawItems: any[] = data.items || orig.products || [];
    const items: ContractProductItem[] = rawItems.map((p: any) => {
      const listPrice = Number(p.listPrice ?? p.price ?? 0);
      const minPrice = Number(p.minPrice ?? 0);
      const priceSold = Number(p.priceSold ?? p.finalPrice ?? p.price ?? listPrice);
      const quantity = Number(p.quantity ?? 1);
      const subtotal = Number(p.subtotal ?? (priceSold * quantity));
      return {
        productId: p.productId || p.id || '',
        productName: p.productName || p.name || 'Articolo',
        description: p.description || '',
        unit: p.unit || '',
        quantity,
        listPrice,
        minPrice,
        priceSold,
        subtotal,
        isOptional: Boolean(p.isOptional),
        minimoFatturabileText: p.minimoFatturabileText || '',
        notes: p.notes || ''
      };
    });

    const totalAmount = Number(data.totalAmount ?? orig.totalPrice ?? (items.reduce((s, i) => s + (i.subtotal || 0), 0)));
    const hasPriceWarning = Boolean(data.hasPriceWarning ?? orig.hasWarning ?? items.some(i => i.priceSold < (i.minPrice || 0)));

    return {
      id: id || data.id,
      contractNumber: data.contractNumber || orig.contractNumber || '',
      title: data.title || orig.title || '',
      clientId: data.clientId || orig.clientId || '',
      clientName: data.clientName || orig.clientName || '',
      agentId: data.agentId || orig.vendorUid || orig.createdBy || '',
      agentName: data.agentName || orig.vendorEmail || '',
      coSellerUid: data.coSellerUid || orig.secondVendorUid || '',
      coSellerEmail: data.coSellerEmail || orig.secondVendorEmail || '',
      coSellerShare: data.coSellerShare != null ? Number(data.coSellerShare) : (orig.secondVendorShare != null ? Number(orig.secondVendorShare) : undefined),
      projectId: data.projectId || orig.projectId || data.cantiereId || orig.cantiereId || '',
      projectName: data.projectName || orig.projectName || data.cantiereName || orig.cantiereName || '',
      placeId: data.placeId || orig.placeId || '',
      placeName: data.placeName || orig.placeName || '',
      type: data.type || orig.type || 'Non Ricorrente',
      billingFrequency: data.billingFrequency || orig.billingFrequency || 'una_usa',
      startDate: data.startDate || orig.startDate || (data.createdAt ? String(data.createdAt).slice(0, 10) : ''),
      endDate: data.endDate || orig.endDate || '',
      status: data.status || orig.status || 'bozza',
      notes: data.notes || orig.notes || '',
      clientNotes: data.clientNotes || orig.clientNotes || '',
      adminNotes: data.adminNotes || orig.adminNotes || '',
      termsAndConditions: data.termsAndConditions || orig.termsAndConditions || '',
      items,
      tags: data.tags || orig.tags || [],
      taxableAmount: data.taxableAmount ?? orig.taxableAmount ?? totalAmount,
      discountType: data.discountType || orig.discountType,
      discountValue: data.discountValue ?? orig.discountValue,
      discountAmount: data.discountAmount ?? orig.discountAmount ?? 0,
      totalAmount,
      hasPriceWarning,
      customFields: data.customFields || orig.customFields || {},
      createdAt: data.createdAt || data.edits?.createdAt || orig.createdAt || '',
      updatedAt: data.updatedAt || data.edits?.modifiedAt || orig.updatedAt || '',
      original: orig,
      edits: data.edits || {
        createdAt: data.createdAt || orig.createdAt,
        createdBy: data.agentId || orig.vendorUid,
        modifiedAt: data.updatedAt,
        approvedAt: orig.approvedAt,
        approvedBy: orig.approvedBy,
        approvedEmail: orig.approvedEmail
      },
      derived: data.derived || {}
    };
  }

  static async getContracts(): Promise<ContractItem[]> {
    let snap;
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('createdAt', 'desc')
      );
      snap = await getDocs(q);
    } catch (e) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    if (snap.empty) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    const list = snap.docs
      .map(d => this.normalizeContractData(d.data(), d.id))
      .filter(c => !(c as any).derived?.deleted);

    list.sort((a, b) => {
      const dA = a.createdAt || (a as any).edits?.createdAt || '';
      const dB = b.createdAt || (b as any).edits?.createdAt || '';
      return dB.localeCompare(dA);
    });
    return list;
  }

  static async getContractById(id: string): Promise<ContractItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.derived?.deleted) return null;
    return this.normalizeContractData(data, snap.id);
  }

  static async getClientContracts(clientId: string): Promise<ContractItem[]> {
    try {
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, this.COLLECTION_NAME), where('clientId', '==', clientId))),
        getDocs(query(collection(db, this.COLLECTION_NAME), where('original.clientId', '==', clientId)))
      ]);
      const map = new Map<string, ContractItem>();
      snap1.forEach(d => {
        if (!d.data()?.derived?.deleted) map.set(d.id, this.normalizeContractData(d.data(), d.id));
      });
      snap2.forEach(d => {
        if (!d.data()?.derived?.deleted) map.set(d.id, this.normalizeContractData(d.data(), d.id));
      });
      return Array.from(map.values());
    } catch (e) {
      console.error('Errore getClientContracts:', e);
      return [];
    }
  }

  /**
   * Anteprima in sola lettura del prossimo numero progressivo (senza incrementare)
   */
  static async previewNextContractNumber(): Promise<string> {
    const settings = await ContractSettingsService.getSettings();
    const currentYear = new Date().getFullYear();

    let nextNumber = (settings.lastNumber || 0) + 1;
    if (settings.resetCounterAnnually && settings.lastCounterYear !== currentYear) {
      nextNumber = 1;
    }

    const prefix = settings.prefix || (settings.entityNaming === 'quote' ? 'PREV-' : 'CTR-');
    const yearPart = settings.includeYear ? `${currentYear}-` : '';
    const numPart = String(nextNumber).padStart(settings.numberPadding || 4, '0');

    return `${prefix}${yearPart}${numPart}`;
  }

  /**
   * Genera ed incrementa atomicamente il prossimo numero progressivo con Transazione Firestore
   */
  static async generateNextContractNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const settingsRef = doc(db, 'settings', 'contracts');

    let formattedNumber = '';

    await runTransaction(db, async (transaction) => {
      const settingsSnap = await transaction.get(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : await ContractSettingsService.getSettings();

      let nextNumber = (settings.lastNumber || 0) + 1;
      if (settings.resetCounterAnnually && settings.lastCounterYear !== currentYear) {
        nextNumber = 1;
      }

      const prefix = settings.prefix || (settings.entityNaming === 'quote' ? 'PREV-' : 'CTR-');
      const yearPart = settings.includeYear ? `${currentYear}-` : '';
      const numPart = String(nextNumber).padStart(settings.numberPadding || 4, '0');

      formattedNumber = `${prefix}${yearPart}${numPart}`;

      transaction.set(settingsRef, {
        ...settings,
        lastNumber: nextNumber,
        lastCounterYear: currentYear,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    return formattedNumber;
  }

  static async createContract(
    data: Partial<ContractItem>,
    options?: { uid?: string; userEmail?: string; tenantId?: string }
  ): Promise<string> {
    const settings = await ContractSettingsService.getSettings();
    const labels = ContractSettingsService.getLabels(settings);

    let contractNumber = data.contractNumber?.trim();
    if (!contractNumber) {
      contractNumber = await this.generateNextContractNumber();
    }

    const effectiveTitle = data.title?.trim() 
      ? data.title.trim() 
      : `${labels.singular} ${contractNumber} - ${data.clientName || 'Cliente'}`;

    const textSearch = generateSearchTerms(`${contractNumber} ${effectiveTitle} ${data.clientName || ''}`);
    const now = new Date().toISOString();

    const items = data.items || [];
    const totalAmount = data.totalAmount ?? items.reduce((s, i) => s + (i.subtotal || 0), 0);
    const hasPriceWarning = data.hasPriceWarning ?? items.some(i => i.priceSold < (i.minPrice || 0));

    const contractId = data.id || generateId();
    const contractRef = doc(db, this.COLLECTION_NAME, contractId);

    const payload = sanitizeFirestoreData({
      ...data,
      id: contractId,
      contractNumber,
      title: effectiveTitle,
      totalAmount,
      hasPriceWarning,
      // Retrocompatibilità dual-write per trigger legacy
      original: {
        contractNumber,
        title: effectiveTitle,
        clientId: data.clientId || '',
        clientName: data.clientName || '',
        vendorUid: data.agentId || '',
        vendorEmail: data.agentName || '',
        secondVendorUid: data.coSellerUid || null,
        secondVendorShare: data.coSellerShare || null,
        secondVendorEmail: data.coSellerEmail || null,
        products: items,
        totalPrice: totalAmount,
        status: data.status || 'bozza',
        hasWarning: hasPriceWarning,
        createdAt: now
      },
      edits: {
        createdAt: now,
        createdBy: options?.uid || data.agentId || 'system'
      },
      derived: {
        textSearch
      },
      createdAt: now,
      updatedAt: now
    });

    const diff = computeDiff(null, payload, {
      semanticsMap: ContractsVersioningBridge.getSemanticsMap()
    });

    await VersioningService.executeDualWriteTransaction(
      db,
      contractRef,
      payload,
      {
        tenantId: options?.tenantId || 'default',
        module: 'contracts',
        entityType: 'contract',
        entityId: contractId,
        entityLabel: ContractsVersioningBridge.getEntityLabel(payload),
        eventType: 'FIELD_MUTATION',
        keysChanged: diff.keysChanged,
        mutations: diff.mutations,
        performedBy: options?.uid || data.agentId || 'system',
        performedByName: options?.userEmail || data.agentName,
        actorType: 'USER',
        reason: 'Creazione contratto / preventivo'
      },
      0
    );

    try {
      const chunkId = await CacheLookupService.updateEntityCache('contracts', contractId, effectiveTitle);
      if (chunkId) {
        await updateDoc(contractRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache contratti:', e);
    }

    // Sincronizzazione automatica scorte magazzino se attivo
    await this.syncContractStockMovements(payload as any as ContractItem, undefined, options);

    return contractId;
  }

  static async updateContract(
    id: string, 
    data: Partial<ContractItem>,
    options?: { uid?: string; userEmail?: string; tenantId?: string; expectedBaseVersion?: number; reason?: string }
  ): Promise<void> {
    const contractRef = doc(db, this.COLLECTION_NAME, id);
    const existingSnap = await getDoc(contractRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as ContractItem) : null;
    const now = new Date().toISOString();
    const sanitized: Record<string, any> = {};

    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    const title = data.title !== undefined ? data.title : (existing?.title || '');
    const num = data.contractNumber || existing?.contractNumber || '';
    const client = data.clientName || existing?.clientName || '';
    const textSearch = generateSearchTerms(`${num} ${title} ${client}`);

    const items = data.items !== undefined ? data.items : (existing?.items || []);
    const totalAmount = data.totalAmount !== undefined ? data.totalAmount : (existing?.totalAmount ?? items.reduce((s, i) => s + (i.subtotal || 0), 0));
    const hasPriceWarning = data.hasPriceWarning !== undefined ? data.hasPriceWarning : (items.some(i => i.priceSold < (i.minPrice || 0)));

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      ...sanitized,
      totalAmount,
      hasPriceWarning,
      updatedAt: now,
      derived: {
        ...(existing?.derived || {}),
        textSearch
      },
      original: {
        ...(existing?.original || {}),
        ...(sanitized['original'] || {}),
        products: items,
        totalPrice: totalAmount,
        hasWarning: hasPriceWarning,
        status: data.status || existing?.status || existing?.original?.status || 'bozza',
        secondVendorUid: data.coSellerUid !== undefined ? data.coSellerUid : (existing?.coSellerUid || null),
        secondVendorShare: data.coSellerShare !== undefined ? data.coSellerShare : (existing?.coSellerShare || null),
        secondVendorEmail: data.coSellerEmail !== undefined ? data.coSellerEmail : (existing?.coSellerEmail || null)
      }
    };

    const payload = sanitizeFirestoreData(nextEntityData);
    const diff = computeDiff(existing, payload, {
      semanticsMap: ContractsVersioningBridge.getSemanticsMap()
    });

    if (diff.keysChanged.length > 0) {
      await VersioningService.executeDualWriteTransaction(
        db,
        contractRef,
        payload,
        {
          tenantId: options?.tenantId || 'default',
          module: 'contracts',
          entityType: 'contract',
          entityId: id,
          entityLabel: ContractsVersioningBridge.getEntityLabel(payload),
          eventType: 'FIELD_MUTATION',
          keysChanged: diff.keysChanged,
          mutations: diff.mutations,
          performedBy: options?.uid || 'system',
          performedByName: options?.userEmail,
          actorType: 'USER',
          reason: options?.reason || 'Aggiornamento dati contratto'
        },
        options?.expectedBaseVersion !== undefined ? options.expectedBaseVersion : ((existing as any)?.edits?.aggregateVersion ?? 0)
      );
    } else {
      await updateDoc(contractRef, { updatedAt: now });
    }

    if (data.title !== undefined || data.contractNumber || data.clientName) {
      try {
        await CacheLookupService.updateEntityCache('contracts', id, title);
      } catch (e) {
        console.warn('Errore aggiornamento cache contratto:', e);
      }
    }

    // Sincronizzazione automatica scorte magazzino su variazione stato
    await this.syncContractStockMovements(payload as any as ContractItem, existing?.status, options);
  }

  /**
   * Sincronizzazione dinamica e simmetrica delle scorte con il modulo Warehouse.
   * Scarica la merce fisica (OUT_SALE) all'attivazione/approvazione e reintegra (IN_RETURN) all'annullamento.
   */
  static async syncContractStockMovements(
    contract: ContractItem,
    previousStatus?: string,
    options?: { uid?: string; userEmail?: string }
  ): Promise<void> {
    try {
      const menuModules = get(menuConfigStore);
      if (!menuModules.some(m => m.id === 'warehouse')) return;

      const servicePath = '../../warehouse/warehouse.service';
      // @ts-ignore
      const mod: any = await import(/* @vite-ignore */ servicePath);
      const WarehouseService = mod?.WarehouseService;
      if (!WarehouseService) return;

      const isNowActive = contract.status === 'approvato' || contract.status === 'attivo';
      const wasActive = previousStatus === 'approvato' || previousStatus === 'attivo';
      const isCancelled = contract.status === 'annullato' || contract.status === 'rifiutato';

      const physicalItems = (contract.items || []).filter(item => Boolean(item.productId));
      if (physicalItems.length === 0) return;

      const contractRef = doc(db, this.COLLECTION_NAME, contract.id!);
      const contractPlace = contract.placeId || 'default';
      const contractPlaceName = contract.placeName || 'Magazzino Centrale';

      if (isNowActive && contract.derived?.stockStatus !== 'depleted') {
        const movementIds: string[] = [];
        for (const item of physicalItems) {
          const movId = await WarehouseService.recordManualMovement({
            movementType: 'OUT_SALE',
            productId: item.productId,
            productName: item.productName || (item as any).name || 'Articolo',
            sku: (item as any).sku || '',
            unit: item.unit || 'pz',
            quantity: item.quantity || 1,
            unitCost: item.priceSold || item.listPrice || 0,
            fromPlaceId: contractPlace,
            fromPlaceName: contractPlaceName,
            performedByUid: options?.uid || contract.agentId || 'system',
            performedByName: options?.userEmail || contract.agentName || 'Sistema Contratti',
            relatedDocType: 'contract',
            relatedDocId: contract.id,
            notes: `Scarico per Vendita Contratto ${contract.contractNumber || contract.id}`
          });
          if (movId) movementIds.push(movId);
        }

        await updateDoc(contractRef, {
          'derived.stockStatus': 'depleted',
          'derived.stockMovementIds': movementIds
        });
      } else if (wasActive && isCancelled && contract.derived?.stockStatus === 'depleted') {
        for (const item of physicalItems) {
          await WarehouseService.recordManualMovement({
            movementType: 'IN_RETURN',
            productId: item.productId,
            productName: item.productName || (item as any).name || 'Articolo',
            sku: (item as any).sku || '',
            unit: item.unit || 'pz',
            quantity: item.quantity || 1,
            unitCost: item.priceSold || item.listPrice || 0,
            toPlaceId: contractPlace,
            toPlaceName: contractPlaceName,
            performedByUid: options?.uid || contract.agentId || 'system',
            performedByName: options?.userEmail || contract.agentName || 'Sistema Contratti',
            relatedDocType: 'contract',
            relatedDocId: contract.id,
            notes: `Storno/Reintegro per Annullamento Contratto ${contract.contractNumber || contract.id}`
          });
        }

        await updateDoc(contractRef, {
          'derived.stockStatus': 'restocked'
        });
      }
    } catch (err) {
      console.warn('Avviso sincronizzazione scorte contratto:', err);
    }
  }

  static async deleteContract(
    id: string, 
    options?: { uid?: string; userEmail?: string; tenantId?: string }
  ): Promise<void> {
    const contractRef = doc(db, this.COLLECTION_NAME, id);
    const existingSnap = await getDoc(contractRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as ContractItem) : null;
    const now = new Date().toISOString();

    // Reintegro simmetrico se il contratto era stato evaso a magazzino
    if (existing?.derived?.stockStatus === 'depleted') {
      try {
        const menuModules = get(menuConfigStore);
        if (menuModules.some(m => m.id === 'warehouse')) {
          const servicePath = '../../warehouse/warehouse.service';
          // @ts-ignore
          const mod: any = await import(/* @vite-ignore */ servicePath);
          const WarehouseService = mod?.WarehouseService;
          if (WarehouseService) {
            const physicalItems = (existing.items || []).filter(item => Boolean(item.productId));
            for (const item of physicalItems) {
              await WarehouseService.recordManualMovement({
                movementType: 'IN_RETURN',
                productId: item.productId,
                productName: item.productName || (item as any).name || 'Articolo',
                sku: (item as any).sku || '',
                unit: item.unit || 'pz',
                quantity: item.quantity || 1,
                unitCost: item.priceSold || item.listPrice || 0,
                toPlaceId: existing.placeId || 'default',
                toPlaceName: existing.placeName || 'Magazzino Centrale',
                performedByUid: options?.uid || (typeof options === 'string' ? options : 'system'),
                performedByName: options?.userEmail || 'Sistema Contratti',
                relatedDocType: 'contract',
                relatedDocId: existing.id,
                notes: `Storno/Reintegro per Eliminazione Contratto ${existing.contractNumber || existing.id}`
              });
            }
          }
        }
      } catch (err) {
        console.warn('Avviso reintegro scorte su eliminazione contratto:', err);
      }
    }

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      derived: {
        ...(existing?.derived || {}),
        deleted: true,
        stockStatus: 'restocked'
      },
      edits: {
        ...(existing as any)?.edits,
        deletedAt: now,
        deletedBy: options?.uid || (typeof options === 'string' ? options : 'system')
      }
    };

    const payload = sanitizeFirestoreData(nextEntityData);

    await VersioningService.executeDualWriteTransaction(
      db,
      contractRef,
      payload,
      {
        tenantId: options?.tenantId || 'default',
        module: 'contracts',
        entityType: 'contract',
        entityId: id,
        entityLabel: ContractsVersioningBridge.getEntityLabel(existing),
        eventType: 'STATUS_CHANGE',
        keysChanged: ['derived.deleted'],
        mutations: {
          'derived.deleted': {
            old: false,
            new: true,
            semantics: 'DESCRIPTIVE'
          }
        },
        performedBy: options?.uid || (typeof options === 'string' ? options : 'system'),
        performedByName: options?.userEmail,
        actorType: 'USER',
        reason: 'Cancellazione logica contratto'
      },
      (existing as any)?.edits?.aggregateVersion ?? 0
    );

    try {
      await CacheLookupService.removeEntityFromCache('contracts', id);
    } catch (e) {
      console.warn('Errore rimozione cache contratto:', e);
    }
  }

  /**
   * Salva una bozza di preventivo dal preventivatore rapido
   */
  static async saveQuote(
    clientId: string,
    clientNameStr: string,
    quoteItems: any[],
    quoteTotal: number,
    authObj: { uid: string; email: string },
    coSeller?: { uid: string; email?: string; share: number }
  ): Promise<string> {
    const contractNumber = await this.generateNextContractNumber();
    const now = new Date().toISOString();

    const normalizedItems: ContractProductItem[] = quoteItems.map(p => ({
      productId: p.productId || p.id || '',
      productName: p.productName || p.name || 'Articolo',
      quantity: Number(p.quantity || 1),
      listPrice: Number(p.listPrice ?? p.price ?? 0),
      minPrice: Number(p.minPrice ?? 0),
      priceSold: Number(p.priceSold ?? p.price ?? 0),
      subtotal: Number((p.priceSold ?? p.price ?? 0) * (p.quantity || 1)),
      unit: p.unit || '',
      notes: p.notes || ''
    }));

    const hasWarning = normalizedItems.some(i => i.priceSold < (i.minPrice || 0));

    return await this.createContract({
      contractNumber,
      title: `Preventivo ${contractNumber} - ${clientNameStr}`,
      clientId,
      clientName: clientNameStr,
      agentId: authObj.uid,
      agentName: authObj.email,
      coSellerUid: coSeller?.uid || undefined,
      coSellerEmail: coSeller?.email || undefined,
      coSellerShare: coSeller?.share || undefined,
      type: 'Non Ricorrente',
      billingFrequency: 'una_usa',
      status: 'bozza',
      items: normalizedItems,
      totalAmount: quoteTotal,
      taxableAmount: quoteTotal,
      hasPriceWarning: hasWarning,
      startDate: now.slice(0, 10)
    });
  }

  /**
   * Avanza un preventivo a contratto in attesa di approvazione
   */
  static async submitForApproval(
    contractId: string,
    coSeller: { uid: string; email?: string; share: number } | undefined,
    authUser: { uid: string; email: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, this.COLLECTION_NAME, contractId), {
      status: 'in_approvazione',
      'original.status': 'pending',
      ...(coSeller ? {
        coSellerUid: coSeller.uid,
        coSellerEmail: coSeller.email || null,
        coSellerShare: coSeller.share,
        'original.secondVendorUid': coSeller.uid,
        'original.secondVendorEmail': coSeller.email || null,
        'original.secondVendorShare': coSeller.share
      } : {}),
      updatedAt: now,
      'edits.modifiedAt': now,
      'edits.modifiedBy': authUser.uid
    });
  }

  /**
   * Approva formalmente un contratto
   */
  static async approveContract(contractId: string, userId: string, userEmail: string): Promise<void> {
    const now = new Date().toISOString();
    const contractRef = doc(db, this.COLLECTION_NAME, contractId);
    
    await updateDoc(contractRef, {
      status: 'approvato',
      'original.status': 'approved',
      'original.approvedAt': now,
      'original.approvedBy': userId,
      'original.approvedEmail': userEmail,
      updatedAt: now,
      'edits.approvedAt': now,
      'edits.approvedBy': userId,
      'edits.approvedEmail': userEmail,
      'edits.modifiedAt': now,
      'edits.modifiedBy': userId
    });
  }

  /**
   * Approva un contratto e registra contestualmente il saldo totale
   */
  static async approveAndCollectFull(contractId: string, userId: string, userEmail: string): Promise<void> {
    const now = new Date().toISOString();
    const contract = await this.getContractById(contractId);
    if (!contract) throw new Error("Contratto non trovato");

    // 1. Approva contratto
    await this.approveContract(contractId, userId, userEmail);

    const clientId = contract.clientId;
    const clientName = contract.clientName;
    const amount = contract.totalAmount;
    const products = contract.items || [];

    // 2. Crea documento pagamento
    const paymentId = generateId('pay');
    await setDoc(doc(db, 'payments', paymentId), {
      paymentNumber: `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId,
      clientName,
      contractId,
      amount,
      paymentDate: now.slice(0, 10),
      status: 'pagato',
      original: {
        clientId,
        clientName,
        contractId,
        amount,
        date: now,
        recordedBy: userId,
        recordedEmail: userEmail
      },
      edits: { createdAt: now, createdBy: userId }
    });

    // 3. Allocazioni prodotti
    const fullAllocations = products.map((p: any) => ({
      productId: p.productId,
      productName: p.productName,
      amount: p.subtotal || p.priceSold || 0
    })).filter((a: any) => a.amount > 0);

    await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', contractId), {
      contractId,
      paymentId,
      amount,
      clientId,
      clientName,
      productAllocations: fullAllocations,
      original: {
        contractId,
        paymentId,
        amount,
        clientId,
        clientName,
        productAllocations: fullAllocations
      },
      edits: { createdAt: now, createdBy: userId }
    });

    // 4. Log attività nel diario cliente (Graceful degradation)
    try {
      const activeModules = get(menuConfigStore);
      if (activeModules.some(m => m.id === 'activities')) {
        const activityId = generateId('act');
        const formattedAmount = (Number(amount) || 0).toFixed(2);
        await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
          title: `Contratto validato e saldo registrato (€${formattedAmount})`,
          type: 'Sollecito Telefonico',
          status: 'completata',
          executionDate: now.slice(0, 10),
          notes: `Contratto ${contract.contractNumber} validato e saldo interamente registrato per €${formattedAmount}.`,
          original: {
            clientId,
            clientName,
            type: 'Sollecito Telefonico',
            notes: `Contratto ${contract.contractNumber} validato e saldo interamente registrato per €${formattedAmount}.`,
            date: now,
            loggedBy: userId,
            loggedEmail: userEmail,
            status: 'completata'
          },
          edits: { createdAt: now, createdBy: userId }
        });
      }
    } catch (e) {
      console.warn('Bridge activities non disponibile per log saldo contratto:', e);
    }
  }

  /**
   * Calcola l'importo effettivo per un prodotto tenendo conto del Minimo Fatturabile
   */
  static calculateMinimoFatturabilePrice(
    quantity: number,
    unitPrice: number,
    minimoFatturabile?: { enabled: boolean; minQuantity?: number | null; flatPrice?: number | null; displayText?: string } | null
  ): { totalAmount: number; isMinimoApplied: boolean; note?: string } {
    const rawTotal = quantity * unitPrice;
    if (!minimoFatturabile || !minimoFatturabile.enabled) {
      return { totalAmount: rawTotal, isMinimoApplied: false };
    }

    const { minQuantity, flatPrice, displayText } = minimoFatturabile;
    
    if (minQuantity != null && flatPrice != null && quantity < minQuantity) {
      return {
        totalAmount: flatPrice,
        isMinimoApplied: true,
        note: displayText || `Minimo Fatturabile applicato: € ${flatPrice} (sotto i ${minQuantity})`
      };
    }

    return { totalAmount: rawTotal, isMinimoApplied: false };
  }

  // --- GESTIONE RATEIZZAZIONI (INSTALLMENTS) ---

  static async getInstallments(contractId: string): Promise<ContractInstallment[]> {
    const subCol = collection(db, this.COLLECTION_NAME, contractId, 'installments');
    const q = query(subCol, orderBy('installmentNumber', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      const orig = data.original || {};
      const expectedAmount = Number(data.expectedAmount ?? data.amount ?? orig.expectedAmount ?? orig.amount ?? 0);
      return {
        id: d.id,
        installmentNumber: Number(data.installmentNumber ?? orig.installmentNumber ?? 1),
        dueDate: data.dueDate || orig.dueDate || '',
        expectedAmount,
        amount: expectedAmount,
        paidAmount: data.paidAmount != null ? Number(data.paidAmount) : (orig.paidAmount != null ? Number(orig.paidAmount) : undefined),
        paidAt: data.paidAt || orig.paidAt,
        status: data.status || orig.status || 'in_attesa',
        notes: data.notes || orig.notes || ''
      } as ContractInstallment;
    });
  }

  static async addInstallment(contractId: string, inst: Omit<ContractInstallment, 'id'>): Promise<string> {
    const subCol = collection(db, this.COLLECTION_NAME, contractId, 'installments');
    const now = new Date().toISOString();
    const amountVal = Number(inst.expectedAmount ?? inst.amount ?? 0);

    const docRef = await addDoc(subCol, {
      ...inst,
      expectedAmount: amountVal,
      amount: amountVal,
      status: inst.status || 'in_attesa',
      original: {
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate,
        expectedAmount: amountVal,
        amount: amountVal,
        status: inst.status === 'pagato' ? 'paid' : 'pending',
        notes: inst.notes || ''
      },
      edits: { createdAt: now }
    });
    return docRef.id;
  }

  static async updateInstallment(contractId: string, instId: string, data: Partial<ContractInstallment>): Promise<void> {
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = { ...data, updatedAt: now, 'edits.modifiedAt': now };

    if (data.dueDate) updatePayload['original.dueDate'] = data.dueDate;
    if (data.expectedAmount !== undefined || data.amount !== undefined) {
      const val = Number(data.expectedAmount ?? data.amount);
      updatePayload.expectedAmount = val;
      updatePayload.amount = val;
      updatePayload['original.expectedAmount'] = val;
      updatePayload['original.amount'] = val;
    }
    if (data.status) {
      updatePayload['original.status'] = data.status === 'pagato' ? 'paid' : 'pending';
    }
    if (data.paidAmount !== undefined) updatePayload['original.paidAmount'] = data.paidAmount;
    if (data.paidAt !== undefined) updatePayload['original.paidAt'] = data.paidAt;

    await updateDoc(doc(db, this.COLLECTION_NAME, contractId, 'installments', instId), updatePayload);
  }

  static async deleteInstallment(contractId: string, instId: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, contractId, 'installments', instId));
  }

  /**
   * Posticipa la data di scadenza della rata e registra l'attività nel diario del cliente (Graceful Degradation)
   */
  static async postponeInstallment(
    contract: ContractItem,
    instId: string,
    newDate: string,
    user: { uid: string; email: string }
  ): Promise<void> {
    const contractId = contract.id!;
    await this.updateInstallment(contractId, instId, { dueDate: newDate });

    try {
      const activeModules = get(menuConfigStore);
      if (activeModules.some(m => m.id === 'activities') && contract.clientId) {
        const now = new Date().toISOString();
        const activityId = generateId('act');
        await setDoc(doc(db, 'clients', contract.clientId, 'activities', activityId), {
          title: `Posticipata scadenza pagamento al ${newDate}`,
          type: 'Sollecito Telefonico',
          status: 'completata',
          executionDate: now.slice(0, 10),
          notes: `Posticipata scadenza rata contratto ${contract.contractNumber} al ${newDate}.`,
          original: {
            clientId: contract.clientId,
            clientName: contract.clientName,
            type: 'Sollecito Telefonico',
            notes: `Posticipata scadenza rata contratto ${contract.contractNumber} al ${newDate}.`,
            status: 'completata',
            date: now,
            loggedBy: user.uid,
            loggedEmail: user.email
          },
          edits: { createdAt: now, createdBy: user.uid }
        });
      }
    } catch (e) {
      console.warn('Bridge activities non disponibile per log posticipo rata:', e);
    }
  }

  /**
   * Incassa una specifica rata con scorpora IVA e ripartizione prodotti
   */
  static async collectInstallment(
    contractId: string,
    instId: string,
    actualAmount: number,
    user: { uid: string; email: string },
    productAllocations?: Array<{ productId: string; amount: number }>
  ): Promise<void> {
    const now = new Date().toISOString();
    const contract = await this.getContractById(contractId);
    if (!contract) throw new Error("Contratto non trovato");

    // 1. Aggiorna rata
    await this.updateInstallment(contractId, instId, {
      status: 'pagato',
      paidAmount: actualAmount,
      paidAt: now
    });

    // 2. Crea documento pagamento
    const paymentId = generateId('pay');
    await setDoc(doc(db, 'payments', paymentId), {
      paymentNumber: `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      clientId: contract.clientId,
      clientName: contract.clientName,
      contractId,
      installmentId: instId,
      amount: actualAmount,
      paymentDate: now.slice(0, 10),
      status: 'pagato',
      original: {
        clientId: contract.clientId,
        clientName: contract.clientName,
        contractId,
        installmentId: instId,
        amount: actualAmount,
        date: now,
        recordedBy: user.uid,
        recordedEmail: user.email
      },
      edits: { createdAt: now, createdBy: user.uid }
    });

    // 3. Registra allocazione su contractsPaid
    await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', contractId), {
      contractId,
      paymentId,
      installmentId: instId,
      amount: actualAmount,
      clientId: contract.clientId,
      clientName: contract.clientName,
      productAllocations: productAllocations || [],
      original: {
        contractId,
        paymentId,
        installmentId: instId,
        amount: actualAmount,
        clientId: contract.clientId,
        clientName: contract.clientName,
        productAllocations: productAllocations || []
      },
      edits: { createdAt: now, createdBy: user.uid }
    });

    // 4. Log attività nel diario cliente
    try {
      const activeModules = get(menuConfigStore);
      if (activeModules.some(m => m.id === 'activities') && contract.clientId) {
        const activityId = generateId('act');
        const formattedActualAmount = (Number(actualAmount) || 0).toFixed(2);
        await setDoc(doc(db, 'clients', contract.clientId, 'activities', activityId), {
          title: `Incasso rata contratto (€${formattedActualAmount})`,
          type: 'Sollecito Telefonico',
          status: 'completata',
          executionDate: now.slice(0, 10),
          notes: `Riscossa rata contratto ${contract.contractNumber} di €${formattedActualAmount}.`,
          original: {
            clientId: contract.clientId,
            clientName: contract.clientName,
            type: 'Sollecito Telefonico',
            notes: `Riscossa rata contratto ${contract.contractNumber} di €${formattedActualAmount}.`,
            date: now,
            loggedBy: user.uid,
            loggedEmail: user.email,
            status: 'completata'
          },
          edits: { createdAt: now, createdBy: user.uid }
        });
      }
    } catch (e) {
      console.warn('Bridge activities non disponibile per log incasso rata:', e);
    }
  }
}
