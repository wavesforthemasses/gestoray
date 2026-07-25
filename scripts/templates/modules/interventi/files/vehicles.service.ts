import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from '$lib/firebase';
import type { VehicleItem } from './schema';

export class VehiclesService {
  private static COLLECTION_NAME = 'vehicles';

  static async getVehicles(): Promise<VehicleItem[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VehicleItem));
    } catch (e) {
      console.warn('Errore lettura collezioni veicoli:', e);
      return [];
    }
  }

  static async getVehicleById(id: string): Promise<VehicleItem | null> {
    const d = await getDoc(doc(db, this.COLLECTION_NAME, id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as VehicleItem;
  }

  static async createVehicle(vehicle: Partial<VehicleItem>): Promise<string> {
    const payload = {
      name: vehicle.name || 'Nuovo Mezzo',
      plate: vehicle.plate || '',
      type: vehicle.type || 'Furgone',
      status: vehicle.status || 'disponibile',
      notes: vehicle.notes || '',
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);
    return docRef.id;
  }

  static async updateVehicle(id: string, data: Partial<VehicleItem>): Promise<void> {
    await updateDoc(doc(db, this.COLLECTION_NAME, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  static async deleteVehicle(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
