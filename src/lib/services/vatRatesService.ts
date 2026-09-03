import { db, doc, getDoc, setDoc } from '$lib/firebase';
import { roundCurrency } from '$lib/utils/math';
import { cleanUndefined } from '$lib/utils/helpers';

export interface VatRateOption {
  id: string;
  rate: number;
  label: string;
  natureCode?: string;     // Codice Natura SDI: N1, N2, N3, N4, N5, N6.3, N7
  normativeRef?: string;   // Dicitura di legge per l'XML
  isDefault?: boolean;
  isSystem?: boolean;
  enabled: boolean;
}

export interface VatSettings {
  defaultRate: number;
  rates: VatRateOption[];
  updatedAt?: string;
}

export const DEFAULT_VAT_RATES: VatRateOption[] = [
  { id: 'iva_22', rate: 22, label: '22% (Ordinaria)', isDefault: true, isSystem: true, enabled: true },
  { id: 'iva_10', rate: 10, label: '10% (Agevolata Edilizia / Somministrazione)', isSystem: true, enabled: true },
  { id: 'iva_5', rate: 5, label: '5% (Ridotta / Sociale)', isSystem: true, enabled: true },
  { id: 'iva_4', rate: 4, label: '4% (Minima / Prima Casa / Agricoltura)', isSystem: true, enabled: true },
  { 
    id: 'iva_0_rev_edile', 
    rate: 0, 
    label: '0% (Reverse Charge Edilizia - Art. 17 c. 6 lett. a)', 
    natureCode: 'N6.3', 
    normativeRef: 'Inversione contabile art. 17 c. 6 lett. a DPR 633/72', 
    isSystem: true, 
    enabled: true 
  },
  { 
    id: 'iva_0_esente', 
    rate: 0, 
    label: '0% (Esente - Art. 10)', 
    natureCode: 'N4', 
    normativeRef: 'Operazione esente art. 10 DPR 633/72', 
    isSystem: true, 
    enabled: true 
  },
  { 
    id: 'iva_0_non_imp', 
    rate: 0, 
    label: '0% (Non Imponibile Esportazioni - Art. 8)', 
    natureCode: 'N3.1', 
    normativeRef: 'Operazione non imponibile art. 8 c. 1 lett. a DPR 633/72', 
    isSystem: true, 
    enabled: true 
  }
];

export const DEFAULT_VAT_SETTINGS: VatSettings = {
  defaultRate: 22,
  rates: DEFAULT_VAT_RATES
};

export class VatRatesService {
  private static DOC_PATH = 'settings/vat';
  private static LEGACY_PAYMENTS_DOC_PATH = 'settings/payments';

  /**
   * Recupera le impostazioni fiscali e le aliquote attive con fallback e migrazione trasparente
   */
  static async getSettings(): Promise<VatSettings> {
    try {
      const snap = await getDoc(doc(db, this.DOC_PATH));
      if (snap.exists()) {
        const data = snap.data();
        const rates = (Array.isArray(data.rates) && data.rates.length > 0)
          ? data.rates
          : DEFAULT_VAT_RATES;
        return {
          defaultRate: data.defaultRate ?? 22,
          rates,
          updatedAt: data.updatedAt
        };
      }

      // Fallback trasparente su settings/payments se preesistente (retrocompatibilità)
      const legSnap = await getDoc(doc(db, this.LEGACY_PAYMENTS_DOC_PATH));
      if (legSnap.exists()) {
        const legData = legSnap.data();
        if (Array.isArray(legData.vatRates) && legData.vatRates.length > 0) {
          const migratedRates: VatRateOption[] = legData.vatRates.map((vr: any) => ({
            id: `iva_${vr.rate}`,
            rate: Number(vr.rate),
            label: vr.label || `${vr.rate}%`,
            isDefault: Number(vr.rate) === 22,
            enabled: true
          }));
          return {
            defaultRate: legData.defaultVatRate ?? 22,
            rates: migratedRates
          };
        }
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni VAT da Firestore, uso default:', e);
    }
    return { ...DEFAULT_VAT_SETTINGS };
  }

  /**
   * Salva le impostazioni delle aliquote su Firestore
   */
  static async saveSettings(settings: Partial<VatSettings>): Promise<void> {
    const payload = cleanUndefined({
      ...DEFAULT_VAT_SETTINGS,
      ...settings,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, this.DOC_PATH), payload, { merge: true });
  }

  /**
   * Restituisce solo le aliquote attualmente abilitate
   */
  static async getActiveVatRates(): Promise<VatRateOption[]> {
    const settings = await this.getSettings();
    return (settings.rates || DEFAULT_VAT_RATES).filter(r => r.enabled !== false);
  }

  /**
   * Calcola l'IVA e il lordo di una singola riga partendo dal netto
   */
  static calculateLineVat(netAmount: number, vatRate: number): { netAmount: number; vatAmount: number; grossAmount: number } {
    const net = roundCurrency(netAmount);
    const rate = Math.max(0, Number(vatRate) || 0);
    const vat = roundCurrency(net * (rate / 100));
    const gross = roundCurrency(net + vat);
    return { netAmount: net, vatAmount: vat, grossAmount: gross };
  }

  /**
   * Scorpora l'IVA e il netto partendo da un totale lordo
   */
  static unbundleVat(grossAmount: number, vatRate: number): { netAmount: number; vatAmount: number; grossAmount: number } {
    const gross = roundCurrency(grossAmount);
    const rate = Math.max(0, Number(vatRate) || 0);
    if (rate === 0) {
      return { netAmount: gross, vatAmount: 0, grossAmount: gross };
    }
    const net = roundCurrency(gross / (1 + rate / 100));
    const vat = roundCurrency(gross - net);
    return { netAmount: net, vatAmount: vat, grossAmount: gross };
  }

  /**
   * Calcola il Castelletto IVA ufficiale con aggregazione per aliquota
   * Evita categoricamente le squadrature di centesimi tra imponibile e imposta
   */
  static calculateTotalsByVat(lines: Array<{ netAmount: number; vatRate: number; natureCode?: string }>): {
    totalNet: number;
    totalVat: number;
    totalGross: number;
    castelletto: Array<{ rate: number; natureCode?: string; taxableAmount: number; vatAmount: number }>;
  } {
    const mapByRate = new Map<string, { rate: number; natureCode?: string; taxableAmount: number }>();

    for (const line of lines) {
      const rate = Math.max(0, Number(line.vatRate) || 0);
      const net = roundCurrency(line.netAmount);
      const key = `${rate}_${line.natureCode || ''}`;

      const existing = mapByRate.get(key) || { rate, natureCode: line.natureCode, taxableAmount: 0 };
      existing.taxableAmount += net;
      mapByRate.set(key, existing);
    }

    let totalNet = 0;
    let totalVat = 0;
    const castelletto: Array<{ rate: number; natureCode?: string; taxableAmount: number; vatAmount: number }> = [];

    for (const group of mapByRate.values()) {
      const taxable = roundCurrency(group.taxableAmount);
      const vat = group.rate > 0 ? roundCurrency(taxable * (group.rate / 100)) : 0;
      totalNet += taxable;
      totalVat += vat;
      castelletto.push({
        rate: group.rate,
        natureCode: group.natureCode,
        taxableAmount: taxable,
        vatAmount: vat
      });
    }

    totalNet = roundCurrency(totalNet);
    totalVat = roundCurrency(totalVat);
    const totalGross = roundCurrency(totalNet + totalVat);

    return { totalNet, totalVat, totalGross, castelletto };
  }
}
