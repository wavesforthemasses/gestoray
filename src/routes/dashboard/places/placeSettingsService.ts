import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { PlaceSettings } from './schema';

export class PlaceSettingsService {
  private static SETTINGS_PATH = doc(db, 'settings', 'places');

  static async getSettings(): Promise<PlaceSettings> {
    try {
      const snap = await getDoc(this.SETTINGS_PATH);
      if (snap.exists()) {
        const data = snap.data();
        return {
          entityNaming: data.entityNaming || 'luogo',
          customSingularLabel: data.customSingularLabel || '',
          customPluralLabel: data.customPluralLabel || '',
          prefix: data.prefix ?? 'LUG-',
          includeYear: data.includeYear !== undefined ? data.includeYear : true,
          numberPadding: data.numberPadding || 3,
          lastNumber: data.lastNumber || 0,
          lastCounterYear: data.lastCounterYear || new Date().getFullYear(),
          defaultStatus: data.defaultStatus || 'attivo',
          presence: {
            presenceTrackingEnabled: data.presence?.presenceTrackingEnabled !== false,
            defaultMode: data.presence?.defaultMode || 'proximity_radar',
            checkInPromptMode: data.presence?.checkInPromptMode || 'prompt',
            autoCheckoutOnExit: data.presence?.autoCheckoutOnExit ?? false,
            checkoutCooldownMinutes: data.presence?.checkoutCooldownMinutes ?? 15,
            allowManualCheckIn: data.presence?.allowManualCheckIn !== false,
            requireGpsValidation: data.presence?.requireGpsValidation ?? true,
            gpsToleranceMeters: data.presence?.gpsToleranceMeters ?? 25,
            allowTeamLeaderCheckin: data.presence?.allowTeamLeaderCheckin !== false,
            predictiveAutoCloseEnabled: data.presence?.predictiveAutoCloseEnabled !== false,
            defaultMaxShiftHours: data.presence?.defaultMaxShiftHours ?? 10,
            autoCloseGraceMinutes: data.presence?.autoCloseGraceMinutes ?? 60
          }
        };
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni luoghi, uso default:', e);
    }
    return {
      entityNaming: 'luogo',
      customSingularLabel: '',
      customPluralLabel: '',
      prefix: 'LUG-',
      includeYear: true,
      numberPadding: 3,
      lastNumber: 0,
      lastCounterYear: new Date().getFullYear(),
      defaultStatus: 'attivo',
      presence: {
        presenceTrackingEnabled: true,
        defaultMode: 'proximity_radar',
        checkInPromptMode: 'prompt',
        autoCheckoutOnExit: false,
        checkoutCooldownMinutes: 15,
        allowManualCheckIn: true,
        requireGpsValidation: true,
        gpsToleranceMeters: 25,
        allowTeamLeaderCheckin: true,
        predictiveAutoCloseEnabled: true,
        defaultMaxShiftHours: 10,
        autoCloseGraceMinutes: 60
      }
    };
  }

  static async saveSettings(settings: Partial<PlaceSettings>): Promise<void> {
    await setDoc(this.SETTINGS_PATH, settings, { merge: true });
  }

  static async generateNextCode(settings?: PlaceSettings): Promise<{ code: string; updatedSettings: PlaceSettings }> {
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

    const updatedSettings: PlaceSettings = {
      ...s,
      lastNumber: nextNum,
      lastCounterYear: counterYear
    };

    return { code, updatedSettings };
  }

  static getLabels(settings: PlaceSettings) {
    const naming = settings.entityNaming;
    if (naming === 'cantiere') {
      return {
        singular: 'Cantiere',
        plural: 'Cantieri',
        newBtn: 'Nuovo Cantiere',
        codeLabel: 'Codice Cantiere'
      };
    }
    if (naming === 'sede') {
      return {
        singular: 'Sede Operativa',
        plural: 'Sedi Operative',
        newBtn: 'Nuova Sede',
        codeLabel: 'Codice Sede'
      };
    }
    if (naming === 'destinazione') {
      return {
        singular: 'Destinazione',
        plural: 'Destinazioni',
        newBtn: 'Nuova Destinazione',
        codeLabel: 'Codice Destinazione'
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
      singular: 'Luogo',
      plural: 'Luoghi',
      newBtn: 'Nuovo Luogo',
      codeLabel: 'Codice Luogo'
    };
  }
}
