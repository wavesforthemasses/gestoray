import { db, doc, getDoc, setDoc } from '$lib/firebase';

export interface ProductFieldsSettings {
  sku: {
    visible: boolean;
    required: boolean;
  };
  category: {
    visible: boolean;
  };
  stockQty: {
    visible: boolean;
  };
  minimoFatturabile: {
    visible: boolean;
  };
  description: {
    visible: boolean;
  };
}

export const DEFAULT_PRODUCT_FIELDS_SETTINGS: ProductFieldsSettings = {
  sku: { visible: true, required: false },
  category: { visible: true },
  stockQty: { visible: true },
  minimoFatturabile: { visible: true },
  description: { visible: true }
};

export class ProductSettingsService {
  /**
   * Recupera la configurazione dei campi prodotti da Firestore o dai valori predefiniti.
   */
  static async getSettings(): Promise<ProductFieldsSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'product_fields'));
      if (snap.exists()) {
        const data = snap.data() as Partial<ProductFieldsSettings>;
        return {
          sku: {
            visible: data.sku?.visible ?? DEFAULT_PRODUCT_FIELDS_SETTINGS.sku.visible,
            required: data.sku?.required ?? DEFAULT_PRODUCT_FIELDS_SETTINGS.sku.required
          },
          category: {
            visible: data.category?.visible ?? DEFAULT_PRODUCT_FIELDS_SETTINGS.category.visible
          },
          stockQty: {
            visible: data.stockQty?.visible ?? DEFAULT_PRODUCT_FIELDS_SETTINGS.stockQty.visible
          },
          minimoFatturabile: {
            visible: data.minimoFatturabile?.visible ?? DEFAULT_PRODUCT_FIELDS_SETTINGS.minimoFatturabile.visible
          },
          description: {
            visible: data.description?.visible ?? DEFAULT_PRODUCT_FIELDS_SETTINGS.description.visible
          }
        };
      }
    } catch (err) {
      console.warn('Impossibile caricare le impostazioni campi prodotti da Firestore, uso valori predefiniti:', err);
    }
    return DEFAULT_PRODUCT_FIELDS_SETTINGS;
  }

  /**
   * Salva la configurazione dei campi prodotti su Firestore.
   */
  static async saveSettings(settings: ProductFieldsSettings): Promise<void> {
    await setDoc(doc(db, 'settings', 'product_fields'), settings, { merge: true });
  }
}
