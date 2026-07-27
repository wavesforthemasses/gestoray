import { db, doc, getDoc, setDoc } from '$lib/firebase';

export interface ClientFieldsSettings {
  datiAnagrafici: {
    visible: boolean;
  };
  fatturazioneSede: {
    visible: boolean;
  };
  contattiReferenti: {
    visible: boolean;
  };
  affidabilitaCredito: {
    visible: boolean;
  };
  noteErp: {
    visible: boolean;
  };
}

export const DEFAULT_CLIENT_FIELDS_SETTINGS: ClientFieldsSettings = {
  datiAnagrafici: { visible: true },
  fatturazioneSede: { visible: true },
  contattiReferenti: { visible: true },
  affidabilitaCredito: { visible: true },
  noteErp: { visible: true }
};

export class ClientSettingsService {
  /**
   * Retrieves client fields settings from Firestore settings/client_fields or returns defaults.
   */
  static async getSettings(): Promise<ClientFieldsSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'client_fields'));
      if (snap.exists()) {
        const data = snap.data() as Partial<ClientFieldsSettings>;
        return {
          datiAnagrafici: {
            visible: data.datiAnagrafici?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.datiAnagrafici.visible
          },
          fatturazioneSede: {
            visible: data.fatturazioneSede?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.fatturazioneSede.visible
          },
          contattiReferenti: {
            visible: data.contattiReferenti?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.contattiReferenti.visible
          },
          affidabilitaCredito: {
            visible: data.affidabilitaCredito?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.affidabilitaCredito.visible
          },
          noteErp: {
            visible: data.noteErp?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.noteErp.visible
          }
        };
      }
    } catch (err) {
      console.warn('Unable to load client fields settings from Firestore, using default values:', err);
    }
    return DEFAULT_CLIENT_FIELDS_SETTINGS;
  }

  /**
   * Saves client fields settings to Firestore.
   */
  static async saveSettings(settings: ClientFieldsSettings): Promise<void> {
    await setDoc(doc(db, 'settings', 'client_fields'), settings, { merge: true });
  }
}
