import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { ScheduleView } from './schema';

export const DEFAULT_SCHEDULE_VIEWS: ScheduleView[] = [
  {
    id: 'view_list_all',
    name: 'Lista Completa',
    icon: 'List',
    layout: 'list',
    filters: {
      sources: ['intervention', 'activity', 'deadline']
    },
    order: 0
  },
  {
    id: 'view_matrix_teams',
    name: 'Calendario Squadre',
    icon: 'Users',
    layout: 'matrix',
    matrixYAxis: 'teams',
    filters: {
      sources: ['intervention', 'activity', 'deadline']
    },
    order: 1
  },
  {
    id: 'view_matrix_users',
    name: 'Calendario Operai',
    icon: 'UserCheck',
    layout: 'matrix',
    matrixYAxis: 'users',
    filters: {
      sources: ['intervention', 'activity', 'deadline']
    },
    order: 2
  }
];

export class ScheduleViewsService {
  private static VIEWS_DOC_REF = doc(db, 'settings', 'scheduling_views');

  static async getViews(): Promise<ScheduleView[]> {
    try {
      const snap = await getDoc(this.VIEWS_DOC_REF);
      if (snap.exists() && snap.data()?.views) {
        const list: ScheduleView[] = snap.data().views;
        return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
    } catch (e) {
      console.warn('Errore lettura viste agenda, uso viste predefinite:', e);
    }
    return DEFAULT_SCHEDULE_VIEWS;
  }

  static async saveViews(views: ScheduleView[]): Promise<void> {
    const sorted = views.map((v, idx) => ({ ...v, order: idx }));
    await setDoc(this.VIEWS_DOC_REF, { views: sorted }, { merge: true });
  }
}
