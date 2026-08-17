import { db, collection, getDocs, query, orderBy, limit } from '$lib/firebase';

export class ImportLogsService {
  static async getRecentLogs(limitCount = 20): Promise<any[]> {
    try {
      const q = query(
        collection(db, 'system_import_logs'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (err) {
      console.warn('[ImportLogsService] Could not load import logs:', err);
      return [];
    }
  }
}
