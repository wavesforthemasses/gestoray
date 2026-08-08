import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { DeadlineSettings } from './schema';

export const DEFAULT_DEADLINE_SETTINGS: DeadlineSettings = {
  entityNaming: 'scadenzario',
  customSingularLabel: '',
  customPluralLabel: '',
  prefix: 'DDL-',
  includeYear: true,
  numberPadding: 4,
  lastNumber: 0,
  lastCounterYear: new Date().getFullYear(),
  defaultStatus: 'attiva',
  defaultReminderDays: [30, 15, 7, 1],
  enablePushNotifications: false,
  fcmMessagingSenderId: ''
};

export class DeadlineSettingsService {
  private static SETTINGS_DOC_REF = doc(db, 'settings', 'deadlines');

  static async getSettings(): Promise<DeadlineSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_DOC_REF);
      if (snap.exists()) {
        return { ...DEFAULT_DEADLINE_SETTINGS, ...snap.data() } as DeadlineSettings;
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni deadlines, uso default:', e);
    }
    return DEFAULT_DEADLINE_SETTINGS;
  }

  static async saveSettings(settings: Partial<DeadlineSettings>): Promise<void> {
    await setDoc(this.SETTINGS_DOC_REF, settings, { merge: true });
  }

  static getLabels(settings: DeadlineSettings) {
    let singular = 'Scadenza';
    let plural = 'Scadenzario & Allarmi';
    let newBtn = 'Nuova Scadenza';

    switch (settings.entityNaming) {
      case 'allarmi':
        singular = 'Allarme';
        plural = 'Allarmi & Avvisi';
        newBtn = 'Nuovo Allarme';
        break;
      case 'avvisi':
        singular = 'Avviso';
        plural = 'Avvisi & Scadenze';
        newBtn = 'Nuovo Avviso';
        break;
      case 'custom':
        singular = settings.customSingularLabel || 'Scadenza';
        plural = settings.customPluralLabel || 'Scadenze';
        newBtn = `Nuova ${singular}`;
        break;
    }

    return { singular, plural, newBtn };
  }
}
