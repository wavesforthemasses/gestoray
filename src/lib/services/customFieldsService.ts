import { db, collection, getDocs, doc, setDoc, deleteDoc, query, where } from '$lib/firebase';
import type { CustomFieldDefinition } from '$lib/types/customFields';

export class CustomFieldsService {
  private static COLLECTION_NAME = 'custom_fields';

  static async getFieldsForModule(module: string): Promise<CustomFieldDefinition[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('module', 'in', [module, 'global']),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CustomFieldDefinition));
    } catch (e) {
      console.warn(`Errore recupero campi dinamici per modulo '${module}':`, e);
      return [];
    }
  }

  static async getAllFields(): Promise<CustomFieldDefinition[]> {
    try {
      const snap = await getDocs(collection(db, this.COLLECTION_NAME));
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CustomFieldDefinition));
    } catch (e) {
      console.warn('Errore recupero tutti i campi dinamici:', e);
      return [];
    }
  }

  static async saveField(field: Partial<CustomFieldDefinition>): Promise<string> {
    const id = field.id || 'cf_' + Date.now();
    const docRef = doc(db, this.COLLECTION_NAME, id);
    const payload = {
      ...field,
      id,
      key: field.key || field.label?.toLowerCase().replace(/[^a-z0-9]/g, '_') || id,
      active: field.active !== undefined ? field.active : true,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    return id;
  }

  static async deleteField(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
