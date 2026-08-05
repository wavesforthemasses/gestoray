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
  where, 
  orderBy 
} from '$lib/firebase';
import type { CantiereItem } from './schema';
import { CantiereSettingsService } from './cantiereSettingsService';

export class CantieriService {
  private static COLLECTION = 'cantieri';

  static async getCantieri(clientId?: string): Promise<CantiereItem[]> {
    const colRef = collection(db, this.COLLECTION);
    const q = clientId 
      ? query(colRef, where('clientId', '==', clientId))
      : query(colRef, orderBy('createdAt', 'desc'));

    const snap = await getDocs(q);
    const list: CantiereItem[] = [];
    snap.forEach(d => {
      const data = d.data();
      list.push({
        id: d.id,
        code: data.code || '',
        clientId: data.clientId || '',
        clientName: data.clientName || data.original?.clientName || '',
        name: data.name || '',
        address: data.address || { street: '', city: '', zip: '', province: '' },
        status: data.status || 'fase_contrattuale',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        progress: data.progress ?? 0,
        estimatedAmount: data.estimatedAmount ?? data.original?.estimatedAmount ?? 0,
        notes: data.notes || '',
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
        original: data.original || {},
        derived: data.derived || {}
      });
    });
    return list;
  }

  static async getCantiereById(id: string): Promise<CantiereItem | null> {
    const d = await getDoc(doc(db, this.COLLECTION, id));
    if (!d.exists()) return null;
    const data = d.data();
    return {
      id: d.id,
      code: data.code || '',
      clientId: data.clientId || '',
      clientName: data.clientName || data.original?.clientName || '',
      name: data.name || '',
      address: data.address || { street: '', city: '', zip: '', province: '' },
      status: data.status || 'fase_contrattuale',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      progress: data.progress ?? 0,
      estimatedAmount: data.estimatedAmount ?? data.original?.estimatedAmount ?? 0,
      notes: data.notes || '',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      original: data.original || {},
      derived: data.derived || {}
    };
  }

  static async createCantiere(item: Omit<CantiereItem, 'id'>, uid: string): Promise<string> {
    const settings = await CantiereSettingsService.getSettings();
    let finalCode = item.code;
    
    if (!finalCode || finalCode === 'AUTO') {
      const generated = await CantiereSettingsService.generateNextCode(settings);
      finalCode = generated.code;
      await CantiereSettingsService.saveSettings(generated.updatedSettings);
    }

    const payload = {
      code: finalCode,
      clientId: item.clientId,
      clientName: item.clientName || '',
      name: item.name,
      address: item.address || { street: '', city: '', zip: '', province: '' },
      status: item.status || 'fase_contrattuale',
      startDate: item.startDate || new Date().toISOString(),
      endDate: item.endDate || '',
      progress: item.progress ?? 0,
      estimatedAmount: item.estimatedAmount ?? 0,
      notes: item.notes || '',
      createdAt: new Date().toISOString(),
      createdBy: uid,
      original: {
        code: finalCode,
        clientId: item.clientId,
        clientName: item.clientName || '',
        name: item.name,
        address: item.address,
        status: item.status,
        estimatedAmount: item.estimatedAmount,
        createdBy: uid
      }
    };

    const docRef = await addDoc(collection(db, this.COLLECTION), payload);
    return docRef.id;
  }

  static async updateCantiere(id: string, updates: Partial<CantiereItem>): Promise<void> {
    const docRef = doc(db, this.COLLECTION, id);
    const payload: any = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (updates.name !== undefined) payload['original.name'] = updates.name;
    if (updates.status !== undefined) payload['original.status'] = updates.status;
    if (updates.estimatedAmount !== undefined) payload['original.estimatedAmount'] = updates.estimatedAmount;
    if (updates.address !== undefined) payload['original.address'] = updates.address;

    await updateDoc(docRef, payload);
  }

  static async deleteCantiere(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION, id));
  }
}
