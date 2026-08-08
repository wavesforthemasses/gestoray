import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, orderBy, where } from '$lib/firebase';
import type { VehicleItem } from './schema';
import { VehicleSettingsService } from './vehicleSettingsService';

export class VehiclesService {
  private static COLLECTION_NAME = 'vehicles';

  static async getVehicles(): Promise<VehicleItem[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VehicleItem));
    } catch (e) {
      console.error('Errore durante la lettura dei mezzi:', e);
      throw e;
    }
  }

  static async getVehicleById(id: string): Promise<VehicleItem | null> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as VehicleItem;
      }
      return null;
    } catch (e) {
      console.error(`Errore durante il recupero del mezzo ${id}:`, e);
      throw e;
    }
  }

  static async createVehicle(vehicleData: Omit<VehicleItem, 'id' | 'code' | 'createdAt'>): Promise<string> {
    try {
      const { code, updatedSettings } = await VehicleSettingsService.generateNextCode();
      const payload = {
        ...vehicleData,
        code,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);
      await VehicleSettingsService.saveSettings(updatedSettings);
      return docRef.id;
    } catch (e) {
      console.error('Errore durante la creazione del mezzo:', e);
      throw e;
    }
  }

  static async updateVehicle(id: string, updates: Partial<VehicleItem>): Promise<void> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(ref, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Errore durante l'aggiornamento del mezzo ${id}:`, e);
      throw e;
    }
  }

  static async deleteVehicle(id: string): Promise<void> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(ref);
    } catch (e) {
      console.error(`Errore durante l'eliminazione del mezzo ${id}:`, e);
      throw e;
    }
  }
}
