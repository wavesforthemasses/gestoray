import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { ProjectSettings } from './schema';

export class ProjectSettingsService {
  private static SETTINGS_PATH = doc(db, 'settings', 'projects');

  static async getSettings(): Promise<ProjectSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_PATH);
      if (snap.exists()) {
        const data = snap.data();
        return {
          entityNaming: data.entityNaming || 'progetto',
          customSingularLabel: data.customSingularLabel || '',
          customPluralLabel: data.customPluralLabel || '',
          prefix: data.prefix ?? 'PROG-',
          includeYear: data.includeYear !== undefined ? data.includeYear : true,
          numberPadding: data.numberPadding || 3,
          lastNumber: data.lastNumber || 0,
          lastCounterYear: data.lastCounterYear || new Date().getFullYear(),
          defaultStatus: data.defaultStatus || 'fase_contrattuale'
        };
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni progetti, uso default:', e);
    }
    return {
      entityNaming: 'progetto',
      customSingularLabel: '',
      customPluralLabel: '',
      prefix: 'PROG-',
      includeYear: true,
      numberPadding: 3,
      lastNumber: 0,
      lastCounterYear: new Date().getFullYear(),
      defaultStatus: 'fase_contrattuale'
    };
  }

  static async saveSettings(settings: Partial<ProjectSettings>): Promise<void> {
    await setDoc(this.SETTINGS_PATH, settings, { merge: true });
  }

  static async generateNextCode(settings?: ProjectSettings): Promise<{ code: string; updatedSettings: ProjectSettings }> {
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

    const updatedSettings: ProjectSettings = {
      ...s,
      lastNumber: nextNum,
      lastCounterYear: counterYear
    };

    return { code, updatedSettings };
  }

  static getLabels(settings: ProjectSettings) {
    const naming = settings.entityNaming;
    if (naming === 'cantiere') {
      return {
        singular: 'Cantiere',
        plural: 'Cantieri',
        newBtn: 'Nuovo Cantiere',
        codeLabel: 'Codice Cantiere'
      };
    }
    if (naming === 'commessa') {
      return {
        singular: 'Commessa',
        plural: 'Commesse',
        newBtn: 'Nuova Commessa',
        codeLabel: 'Codice Commessa'
      };
    }
    if (naming === 'pratica') {
      return {
        singular: 'Pratica',
        plural: 'Pratiche',
        newBtn: 'Nuova Pratica',
        codeLabel: 'Codice Pratica'
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
      singular: 'Progetto',
      plural: 'Progetti',
      newBtn: 'Nuovo Progetto',
      codeLabel: 'Codice Progetto'
    };
  }
}
