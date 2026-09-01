import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy, 
  runTransaction 
} from '$lib/firebase';
import type { PaymentItem, PaymentSettings } from './schema';
import { PaymentSettingsService } from './paymentSettingsService';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { generateSearchTerms } from '$lib/search-utils';
import { generateId } from '$lib/utils/helpers';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { PaymentsVersioningBridge } from './payments.versioning.bridge';
import { calculateVatBreakdown as calcVatHelper } from '$lib/utils/math';


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

export class PaymentsService {
  private static COLLECTION_NAME = 'payments';

  /**
   * Calcola lo scorporo IVA restituendo Imponibile Netto e Quota IVA
   */
  static calculateVatBreakdown(grossAmount: number, vatRate: number = 22): { netAmount: number; vatAmount: number } {
    return calcVatHelper(grossAmount, vatRate);
  }

  /**
   * Helper di normalizzazione resiliente (Dual-Schema)
   */
  static normalizePaymentData(data: any, id?: string): PaymentItem {
    if (!data) return {} as PaymentItem;
    const orig = data.original || {};

    const grossAmount = Number(data.grossAmount ?? data.amount ?? orig.amount ?? 0);
    const vatRate = Number(data.vatRate ?? orig.vatRate ?? 22);
    
    let netAmount = Number(data.netAmount ?? orig.netAmount);
    let vatAmount = Number(data.vatAmount ?? orig.vatAmount);

    if (isNaN(netAmount) || netAmount === 0 && grossAmount > 0) {
      const calc = this.calculateVatBreakdown(grossAmount, vatRate);
      netAmount = calc.netAmount;
      vatAmount = calc.vatAmount;
    }

    return {
      id: id || data.id,
      paymentNumber: data.paymentNumber || orig.paymentNumber || '',
      clientId: data.clientId || orig.clientId || '',
      clientName: data.clientName || orig.clientName || '',
      grossAmount,
      vatRate,
      vatAmount,
      netAmount,
      paymentDate: data.paymentDate || orig.date?.slice(0, 10) || data.createdAt?.slice(0, 10) || '',
      method: data.method || orig.method || 'bonifico',
      transactionReference: data.transactionReference || orig.transactionReference || orig.cro || '',
      status: data.status || orig.status || 'registrato',
      notes: data.notes || orig.notes || '',
      contractId: data.contractId || orig.contractId,
      installmentId: data.installmentId || orig.installmentId,
      contractAllocations: data.contractAllocations || orig.productAllocations || [],
      customFields: data.customFields || orig.customFields || {},
      createdAt: data.createdAt || data.edits?.createdAt || orig.date || '',
      updatedAt: data.updatedAt || data.edits?.modifiedAt || '',
      original: orig,
      edits: data.edits || {},
      derived: data.derived || {}
    };
  }

