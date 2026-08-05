import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { CantiereSettings } from './schema';

export class CantiereSettingsService {
  private static SETTINGS_PATH = doc(db, 'settings', 'cantieri');

  static async getSettings(): Promise<CantiereSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_PATH);
      if (snap.exists()) {
        const data = snap.data();
        return {
          entityNaming: data.entityNaming || 'cantiere',
          prefix: data.prefix ?? 'CANTIERE-',
          includeYear: data.includeYear !== undefined ? data.includeYear : true,
          numberPadding: data.numberPadding || 3,
          lastNumber: data.lastNumber || 0,
          lastCounterYear: data.lastCounterYear || new Date().getFullYear(),
          defaultStatus: data.defaultStatus || 'fase_contrattuale'
        };
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni cantieri, uso default:', e);
    }
    return {
      entityNaming: 'cantiere',
      prefix: 'CANTIERE-',
      includeYear: true,
      numberPadding: 3,
      lastNumber: 0,
      lastCounterYear: new Date().getFullYear(),
      defaultStatus: 'fase_contrattuale'
    };
  }

  static async saveSettings(settings: Partial<CantiereSettings>): Promise<void> {
    await setDoc(this.SETTINGS_PATH, settings, { merge: true });
  }

  static async generateNextCode(settings?: CantiereSettings): Promise<{ code: string; updatedSettings: CantiereSettings }> {
    const s = settings || await this.getSettings();
    const currentYear = new Date().getFullYear();
    let nextNum = s.lastNumber + 1;
    let counterYear = s.lastCounterYear;

    if (s.includeYear && currentYear !== s.lastCounterYear) {
      nextNum = 1;
      counterYear = currentYear;
    }

    const paddedNum = String(nextNum).padStart(s.numberPadding, '0');
    const yearStr = s.includeYear ? `${currentYear}-` : '';
    const code = `${s.prefix}${yearStr}${paddedNum}`;

    const updatedSettings: CantiereSettings = {
      ...s,
      lastNumber: nextNum,
      lastCounterYear: counterYear
    };

    return { code, updatedSettings };
  }

  static getLabels(settings: CantiereSettings) {
    const isCommessa = settings.entityNaming === 'commessa';
    return {
      singular: isCommessa ? 'Commessa' : 'Cantiere',
      plural: isCommessa ? 'Commesse' : 'Cantieri',
      newBtn: isCommessa ? 'Nuova Commessa' : 'Nuovo Cantiere',
      codeLabel: isCommessa ? 'Codice Commessa' : 'Codice Cantiere'
    };
  }
}
