import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, orderBy } from '$lib/firebase';

const COLLECTION_NAME = 'tickets';

export interface TicketsItem {
  id?: string;
  name: string;
}

export const TicketsService = {
  async getAll(): Promise<TicketsItem[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    const list: TicketsItem[] = [];
    snap.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as Omit<TicketsItem, 'id'>) });
    });
    return list;
  },

  async getOne(id: string): Promise<TicketsItem | null> {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...(docSnap.data() as Omit<TicketsItem, 'id'>) };
    }
    return null;
  },

  async create(data: Omit<TicketsItem, 'id'>): Promise<string> {
    const newId = 'tickets_' + Math.random().toString(36).substring(2, 11);
    await setDoc(doc(db, COLLECTION_NAME, newId), data);
    return newId;
  },

  async update(id: string, data: Partial<Omit<TicketsItem, 'id'>>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};