  static async getPayments(): Promise<PaymentItem[]> {
    let snap;
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('paymentDate', 'desc')
      );
      snap = await getDocs(q);
    } catch (e) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    if (snap.empty) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    const list = snap.docs
      .map(d => this.normalizePaymentData(d.data(), d.id))
      .filter(p => !p.derived?.deleted);

    list.sort((a, b) => {
      const dA = a.paymentDate || a.createdAt || '';
      const dB = b.paymentDate || b.createdAt || '';
      return dB.localeCompare(dA);
    });
    return list;
  }

  static async getPaymentById(id: string): Promise<PaymentItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.derived?.deleted) return null;
    return this.normalizePaymentData(data, snap.id);
  }

  static async getClientPayments(clientId: string): Promise<PaymentItem[]> {
    try {
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, this.COLLECTION_NAME), where('clientId', '==', clientId))),
        getDocs(query(collection(db, this.COLLECTION_NAME), where('original.clientId', '==', clientId)))
      ]);
      const map = new Map<string, PaymentItem>();
      snap1.forEach(d => {
        if (!d.data()?.derived?.deleted) map.set(d.id, this.normalizePaymentData(d.data(), d.id));
      });
      snap2.forEach(d => {
        if (!d.data()?.derived?.deleted) map.set(d.id, this.normalizePaymentData(d.data(), d.id));
      });
      return Array.from(map.values());
    } catch (e) {
      console.error('Errore getClientPayments:', e);
      return [];
    }
  }

  /**
   * Anteprima in sola lettura del prossimo numero progressivo incasso
   */
  static async previewNextPaymentNumber(): Promise<string> {
    const settings = await PaymentSettingsService.getSettings();
    const currentYear = new Date().getFullYear();

    let nextNumber = (settings.lastNumber || 0) + 1;
    if (settings.resetCounterAnnually && settings.lastCounterYear !== currentYear) {
      nextNumber = 1;
    }

    const prefix = settings.prefix || 'INC-';
    const yearPart = settings.includeYear ? `${currentYear}-` : '';
    const numPart = String(nextNumber).padStart(settings.numberPadding || 4, '0');

    return `${prefix}${yearPart}${numPart}`;
  }

  /**
   * Genera ed incrementa atomicamente il numero progressivo con Transazione Firestore
   */
  static async generateNextPaymentNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const settingsRef = doc(db, 'settings', 'payments');

    let formattedNumber = '';

    await runTransaction(db, async (transaction) => {
      const settingsSnap = await transaction.get(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : await PaymentSettingsService.getSettings();

      let nextNumber = (settings.lastNumber || 0) + 1;
      if (settings.resetCounterAnnually && settings.lastCounterYear !== currentYear) {
        nextNumber = 1;
      }

      const prefix = settings.prefix || 'INC-';
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

  static async createPayment(
    data: Partial<PaymentItem>, 
    authUser?: { uid: string; email: string },
    options?: { tenantId?: string }
  ): Promise<string> {
    let paymentNumber = data.paymentNumber?.trim();
    if (!paymentNumber) {
      paymentNumber = await this.generateNextPaymentNumber();
    }

    const grossAmount = Number(data.grossAmount ?? data.amount ?? 0);
    const vatRate = Number(data.vatRate ?? 22);
    const { netAmount, vatAmount } = this.calculateVatBreakdown(grossAmount, vatRate);

    const now = new Date().toISOString();
    const textSearch = generateSearchTerms(`${paymentNumber} ${data.clientName || ''} ${data.transactionReference || ''}`);

    const paymentId = data.id || generateId();
    const paymentRef = doc(db, this.COLLECTION_NAME, paymentId);

    const payload = sanitizeFirestoreData({
      ...data,
      id: paymentId,
      paymentNumber,
      grossAmount,
      vatRate,
      vatAmount: data.vatAmount ?? vatAmount,
      netAmount: data.netAmount ?? netAmount,
      amount: grossAmount, // Campo compatibilità
      status: data.status || 'registrato',
      paymentDate: data.paymentDate || now.slice(0, 10),
      original: {
        paymentNumber,
        clientId: data.clientId || '',
        clientName: data.clientName || '',
        amount: grossAmount,
        netAmount: data.netAmount ?? netAmount,
        vatRate,
        vatAmount: data.vatAmount ?? vatAmount,
        date: now,
        method: data.method || 'bonifico',
        transactionReference: data.transactionReference || '',
        status: data.status || 'registrato',
        recordedBy: authUser?.uid || 'system',
        recordedEmail: authUser?.email || ''
      },
      edits: {
        createdAt: now,
        createdBy: authUser?.uid || 'system'
      },
      derived: {
        textSearch
      },
      createdAt: now,
      updatedAt: now
    });

    const diff = computeDiff(null, payload, {
      semanticsMap: PaymentsVersioningBridge.getSemanticsMap()
    });

    await VersioningService.executeDualWriteTransaction(
      db,
      paymentRef,
      payload,
      {
        tenantId: options?.tenantId || 'default',
        module: 'payments',
        entityType: 'payment',
        entityId: paymentId,
        entityLabel: PaymentsVersioningBridge.getEntityLabel(payload),
        eventType: 'FIELD_MUTATION',
        keysChanged: diff.keysChanged,
        mutations: diff.mutations,
        performedBy: authUser?.uid || 'system',
        performedByName: authUser?.email,
        actorType: 'USER',
        reason: 'Registrazione incasso / movimento cassa'
      },
      0
    );

    try {
      const chunkId = await CacheLookupService.updateEntityCache('payments', paymentId, `${paymentNumber} - ${data.clientName || ''}`);
      if (chunkId) {
        await updateDoc(paymentRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache payments:', e);
    }

    return paymentId;
  }

  static async updatePayment(
    id: string, 
    data: Partial<PaymentItem>, 
    uid?: string,
    options?: { userEmail?: string; tenantId?: string; expectedBaseVersion?: number; reason?: string }
  ): Promise<void> {
    const paymentRef = doc(db, this.COLLECTION_NAME, id);
    const existingSnap = await getDoc(paymentRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as PaymentItem) : null;
    const now = new Date().toISOString();
    const sanitized: Record<string, any> = {};

    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    let grossAmount = data.grossAmount !== undefined ? data.grossAmount : (existing?.grossAmount ?? existing?.amount);
    let vatRate = data.vatRate !== undefined ? data.vatRate : (existing?.vatRate ?? 22);
    let netAmount = data.netAmount;
    let vatAmount = data.vatAmount;

    if (grossAmount !== undefined) {
      const calc = this.calculateVatBreakdown(Number(grossAmount), Number(vatRate));
      netAmount = netAmount ?? calc.netAmount;
      vatAmount = vatAmount ?? calc.vatAmount;
    }

    const num = data.paymentNumber || existing?.paymentNumber || '';
    const client = data.clientName || existing?.clientName || '';
    const textSearch = generateSearchTerms(`${num} ${client}`);

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      ...sanitized,
      grossAmount,
      vatRate,
      vatAmount,
      netAmount,
      updatedAt: now,
      derived: {
        ...(existing?.derived || {}),
        textSearch
      },
      original: {
        ...(existing?.original || {}),
        ...(sanitized['original'] || {}),
        amount: grossAmount,
        netAmount,
        vatRate,
        vatAmount,
        status: data.status || existing?.status || existing?.original?.status || 'registrato'
      }
    };

    const payload = sanitizeFirestoreData(nextEntityData);
    const diff = computeDiff(existing, payload, {
      semanticsMap: PaymentsVersioningBridge.getSemanticsMap()
    });

    if (diff.keysChanged.length > 0) {
      await VersioningService.executeDualWriteTransaction(
        db,
        paymentRef,
        payload,
        {
          tenantId: options?.tenantId || 'default',
          module: 'payments',
          entityType: 'payment',
          entityId: id,
          entityLabel: PaymentsVersioningBridge.getEntityLabel(payload),
          eventType: 'FIELD_MUTATION',
          keysChanged: diff.keysChanged,
          mutations: diff.mutations,
          performedBy: uid || 'system',
          performedByName: options?.userEmail,
          actorType: 'USER',
          reason: options?.reason || 'Modifica dati incasso'
        },
        options?.expectedBaseVersion !== undefined ? options.expectedBaseVersion : ((existing as any)?.edits?.aggregateVersion ?? 0)
      );
    } else {
      await updateDoc(paymentRef, { updatedAt: now });
    }

    if (data.paymentNumber || data.clientName) {
      try {
        await CacheLookupService.updateEntityCache('payments', id, `${num} - ${client}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache payments:', e);
      }
    }
  }

  static async deletePayment(
    id: string, 
    uid?: string,
    options?: { userEmail?: string; tenantId?: string }
  ): Promise<void> {
    const paymentRef = doc(db, this.COLLECTION_NAME, id);
    const existingSnap = await getDoc(paymentRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as PaymentItem) : null;
    const now = new Date().toISOString();

    const nextEntityData: Record<string, any> = {
      ...(existing || {}),
      derived: {
        ...(existing?.derived || {}),
        deleted: true
      },
      edits: {
        ...(existing as any)?.edits,
        deletedAt: now,
        deletedBy: uid || 'system'
      }
    };

    const payload = sanitizeFirestoreData(nextEntityData);

    await VersioningService.executeDualWriteTransaction(
      db,
      paymentRef,
      payload,
      {
        tenantId: options?.tenantId || 'default',
        module: 'payments',
        entityType: 'payment',
        entityId: id,
        entityLabel: PaymentsVersioningBridge.getEntityLabel(existing),
        eventType: 'STATUS_CHANGE',
        keysChanged: ['derived.deleted'],
        mutations: {
          'derived.deleted': {
            old: false,
            new: true,
            semantics: 'DESCRIPTIVE'
          }
        },
        performedBy: uid || 'system',
        performedByName: options?.userEmail,
        actorType: 'USER',
        reason: 'Cancellazione logica incasso'
      },
      (existing as any)?.edits?.aggregateVersion ?? 0
    );

    try {
      await CacheLookupService.removeEntityFromCache('payments', id);
    } catch (e) {
      console.warn('Errore rimozione cache payment:', e);
    }
  }
}
