import { db, collectionGroup, getDocs, query, limit, startAfter, orderBy, where } from '$lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

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

export interface ActivityFetchResult {
  list: ActivityItem[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export class ActivitiesService {
  static async fetchActivities(
    itemsPerPage: number = 50,
    lastVisible: QueryDocumentSnapshot | null = null,
    searchQuery: string = '',
    filterType: string = 'all',
    loggedByFilter?: string
  ): Promise<ActivityFetchResult> {
    
    let q: any = collectionGroup(db, 'activities');

    if (filterType && filterType !== 'all') {
      q = query(q, where('original.type', '==', filterType));
    }
    
    if (loggedByFilter) {
      q = query(q, where('original.loggedBy', '==', loggedByFilter));
    }

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      q = query(q, where('derived.textSearch', 'array-contains', qLower));
    }

    // We must orderBy edits.createdAt desc
    q = query(q, orderBy('edits.createdAt', 'desc'));

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    q = query(q, limit(itemsPerPage));

    const querySnapshot = await getDocs(q);
    const list: ActivityItem[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const payload = doc.data();
      const data = payload.original || payload; 
      
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

    const hasMore = querySnapshot.docs.length === itemsPerPage;
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return { list, lastDoc: newLastDoc, hasMore };
  }
}
