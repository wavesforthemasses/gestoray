import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { WarehouseSettings } from './schema';

export const DEFAULT_WAREHOUSE_SETTINGS: WarehouseSettings = {
  poPrefix: 'PO-',
  movementPrefix: 'MOV-',
  supplierPrefix: 'FOR-',
  valuationMethod: 'CMP',
  allowNegativeStock: false,
  defaultMinThreshold: 5
};

export class WarehouseSettingsService {
  static async getSettings(): Promise<WarehouseSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'warehouse'));
      if (snap.exists()) {
        const data = snap.data() as Partial<WarehouseSettings>;
        return {
          poPrefix: data.poPrefix ?? DEFAULT_WAREHOUSE_SETTINGS.poPrefix,
          movementPrefix: data.movementPrefix ?? DEFAULT_WAREHOUSE_SETTINGS.movementPrefix,
          supplierPrefix: data.supplierPrefix ?? DEFAULT_WAREHOUSE_SETTINGS.supplierPrefix,
          valuationMethod: data.valuationMethod ?? DEFAULT_WAREHOUSE_SETTINGS.valuationMethod,
          allowNegativeStock: data.allowNegativeStock ?? DEFAULT_WAREHOUSE_SETTINGS.allowNegativeStock,
          defaultMinThreshold: typeof data.defaultMinThreshold === 'number' ? data.defaultMinThreshold : DEFAULT_WAREHOUSE_SETTINGS.defaultMinThreshold
        };
      }
    } catch (err) {
      console.warn('Impossibile caricare le impostazioni magazzino da Firestore, uso valori predefiniti:', err);
    }
    return DEFAULT_WAREHOUSE_SETTINGS;
  }

  static async saveSettings(settings: Partial<WarehouseSettings>): Promise<void> {
    await setDoc(doc(db, 'settings', 'warehouse'), settings, { merge: true });
  }
}
