import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, orderBy } from '$lib/firebase';

const COLLECTION_NAME = 'qualifications';

export interface Qualification {
  id?: string;
  name: string;
  percentage: number;
  supervisorPercentage: number;
}

export const QualificationsService = {
  async getAll(): Promise<Qualification[]> {
    let snap;
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('percentage', 'asc'));
      snap = await getDocs(q);
    } catch (e) {
      snap = await getDocs(collection(db, COLLECTION_NAME));
    }
    if (snap.empty) {
      const directSnap = await getDocs(collection(db, COLLECTION_NAME));
      if (!directSnap.empty) {
        snap = directSnap;
      }
    }
    const list: Qualification[] = [];
    snap.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Qualification, 'id'>) });
    });

    // Auto-insert defaults only if collection is truly empty
    if (list.length === 0) {
      const defaults = [
        { name: 'Junior', percentage: 10, supervisorPercentage: 0 },
        { name: 'Senior', percentage: 15, supervisorPercentage: 0 }
      ];
      for (const d of defaults) {
        const newId = 'qual_' + Math.random().toString(36).substring(2, 11);
        await setDoc(doc(db, COLLECTION_NAME, newId), d);
        list.push({ id: newId, ...d });
      }
    }

    return list;
  },

  async getOne(id: string): Promise<Qualification | null> {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...(docSnap.data() as Omit<Qualification, 'id'>) };
    }
    return null;
  },

  async create(data: Omit<Qualification, 'id'>): Promise<string> {
    const newId = 'qual_' + Math.random().toString(36).substring(2, 11);
    await setDoc(doc(db, COLLECTION_NAME, newId), data);
    return newId;
  },

  async update(id: string, data: Partial<Omit<Qualification, 'id'>>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};
