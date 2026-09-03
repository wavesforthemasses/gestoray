import { db, doc, getDoc, setDoc } from '$lib/firebase';
import { cleanUndefined } from '$lib/utils/helpers';
import type { JobCostingSettings } from './schema';

export const DEFAULT_JOB_COSTING_SETTINGS: JobCostingSettings = {
  prefix: 'COMM-',
  includeYear: true,
  numberPadding: 3,
  lastNumber: 0,
  lastCounterYear: new Date().getFullYear(),
  defaultHourlyLaborRate: 30.00,
  defaultVehicleDailyRate: 40.00,
  warningMarginThresholdPercent: 20,
  criticalMarginThresholdPercent: 10
};

const SETTINGS_DOC_PATH = 'job_costing_settings/general';

export const JobCostingSettingsService = {
  async getSettings(): Promise<JobCostingSettings> {
    try {
      const snap = await getDoc(doc(db, 'job_costing_settings', 'general'));
      if (snap.exists()) {
        return { ...DEFAULT_JOB_COSTING_SETTINGS, ...(snap.data() as JobCostingSettings) };
      }
      return DEFAULT_JOB_COSTING_SETTINGS;
    } catch (e) {
      console.warn('Errore lettura impostazioni job_costing:', e);
      return DEFAULT_JOB_COSTING_SETTINGS;
    }
  },

  async saveSettings(settings: JobCostingSettings): Promise<void> {
    await setDoc(doc(db, 'job_costing_settings', 'general'), cleanUndefined(settings), { merge: true });
  },

  async generateNextCode(): Promise<string> {
    const settings = await this.getSettings();
    const nowYear = new Date().getFullYear();
    let nextNum = (settings.lastNumber || 0) + 1;

    if (settings.includeYear && settings.lastCounterYear !== nowYear) {
      nextNum = 1;
      settings.lastCounterYear = nowYear;
    }

    settings.lastNumber = nextNum;
    await this.saveSettings(settings);

    const padded = String(nextNum).padStart(settings.numberPadding || 3, '0');
    if (settings.includeYear) {
      return `${settings.prefix || 'COMM-'}${nowYear}-${padded}`;
    }
    return `${settings.prefix || 'COMM-'}${padded}`;
  }
};
