import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, orderBy } from '$lib/firebase';

const COLLECTION_NAME = '__COLLECTION__';

export interface __Name__Item {
  id?: string;
  name: string;
}

export const __Name__Service = {
  async getAll(): Promise<__Name__Item[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    const list: __Name__Item[] = [];
    snap.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as Omit<__Name__Item, 'id'>) });
    });
    return list;
  },

  async getOne(id: string): Promise<__Name__Item | null> {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...(docSnap.data() as Omit<__Name__Item, 'id'>) };
    }
    return null;
  },

  async create(data: Omit<__Name__Item, 'id'>): Promise<string> {
    const newId = '__name___' + Math.random().toString(36).substring(2, 11);
    await setDoc(doc(db, COLLECTION_NAME, newId), data);
    return newId;
  },

  async update(id: string, data: Partial<Omit<__Name__Item, 'id'>>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};
