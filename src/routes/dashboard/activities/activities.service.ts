import { db, collectionGroup, getDocs } from '$lib/firebase';

export interface ActivityItem {
  id: string;
  clientId: string;
  clientName: string;
  type: 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC';
  notes: string;
  date: string;
  loggedBy: string;
  loggedEmail: string;
}

export class ActivitiesService {
  static async fetchActivities(): Promise<ActivityItem[]> {
    const querySnapshot = await getDocs(collectionGroup(db, 'activities'));
    const list: ActivityItem[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const payload = doc.data();
      const data = payload.original || payload; // Support both nested structure and flat structure
      
      list.push({
        id: doc.id,
        clientId: data.clientId,
        clientName: data.clientName || 'Sconosciuto',
        type: data.type,
        notes: data.notes || '',
        date: data.date || payload.edits?.createdAt || payload.createdAt || new Date().toISOString(),
        loggedBy: data.loggedBy,
        loggedEmail: data.loggedEmail || 'Sistema'
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
