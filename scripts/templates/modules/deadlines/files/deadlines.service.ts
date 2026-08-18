import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction 
} from '$lib/firebase';
import type { DeadlineEntry, DeadlineSettings } from './schema';
import { DeadlineSettingsService } from './deadlineSettingsService';

export class DeadlinesService {
  private static COLLECTION_NAME = 'deadlines';

  static async getDeadlines(): Promise<DeadlineEntry[]> {
    let snap;
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('expiryDate', 'asc'));
      snap = await getDocs(q);
    } catch (e) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    if (snap.empty) {
      snap = await getDocs(collection(db, this.COLLECTION_NAME));
    }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DeadlineEntry));
    list.sort((a, b) => {
      const dA = a.expiryDate || '';
      const dB = b.expiryDate || '';
      return dA.localeCompare(dB);
    });
    return list;
  }

  static async getDeadlineById(id: string): Promise<DeadlineEntry | null> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as DeadlineEntry;
  }

  static async generateCode(settings: DeadlineSettings): Promise<string> {
    const settingsRef = doc(db, 'settings', 'deadlines');
    const currentYear = new Date().getFullYear();

    let code = '';
    await runTransaction(db, async (transaction: any) => {
      const snap = await transaction.get(settingsRef);
      let s = settings;
      if (snap.exists()) {
        s = { ...settings, ...snap.data() };
      }

      let lastNum = s.lastNumber || 0;
      let lastYear = s.lastCounterYear || currentYear;

      if (s.includeYear && lastYear !== currentYear) {
        lastNum = 0;
        lastYear = currentYear;
      }

      const newNum = lastNum + 1;
      const paddedNum = String(newNum).padStart(s.numberPadding || 4, '0');
      const yearPart = s.includeYear ? `${currentYear}-` : '';
      code = `${s.prefix || 'DDL-'}${yearPart}${paddedNum}`;

      transaction.set(settingsRef, {
        ...s,
        lastNumber: newNum,
        lastCounterYear: lastYear
      }, { merge: true });
    });

    return code;
  }

  static async createDeadline(
    data: Omit<DeadlineEntry, 'id' | 'code' | 'createdBy' | 'createdAt'>, 
    userUid = 'system'
  ): Promise<string> {
    const settings = await DeadlineSettingsService.getSettings();
    const code = await this.generateCode(settings);

    const payload = {
      ...data,
      code,
      status: data.status || settings.defaultStatus || 'attiva',
      reminderDaysBefore: data.reminderDaysBefore || settings.defaultReminderDays || [30, 15, 7, 1],
      createdBy: userUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ref = await addDoc(collection(db, this.COLLECTION_NAME), payload);
    return ref.id;
  }

  static async updateDeadline(id: string, data: Partial<DeadlineEntry>): Promise<void> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    await updateDoc(ref, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  static async deleteDeadline(id: string): Promise<void> {
    const ref = doc(db, this.COLLECTION_NAME, id);
    await deleteDoc(ref);
  }
}
