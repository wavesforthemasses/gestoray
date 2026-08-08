import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { TeamSettings } from './schema';

export class TeamSettingsService {
  private static SETTINGS_PATH = doc(db, 'settings', 'teams');

  static async getSettings(): Promise<TeamSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_PATH);
      if (snap.exists()) {
        const data = snap.data();
        return {
          entityNaming: data.entityNaming || 'squadra',
          customSingularLabel: data.customSingularLabel || '',
          customPluralLabel: data.customPluralLabel || '',
          prefix: data.prefix ?? 'SQD-',
          includeYear: data.includeYear !== undefined ? data.includeYear : true,
          numberPadding: data.numberPadding || 3,
          lastNumber: data.lastNumber || 0,
          lastCounterYear: data.lastCounterYear || new Date().getFullYear(),
          defaultStatus: data.defaultStatus || 'attiva'
        };
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni squadre, uso default:', e);
    }
    return {
      entityNaming: 'squadra',
      customSingularLabel: '',
      customPluralLabel: '',
      prefix: 'SQD-',
      includeYear: true,
      numberPadding: 3,
      lastNumber: 0,
      lastCounterYear: new Date().getFullYear(),
      defaultStatus: 'attiva'
    };
  }

  static async saveSettings(settings: Partial<TeamSettings>): Promise<void> {
    await setDoc(this.SETTINGS_PATH, settings, { merge: true });
  }

  static async generateNextCode(settings?: TeamSettings): Promise<{ code: string; updatedSettings: TeamSettings }> {
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

    const updatedSettings: TeamSettings = {
      ...s,
      lastNumber: nextNum,
      lastCounterYear: counterYear
    };

    return { code, updatedSettings };
  }

  static getLabels(settings: TeamSettings) {
    const naming = settings.entityNaming;
    if (naming === 'team') {
      return {
        singular: 'Team',
        plural: 'Team',
        newBtn: 'Nuovo Team',
        codeLabel: 'Codice Team'
      };
    }
    if (naming === 'gruppo') {
      return {
        singular: 'Gruppo',
        plural: 'Gruppi',
        newBtn: 'Nuovo Gruppo',
        codeLabel: 'Codice Gruppo'
      };
    }
    if (naming === 'risorsa') {
      return {
        singular: 'Risorsa',
        plural: 'Risorse',
        newBtn: 'Nuova Risorsa',
        codeLabel: 'Codice Risorsa'
      };
    }
    if (naming === 'custom' && settings.customSingularLabel && settings.customPluralLabel) {
      return {
        singular: settings.customSingularLabel,
        plural: settings.customPluralLabel,
        newBtn: `Nuovo ${settings.customSingularLabel}`,
        codeLabel: `Codice ${settings.customSingularLabel}`
      };
    }
    return {
      singular: 'Squadra',
      plural: 'Squadre',
      newBtn: 'Nuova Squadra',
      codeLabel: 'Codice Squadra'
    };
  }
}
