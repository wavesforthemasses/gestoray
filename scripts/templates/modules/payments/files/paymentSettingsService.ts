import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { PaymentSettings, VatRateOption, PaymentMethodOption } from './schema';

export const DEFAULT_VAT_RATES: VatRateOption[] = [
  { rate: 22, label: '22% (Ordinaria)' },
  { rate: 10, label: '10% (Agevolata Edilizia / Servizi)' },
  { rate: 4, label: '4% (Prima Casa / Agricoltura)' },
  { rate: 0, label: '0% (Esente / Reverse Charge)' }
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'bonifico', label: 'Bonifico Bancario', enabled: true, isSystem: true },
  { id: 'contanti', label: 'Contanti', enabled: true, isSystem: true },
  { id: 'pos_carta', label: 'POS / Carta di Credito', enabled: true, isSystem: true },
  { id: 'assegno', label: 'Assegno', enabled: true, isSystem: true },
  { id: 'riba', label: 'Ri.Ba.', enabled: true, isSystem: true },
  { id: 'paypal_stripe', label: 'PayPal / Stripe', enabled: true, isSystem: true },
  { id: 'altro', label: 'Altro', enabled: true, isSystem: true }
];

const DEFAULT_SETTINGS: PaymentSettings = {
  entityNaming: 'payment',
  prefix: 'INC-',
  includeYear: true,
  numberPadding: 4,
  lastNumber: 0,
  resetCounterAnnually: true,
  defaultVatRate: 22,
  defaultMethod: 'bonifico',
  vatRates: DEFAULT_VAT_RATES,
  paymentMethods: DEFAULT_PAYMENT_METHODS
};

export class PaymentSettingsService {
  private static DOC_PATH = 'settings/payments';

  static async getSettings(): Promise<PaymentSettings> {
    try {
      const snap = await getDoc(doc(db, this.DOC_PATH));
      if (snap.exists()) {
        const data = snap.data();
        
        // Merge payment methods ensuring system methods exist
        let methods = data.paymentMethods && Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
        if (methods.length === 0) {
          methods = [...DEFAULT_PAYMENT_METHODS];
        } else {
          // Check if any default system method is missing, add it
          const existingIds = new Set(methods.map((m: PaymentMethodOption) => m.id));
          DEFAULT_PAYMENT_METHODS.forEach(sysMethod => {
            if (!existingIds.has(sysMethod.id)) {
              methods.push({ ...sysMethod });
            }
          });
        }

        return {
          ...DEFAULT_SETTINGS,
          ...data,
          vatRates: data.vatRates && data.vatRates.length > 0 ? data.vatRates : DEFAULT_VAT_RATES,
          paymentMethods: methods
        } as PaymentSettings;
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni payments, uso default:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  static async saveSettings(settings: Partial<PaymentSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, this.DOC_PATH), updated, { merge: true });
  }

  static getLabels(settings: PaymentSettings) {
    switch (settings.entityNaming) {
      case 'receipt':
        return {
          singular: 'Ricevuta',
          plural: 'Ricevute',
          newSingular: 'Nuova Ricevuta',
          editSingular: 'Modifica Ricevuta',
          detailSingular: 'Dettaglio Ricevuta',
          numberLabel: 'N° Ricevuta'
        };
      case 'income':
        return {
          singular: 'Entrata',
          plural: 'Entrate',
          newSingular: 'Nuova Entrata',
          editSingular: 'Modifica Entrata',
          detailSingular: 'Dettaglio Entrata',
          numberLabel: 'N° Entrata'
        };
      case 'payment':
      default:
        return {
          singular: 'Incasso',
          plural: 'Incassi',
          newSingular: 'Nuovo Incasso',
          editSingular: 'Modifica Incasso',
          detailSingular: 'Dettaglio Incasso',
          numberLabel: 'N° Incasso'
        };
    }
  }
}
