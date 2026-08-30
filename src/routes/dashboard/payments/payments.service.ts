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
    if (grossAmount <= 0) return { netAmount: 0, vatAmount: 0 };
    if (vatRate <= 0) return { netAmount: grossAmount, vatAmount: 0 };

    const net = parseFloat(((Number(grossAmount) || 0) / (1 + (Number(vatRate) || 0) / 100)).toFixed(2));
    const vat = parseFloat(((Number(grossAmount) || 0) - net).toFixed(2));
    return { netAmount: net, vatAmount: vat };
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

  static async createPayment(data: Partial<PaymentItem>, authUser?: { uid: string; email: string }): Promise<string> {
    let paymentNumber = data.paymentNumber?.trim();
    if (!paymentNumber) {
      paymentNumber = await this.generateNextPaymentNumber();
    }

    const grossAmount = Number(data.grossAmount ?? data.amount ?? 0);
    const vatRate = Number(data.vatRate ?? 22);
    const { netAmount, vatAmount } = this.calculateVatBreakdown(grossAmount, vatRate);

    const now = new Date().toISOString();
    const textSearch = generateSearchTerms(`${paymentNumber} ${data.clientName || ''} ${data.transactionReference || ''}`);

    const payload = sanitizeFirestoreData({
      ...data,
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

    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);

    try {
      const chunkId = await CacheLookupService.updateEntityCache('payments', docRef.id, `${paymentNumber} - ${data.clientName || ''}`);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache payments:', e);
    }

    return docRef.id;
  }

  static async updatePayment(id: string, data: Partial<PaymentItem>, uid?: string): Promise<void> {
    const existing = await this.getPaymentById(id);
    const now = new Date().toISOString();
    const sanitized: Record<string, any> = {};

    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.grossAmount !== undefined) {
      const vatRate = data.vatRate ?? existing?.vatRate ?? 22;
      const { netAmount, vatAmount } = this.calculateVatBreakdown(data.grossAmount, vatRate);
      sanitized.grossAmount = data.grossAmount;
      sanitized.netAmount = data.netAmount ?? netAmount;
      sanitized.vatAmount = data.vatAmount ?? vatAmount;
      sanitized.amount = data.grossAmount;
      sanitized['original.amount'] = data.grossAmount;
      sanitized['original.netAmount'] = data.netAmount ?? netAmount;
      sanitized['original.vatAmount'] = data.vatAmount ?? vatAmount;
    }

    if (data.paymentNumber || data.clientName) {
      const num = data.paymentNumber || existing?.paymentNumber || '';
      const client = data.clientName || existing?.clientName || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${num} ${client}`);
      
      try {
        await CacheLookupService.updateEntityCache('payments', id, `${num} - ${client}`);
      } catch (e) {
        console.warn('Errore aggiornamento cache payments:', e);
      }
    }

    sanitized.updatedAt = now;
    sanitized['edits.modifiedAt'] = now;
    if (uid) sanitized['edits.modifiedBy'] = uid;

    const finalSanitized = sanitizeFirestoreData(sanitized);
    await updateDoc(doc(db, this.COLLECTION_NAME, id), finalSanitized);
  }

  static async deletePayment(id: string, uid?: string): Promise<void> {
    await updateDoc(doc(db, this.COLLECTION_NAME, id), {
      'derived.deleted': true,
      'edits.deletedAt': new Date().toISOString(),
      'edits.deletedBy': uid || 'system'
    });
    try {
      await CacheLookupService.removeEntityFromCache('payments', id);
    } catch (e) {
      console.warn('Errore rimozione cache payment:', e);
    }
  }
}
