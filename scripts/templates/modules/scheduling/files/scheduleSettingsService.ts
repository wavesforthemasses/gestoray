import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { ScheduleSettings } from './schema';

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  entityNaming: 'pianificazione',
  customSingularLabel: '',
  customPluralLabel: '',
  defaultSlot: 'giornata_intera'
};

export class ScheduleSettingsService {
  private static SETTINGS_DOC_REF = doc(db, 'settings', 'scheduling');

  static async getSettings(): Promise<ScheduleSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_DOC_REF);
      if (snap.exists()) {
        return { ...DEFAULT_SCHEDULE_SETTINGS, ...snap.data() } as ScheduleSettings;
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni scheduling, uso default:', e);
    }
    return DEFAULT_SCHEDULE_SETTINGS;
  }

  static async saveSettings(settings: Partial<ScheduleSettings>): Promise<void> {
    await setDoc(this.SETTINGS_DOC_REF, settings, { merge: true });
  }

  static getLabels(settings: ScheduleSettings) {
    let singular = 'Pianificazione';
    let plural = 'Pianificazioni & Agenda';
    let newBtn = 'Nuova Pianificazione';

    switch (settings.entityNaming) {
      case 'agenda':
        singular = 'Appuntamento Agenda';
        plural = 'Agenda Operativa';
        newBtn = 'Nuovo Appuntamento';
        break;
      case 'programma':
        singular = 'Programma Lavoro';
        plural = 'Programma Lavori';
        newBtn = 'Nuovo Programma';
        break;
      case 'turni':
        singular = 'Turno';
        plural = 'Turni & Assegnazioni';
        newBtn = 'Nuovo Turno';
        break;
      case 'custom':
        singular = settings.customSingularLabel || 'Pianificazione';
        plural = settings.customPluralLabel || 'Pianificazioni';
        newBtn = `Nuova ${singular}`;
        break;
    }

    return { singular, plural, newBtn };
  }
}
