import { db, doc, getDoc, setDoc } from '$lib/firebase';

export interface ClientFieldsSettings {
  datiAnagrafici: {
    defaultStatoCertificazione: string;
    defaultGruppoCliente: string;
  };
  sediConfig: {
    defaultSedeId: 'operativa' | 'legale' | 'spedizione';
    sedi: {
      operativa: { visible: boolean; autoCopyFromDefault: boolean };
      legale: { visible: boolean; autoCopyFromDefault: boolean };
      spedizione: { visible: boolean; autoCopyFromDefault: boolean };
    };
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
  datiAnagrafici: {
    defaultStatoCertificazione: 'in_attesa',
    defaultGruppoCliente: 'Standard'
  },
  sediConfig: {
    defaultSedeId: 'operativa',
    sedi: {
      operativa: { visible: true, autoCopyFromDefault: false },
      legale: { visible: true, autoCopyFromDefault: true },
      spedizione: { visible: true, autoCopyFromDefault: true }
    }
  },
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
            defaultStatoCertificazione: data.datiAnagrafici?.defaultStatoCertificazione || DEFAULT_CLIENT_FIELDS_SETTINGS.datiAnagrafici.defaultStatoCertificazione,
            defaultGruppoCliente: data.datiAnagrafici?.defaultGruppoCliente || DEFAULT_CLIENT_FIELDS_SETTINGS.datiAnagrafici.defaultGruppoCliente
          },
          sediConfig: {
            defaultSedeId: data.sediConfig?.defaultSedeId || DEFAULT_CLIENT_FIELDS_SETTINGS.sediConfig.defaultSedeId,
            sedi: {
              operativa: {
                visible: true, // Operating address is always visible
                autoCopyFromDefault: false
              },
              legale: {
                visible: data.sediConfig?.sedi?.legale?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.sediConfig.sedi.legale.visible,
                autoCopyFromDefault: data.sediConfig?.sedi?.legale?.autoCopyFromDefault ?? DEFAULT_CLIENT_FIELDS_SETTINGS.sediConfig.sedi.legale.autoCopyFromDefault
              },
              spedizione: {
                visible: data.sediConfig?.sedi?.spedizione?.visible ?? DEFAULT_CLIENT_FIELDS_SETTINGS.sediConfig.sedi.spedizione.visible,
                autoCopyFromDefault: data.sediConfig?.sedi?.spedizione?.autoCopyFromDefault ?? DEFAULT_CLIENT_FIELDS_SETTINGS.sediConfig.sedi.spedizione.autoCopyFromDefault
              }
            }
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
   * Saves client fields settings to Firestore settings/client_fields.
   */
  static async saveSettings(settings: ClientFieldsSettings): Promise<void> {
    await setDoc(doc(db, 'settings', 'client_fields'), settings, { merge: true });
  }
}

