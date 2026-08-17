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
  limit, 
  serverTimestamp 
} from '$lib/firebase';
import type { ContractItem, ContractInstallment, ContractSettings } from './schema';
import { ContractSettingsService } from './contractSettingsService';
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

export class ContractsService {
  private static COLLECTION_NAME = 'contracts';

  static async getContracts(): Promise<ContractItem[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ContractItem))
      .filter(c => !(c as any).derived?.deleted);
  }

  static async getContractById(id: string): Promise<ContractItem | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.derived?.deleted) return null;
    return { id: snap.id, ...data } as ContractItem;
  }

  /**
   * Anteprima in sola lettura del prossimo numero progressivo (SENZA incrementare o salvare il contatore in Firestore)
   */
  static async previewNextContractNumber(): Promise<string> {
    const settings = await ContractSettingsService.getSettings();
    const currentYear = new Date().getFullYear();

    let nextNumber = settings.lastNumber + 1;
    if (settings.resetCounterAnnually && settings.lastCounterYear !== currentYear) {
      nextNumber = 1;
    }

    const prefix = settings.prefix || (settings.entityNaming === 'quote' ? 'PREV-' : 'CTR-');
    const yearPart = settings.includeYear ? `${currentYear}-` : '';
    const numPart = String(nextNumber).padStart(settings.numberPadding || 4, '0');

    return `${prefix}${yearPart}${numPart}`;
  }

  /**
   * Genera ed incrementa atomicamente il prossimo numero progressivo salvandolo nelle impostazioni
   */
  static async generateNextContractNumber(): Promise<string> {
    const settings = await ContractSettingsService.getSettings();
    const currentYear = new Date().getFullYear();

    let nextNumber = settings.lastNumber + 1;
    if (settings.resetCounterAnnually && settings.lastCounterYear !== currentYear) {
      nextNumber = 1;
    }

    const prefix = settings.prefix || (settings.entityNaming === 'quote' ? 'PREV-' : 'CTR-');
    const yearPart = settings.includeYear ? `${currentYear}-` : '';
    const numPart = String(nextNumber).padStart(settings.numberPadding || 4, '0');

    const formattedNumber = `${prefix}${yearPart}${numPart}`;

    // Aggiorna contatore nelle impostazioni al salvataggio reale
    await ContractSettingsService.saveSettings({
      lastNumber: nextNumber,
      lastCounterYear: currentYear
    });

    return formattedNumber;
  }

  static async createContract(data: Omit<ContractItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const settings = await ContractSettingsService.getSettings();
    const labels = ContractSettingsService.getLabels(settings);

    // Se il numero di contratto non è stato passato o è vuoto, lo genera ed incrementa ora al salvataggio
    let contractNumber = data.contractNumber?.trim();
    if (!contractNumber) {
      contractNumber = await this.generateNextContractNumber();
    }

    // Titolo opzionale: se vuoto, imposta fallback es. "Contratto CTR-2026-0001 - Nome Cliente"
    const effectiveTitle = data.title?.trim() 
      ? data.title.trim() 
      : `${labels.singular} ${contractNumber} - ${data.clientName || 'Cliente'}`;

    const textSearch = generateSearchTerms(`${contractNumber} ${effectiveTitle} ${data.clientName || ''}`);
    
    const payload = sanitizeFirestoreData({
      ...data,
      contractNumber,
      title: effectiveTitle,
      derived: {
        textSearch
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);

    try {
      const chunkId = await CacheLookupService.updateEntityCache('contracts', docRef.id, effectiveTitle);
      if (chunkId) {
        await updateDoc(docRef, { 'derived.cacheChunkId': chunkId });
      }
    } catch (e) {
      console.warn('Errore aggiornamento cache contratti:', e);
    }

    return docRef.id;
  }

  static async updateContract(id: string, data: Partial<ContractItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    if (data.title !== undefined || data.contractNumber || data.clientName) {
      const existing = await this.getContractById(id);
      const title = data.title !== undefined ? data.title : (existing?.title || '');
      const num = data.contractNumber || existing?.contractNumber || '';
      const client = data.clientName || existing?.clientName || '';
      sanitized['derived.textSearch'] = generateSearchTerms(`${num} ${title} ${client}`);
      
      try {
        await CacheLookupService.updateEntityCache('contracts', id, title);
      } catch (e) {
        console.warn('Errore aggiornamento cache contratto:', e);
      }
    }

    sanitized.updatedAt = new Date().toISOString();
    const finalSanitized = sanitizeFirestoreData(sanitized);
    await updateDoc(doc(db, this.COLLECTION_NAME, id), finalSanitized);
  }

  static async deleteContract(id: string, uid?: string): Promise<void> {
    await updateDoc(doc(db, this.COLLECTION_NAME, id), {
      'derived.deleted': true,
      'edits.deletedAt': new Date().toISOString(),
      'edits.deletedBy': uid || 'system'
    });
    try {
      await CacheLookupService.removeEntityFromCache('contracts', id);
    } catch (e) {
      console.warn('Errore rimozione cache contratto:', e);
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

  // Installments Subcollection
  static async getInstallments(contractId: string): Promise<ContractInstallment[]> {
    const subCol = collection(db, this.COLLECTION_NAME, contractId, 'installments');
    const q = query(subCol, orderBy('installmentNumber', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContractInstallment));
  }

  static async addInstallment(contractId: string, inst: Omit<ContractInstallment, 'id'>): Promise<string> {
    const subCol = collection(db, this.COLLECTION_NAME, contractId, 'installments');
    const docRef = await addDoc(subCol, inst);
    return docRef.id;
  }
}
