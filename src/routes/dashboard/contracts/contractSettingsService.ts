import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { ContractSettings } from './schema';

export const DEFAULT_CONTRACT_SETTINGS: ContractSettings = {
  entityNaming: 'contract',
  prefix: 'CTR-',
  includeYear: true,
  numberPadding: 4,
  lastNumber: 0,
  resetCounterAnnually: true,
  lastCounterYear: new Date().getFullYear(),
  allowedTypes: ['Non Ricorrente'],
  defaultType: 'Non Ricorrente',
  defaultInitialStatus: 'bozza',
  defaultTermsAndConditions: 'Offerta valida 30 giorni dalla data di emissione. Pagamento come da accordi contrattuali.',
  nonRecurringEndDateMode: 'optional',
  enableProjectsBridge: true,
  enablePlacesBridge: true
};

export class ContractSettingsService {
  private static SETTINGS_DOC_PATH = 'settings/contract_settings';

  static async getSettings(): Promise<ContractSettings> {
    try {
      const ref = doc(db, this.SETTINGS_DOC_PATH);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const raw = snap.data();
        let allowed = raw.allowedTypes || ['Non Ricorrente'];
        allowed = allowed.map((t: string) => {
          if (t === 'Canone Ricorrente') return 'Ricorrente';
          if (t === 'Fornitura / Quotazione' || t === 'Monte Ore' || t === 'SLA Garantito' || t === 'Licenza / Abbonamento') return 'Non Ricorrente';
          return t;
        });
        allowed = Array.from(new Set(allowed));

        // Ensure defaultType is valid: must be within allowedTypes
        let defaultType = raw.defaultType as string | undefined;
        if (!defaultType || !allowed.includes(defaultType)) {
          defaultType = allowed[0];
        }

        return { 
          ...DEFAULT_CONTRACT_SETTINGS, 
          ...raw,
          allowedTypes: allowed,
          defaultType: defaultType as any
        } as ContractSettings;
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni contratti/preventivi:', e);
    }
    return DEFAULT_CONTRACT_SETTINGS;
  }

  static async saveSettings(settings: Partial<ContractSettings>): Promise<ContractSettings> {
    const current = await this.getSettings();
    const updated: ContractSettings = {
      ...current,
      ...settings
    };
    const ref = doc(db, this.SETTINGS_DOC_PATH);
    await setDoc(ref, updated, { merge: true });
    return updated;
  }

  static getLabels(settings: ContractSettings) {
    const isQuote = settings.entityNaming === 'quote';
    return {
      isQuote,
      singular: isQuote ? 'Preventivo' : 'Contratto',
      plural: isQuote ? 'Preventivi' : 'Contratti',
      newSingular: isQuote ? 'Nuovo Preventivo' : 'Nuovo Contratto',
      detailSingular: isQuote ? 'Dettaglio Preventivo' : 'Dettaglio Contratto',
      editSingular: isQuote ? 'Modifica Preventivo' : 'Modifica Contratto',
      managementTitle: isQuote ? 'Gestione Preventivi & Quotazioni' : 'Gestione Contratti & Canoni',
      managementSubtitle: isQuote 
        ? 'Pianifica, calcola e gestisci le quotazioni ed i preventivi per i clienti.'
        : 'Pianifica, monitora e gestisci tutti i contratti aziendali ed i canoni di fatturazione.',
      numberLabel: isQuote ? 'N° Preventivo' : 'N° Contratto',
      titleLabel: isQuote ? 'Oggetto / Titolo Preventivo' : 'Oggetto / Titolo Contratto',
      typeLabel: isQuote ? 'Tipologia Quotazione' : 'Tipologia Contratto',
      totalValueLabel: isQuote ? 'Valore Quotazione' : 'Valore Totale Contratto',
      portfolioLabel: isQuote ? 'Valore Preventivi' : 'Valore Portafoglio',
      activeTabLabel: isQuote ? 'Approvati / Accettati' : 'Attivi',
      expiringTabLabel: isQuote ? 'In Trattativa' : 'In Scadenza',
      expiredTabLabel: isQuote ? 'Rifiutati / Scaduti' : 'Scaduti',
    };
  }
}
