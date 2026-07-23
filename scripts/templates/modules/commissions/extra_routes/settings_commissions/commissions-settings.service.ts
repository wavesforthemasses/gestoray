import { db, doc, getDoc, setDoc } from '$lib/firebase';

export interface CommissionsSettingsPayload {
  qualificationMode: string;
  discountPenalty: string;
}

export class CommissionsSettingsService {
  static async loadSettings(): Promise<CommissionsSettingsPayload> {
    const defaultSettings = {
      qualificationMode: 'historical',
      discountPenalty: 'linear'
    };

    const docSnap = await getDoc(doc(db, 'settings', 'commissions'));
    if (docSnap.exists()) {
      return { ...defaultSettings, ...docSnap.data() };
    }
    return defaultSettings;
  }

  static async saveSettings(settings: CommissionsSettingsPayload, uid?: string): Promise<void> {
    await setDoc(doc(db, 'settings', 'commissions'), {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: uid
    }, { merge: true });
  }
}
