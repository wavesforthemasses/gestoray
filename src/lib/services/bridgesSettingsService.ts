import { db, doc, getDoc, setDoc } from '$lib/firebase';
import { writable, get } from 'svelte/store';

export interface BridgeConfig {
  id: string;
  title: string;
  sourceModule: string;
  targetModule: string;
  description: string;
  defaultEnabled?: boolean;
}

export const ALL_BRIDGES_SPECS: BridgeConfig[] = [
  {
    id: 'activities-clients',
    title: 'Bridge Attività ➔ Clienti',
    sourceModule: 'activities',
    targetModule: 'clients',
    description: 'Consente la registrazione rapida e la visualizzazione della timeline di chiamate, incontri, email e note nella scheda Cliente.'
  },
  {
    id: 'activities-contacts',
    title: 'Bridge Attività ➔ Contatti',
    sourceModule: 'activities',
    targetModule: 'contacts',
    description: 'Collega lo storico delle interazioni e la registrazione rapida di telefonate, email e incontri direttamente sul singolo Referente.'
  },
  {
    id: 'activities-places',
    title: 'Bridge Attività ➔ Luoghi',
    sourceModule: 'activities',
    targetModule: 'places',
    description: 'Collega sopralluoghi, verifiche periodiche e task operativi alla scheda Luogo/Cantiere.'
  },
  {
    id: 'activities-vehicles',
    title: 'Bridge Attività ➔ Mezzi',
    sourceModule: 'activities',
    targetModule: 'vehicles',
    description: 'Collega manutenzioni, tagliandi e revisioni periodiche al Mezzo aziendale.'
  },
  {
    id: 'activities-contracts',
    title: 'Bridge Attività ➔ Contratti',
    sourceModule: 'activities',
    targetModule: 'contracts',
    description: 'Traccia i follow-up commerciali e le negoziazioni collegate a Preventivi e Contratti.'
  },
  {
    id: 'contracts-projects',
    title: 'Bridge Contratti ➔ Progetti',
    sourceModule: 'contracts',
    targetModule: 'projects',
    description: 'Mostra la tab Preventivi & Contratti collegati all\'interno della scheda Progetto e deriva l\'importo contrattato.'
  },
  {
    id: 'contracts-places',
    title: 'Bridge Contratti ➔ Luoghi',
    sourceModule: 'contracts',
    targetModule: 'places',
    description: 'Mostra la tab Preventivi & Contratti collegati all\'interno della scheda Luogo/Cantiere.'
  },
  {
    id: 'payments-contracts',
    title: 'Bridge Incassi ➔ Contratti',
    sourceModule: 'payments',
    targetModule: 'contracts',
    description: 'Consente l\'allocazione degli incassi riscossi sulle rate dei contratti.'
  },
  {
    id: 'interventi-projects',
    title: 'Bridge Interventi ➔ Progetti',
    sourceModule: 'interventi',
    targetModule: 'projects',
    description: 'Collega i rapportini di lavoro al progetto e aggiorna la percentuale di avanzamento lavori.'
  },
  {
    id: 'interventi-places',
    title: 'Bridge Interventi ➔ Luoghi',
    sourceModule: 'interventi',
    targetModule: 'places',
    description: 'Collega i rapportini di lavoro e gli interventi sul campo alla destinazione geografica/luogo.'
  },
  {
    id: 'payments-projects',
    title: 'Bridge Incassi ➔ Progetti',
    sourceModule: 'payments',
    targetModule: 'projects',
    description: 'Mostra la situazione incassi e fatturato direttamente nel riepilogo finanziario del progetto.'
  }
];

export const bridgesConfigStore = writable<Record<string, boolean>>({});

let isInitialized = false;

export class BridgesSettingsService {
  private static SETTINGS_DOC = 'settings/bridges';

  static async init(): Promise<Record<string, boolean>> {
    const statuses = await this.getBridgeStatuses();
    bridgesConfigStore.set(statuses);
    isInitialized = true;
    return statuses;
  }

  static async getBridgeStatuses(): Promise<Record<string, boolean>> {
    const defaults: Record<string, boolean> = {};
    for (const b of ALL_BRIDGES_SPECS) {
      defaults[b.id] = b.defaultEnabled ?? true;
    }

    try {
      const snap = await getDoc(doc(db, 'settings', 'bridges'));
      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        const data = snap.data();
        if (data && typeof data.bridges === 'object') {
          return { ...defaults, ...data.bridges };
        }
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni bridge da Firestore, uso default:', e);
    }

    return defaults;
  }

  static async setBridgeStatus(bridgeId: string, enabled: boolean): Promise<void> {
    const current = await this.getBridgeStatuses();
    const updated = { ...current, [bridgeId]: enabled };
    await setDoc(doc(db, 'settings', 'bridges'), { bridges: updated }, { merge: true });
    bridgesConfigStore.set(updated);
  }

  static isBridgeEnabled(bridgeId: string, currentStoreValue?: Record<string, boolean>): boolean {
    const map = currentStoreValue || get(bridgesConfigStore);
    if (bridgeId in map) {
      return map[bridgeId];
    }
    return true; // Default enabled
  }
}
