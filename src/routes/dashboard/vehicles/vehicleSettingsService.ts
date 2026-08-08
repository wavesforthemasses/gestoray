import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { VehicleSettings } from './schema';

export class VehicleSettingsService {
  private static SETTINGS_PATH = doc(db, 'settings', 'vehicles');

  static async getSettings(): Promise<VehicleSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_PATH);
      if (snap.exists()) {
        const data = snap.data();
        return {
          entityNaming: data.entityNaming || 'mezzo',
          customSingularLabel: data.customSingularLabel || '',
          customPluralLabel: data.customPluralLabel || '',
          prefix: data.prefix ?? 'VEH-',
          includeYear: data.includeYear !== undefined ? data.includeYear : true,
          numberPadding: data.numberPadding || 3,
          lastNumber: data.lastNumber || 0,
          lastCounterYear: data.lastCounterYear || new Date().getFullYear(),
          defaultStatus: data.defaultStatus || 'disponibile'
        };
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni mezzi, uso default:', e);
    }
    return {
      entityNaming: 'mezzo',
      customSingularLabel: '',
      customPluralLabel: '',
      prefix: 'VEH-',
      includeYear: true,
      numberPadding: 3,
      lastNumber: 0,
      lastCounterYear: new Date().getFullYear(),
      defaultStatus: 'disponibile'
    };
  }

  static async saveSettings(settings: Partial<VehicleSettings>): Promise<void> {
    await setDoc(this.SETTINGS_PATH, settings, { merge: true });
  }

  static async generateNextCode(settings?: VehicleSettings): Promise<{ code: string; updatedSettings: VehicleSettings }> {
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

    const updatedSettings: VehicleSettings = {
      ...s,
      lastNumber: nextNum,
      lastCounterYear: counterYear
    };

    return { code, updatedSettings };
  }

  static getLabels(settings: VehicleSettings) {
    const naming = settings.entityNaming;
    if (naming === 'furgone') {
      return {
        singular: 'Furgone',
        plural: 'Furgoni',
        newBtn: 'Nuovo Furgone',
        codeLabel: 'Codice Furgone'
      };
    }
    if (naming === 'macchinario') {
      return {
        singular: 'Macchinario',
        plural: 'Macchinari',
        newBtn: 'Nuovo Macchinario',
        codeLabel: 'Codice Macchinario'
      };
    }
    if (naming === 'attrezzatura') {
      return {
        singular: 'Attrezzatura',
        plural: 'Attrezzature',
        newBtn: 'Nuova Attrezzatura',
        codeLabel: 'Codice Attrezzatura'
      };
    }
    if (naming === 'strumento') {
      return {
        singular: 'Strumento',
        plural: 'Strumenti',
        newBtn: 'Nuovo Strumento',
        codeLabel: 'Codice Strumento'
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
      singular: 'Mezzo',
      plural: 'Mezzi',
      newBtn: 'Nuovo Mezzo',
      codeLabel: 'Codice Mezzo'
    };
  }
}
