import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, deleteDoc, functions, httpsCallable } from '$lib/firebase';

export class CommissionsService {
  static async getVersions(periodId: string) {
    const versionsRef = collection(db, 'commissions_closings', periodId, 'versions');
    const q = query(versionsRef, orderBy('generatedAt', 'desc'));
    const snap = await getDocs(q);
    
    const vList: any[] = [];
    snap.forEach((d: any) => {
      vList.push({ id: d.id, ...d.data() });
    });
    return vList;
  }

  static async getVersion(periodId: string, versionId: string) {
    const snap = await getDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  }

  static async deleteVersion(periodId: string, versionId: string) {
    await deleteDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId));
  }

  static async finalizeVersion(periodId: string, versionId: string, userId: string, userEmail: string) {
    const now = new Date().toISOString();

    await updateDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId), {
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: userId,
      finalizedEmail: userEmail
    });

    await updateDoc(doc(db, 'commissions_closings', periodId), {
      latestStatus: 'finalized',
      updatedAt: now
    });

    return now;
  }

  static async generateCalculation(periodId: string, month: number, year: number, userId: string, userEmail: string, hasAnyFinalized: boolean) {
    const generateCommissions = httpsCallable(functions, 'generateCommissionsCalculation');
    const payload = {
      periodId,
      month,
      year,
      hasAnyFinalized
    };
    
    try {
      const result = await generateCommissions(payload);
      return result.data;
    } catch (e: any) {
      throw new Error(e.message || "Errore durante il calcolo delle provvigioni.");
    }
  }
}
