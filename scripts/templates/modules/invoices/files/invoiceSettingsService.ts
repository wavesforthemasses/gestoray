import { db, doc, getDoc, setDoc } from '$lib/firebase';
import { cleanUndefined } from '$lib/utils/helpers';
import type { InvoiceSettings, SezionaleConfig, AnnualSequenceConfig } from './schema';

const currentYear = new Date().getFullYear();

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  sezionali: [
    { id: 'default', code: '', name: 'Registro Principale', isDefault: true },
    { id: 'NC', code: '/NC', name: 'Note di Credito' },
    { id: 'PA', code: '/PA', name: 'Pubblica Amministrazione' }
  ],
  documentTypeSezionaleMapping: {
    TD01: 'default',
    TD02: 'default',
    TD04: 'NC',
    TD05: 'default',
    TD06: 'default',
    TD24: 'default',
    PROFORMA: 'default'
  },
  annualSequences: [
    {
      year: currentYear,
      sezionaleId: 'default',
      startNumber: 1,
      lastAssignedNumber: 0,
      pattern: '{NUM}/{YYYY}{SEZ}'
    },
    {
      year: currentYear,
      sezionaleId: 'NC',
      startNumber: 1,
      lastAssignedNumber: 0,
      pattern: '{NUM}/{YYYY}{SEZ}'
    }
  ],
  companyInfo: {
    country: 'IT',
    fiscalRegime: 'RF01'
  },
  entityNaming: {
    documentLabel: 'Fattura',
    bollaLabel: 'Bolla / Intervento',
    accontoLabel: 'Acconto',
    stornoLabel: 'Nota di Credito'
  },
  defaultPaymentMethod: 'bonifico',
  defaultPaymentTermDays: 30,
  enableStampDuty2Euro: false
};

export class InvoiceSettingsService {
  private static DOC_PATH = 'settings/invoices';

  static async getSettings(): Promise<InvoiceSettings> {
    try {
      const snap = await getDoc(doc(db, this.DOC_PATH));
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...DEFAULT_INVOICE_SETTINGS,
          ...data,
          sezionali: Array.isArray(data.sezionali) && data.sezionali.length > 0 ? data.sezionali : DEFAULT_INVOICE_SETTINGS.sezionali,
          documentTypeSezionaleMapping: {
            ...DEFAULT_INVOICE_SETTINGS.documentTypeSezionaleMapping,
            ...(data.documentTypeSezionaleMapping || {})
          },
          annualSequences: Array.isArray(data.annualSequences) && data.annualSequences.length > 0 ? data.annualSequences : DEFAULT_INVOICE_SETTINGS.annualSequences,
          entityNaming: {
            ...DEFAULT_INVOICE_SETTINGS.entityNaming,
            ...(data.entityNaming || {})
          },
          companyInfo: {
            ...DEFAULT_INVOICE_SETTINGS.companyInfo,
            ...(data.companyInfo || {})
          }
        };
      }
    } catch (e) {
      console.warn('Errore lettura settings invoices, uso default:', e);
    }
    return { ...DEFAULT_INVOICE_SETTINGS };
  }

  static async saveSettings(settings: Partial<InvoiceSettings>): Promise<void> {
    const payload = cleanUndefined({
      ...DEFAULT_INVOICE_SETTINGS,
      ...settings,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, this.DOC_PATH), payload, { merge: true });
  }

  /**
   * Restituisce la configurazione della sequenza per un dato anno e sezionale, inizializzandola se mancante
   */
  static getSequenceForYearAndSezionale(
    settings: InvoiceSettings, 
    year: number, 
    sezionaleId: string
  ): AnnualSequenceConfig {
    const found = (settings.annualSequences || []).find(s => s.year === year && s.sezionaleId === sezionaleId);
    if (found) return found;

    return {
      year,
      sezionaleId,
      startNumber: 1,
      lastAssignedNumber: 0,
      pattern: '{NUM}/{YYYY}{SEZ}'
    };
  }
}
