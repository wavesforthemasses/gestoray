import { db, collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from '$lib/firebase';

export interface AppNotification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'intervention' | 'ticket' | 'payment' | 'system';
  linkUrl?: string;
  read: boolean;
  createdAt: string;
}

export class NotificationsService {
  static listenUserNotifications(userUid: string, callback: (notifications: AppNotification[]) => void) {
    if (!userUid) {
      callback([]);
      return () => {};
    }

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', userUid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      return onSnapshot(q, (snap) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AppNotification));
        callback(list);
      }, (err) => {
        console.warn('Errore listener notifiche realtime:', err);
        callback([]);
      });
    } catch (e) {
      console.warn('Errore inizializzazione notifiche:', e);
      callback([]);
      return () => {};
    }
  }

  static async markAsRead(notificationId: string) {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (e) {
      console.warn('Errore aggiornamento stato notifica:', e);
    }
  }
}
