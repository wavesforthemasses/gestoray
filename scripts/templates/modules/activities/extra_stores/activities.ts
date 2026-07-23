import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';

export interface ActivityConfig {
  id: string;
  name: string;
  acronym: string;
  icon: string;
  hasNotes: boolean;
  hasCalendar: boolean;
  rolesInsert: string[];
  rolesView: string[];
}

export const DEFAULT_ACTIVITIES: ActivityConfig[] = [
  { id: 'Telefonata', name: 'Telefonata', acronym: 'TF', icon: 'Phone', hasNotes: true, hasCalendar: false, rolesInsert: ['commerciale', 'amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'Incontro', name: 'Incontro', acronym: 'IF', icon: 'Users', hasNotes: true, hasCalendar: false, rolesInsert: ['commerciale', 'amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'Appuntamento', name: 'Appuntamento', acronym: 'AF', icon: 'Calendar', hasNotes: true, hasCalendar: true, rolesInsert: ['commerciale', 'amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'Sollecito Telefonico', name: 'Sollecito Telefonico', acronym: 'ST', icon: 'Phone', hasNotes: true, hasCalendar: false, rolesInsert: ['amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'Sollecito Email', name: 'Sollecito Email', acronym: 'SE', icon: 'MessageSquare', hasNotes: true, hasCalendar: false, rolesInsert: ['amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'Sollecito PEC', name: 'Sollecito PEC', acronym: 'SP', icon: 'FileText', hasNotes: true, hasCalendar: false, rolesInsert: ['amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] }
];

export const activitiesConfigStore = writable<ActivityConfig[]>([]);

let unsubscribe: (() => void) | null = null;

export function initActivitiesStore() {
  if (unsubscribe) return;
  const docRef = doc(db, 'settings', 'activities');
  unsubscribe = onSnapshot(docRef, (snap: any) => {
    if (snap.exists()) {
      const data = snap.data();
      activitiesConfigStore.set(data.list || []);
    } else {
      activitiesConfigStore.set([]);
    }
  });
}

export function destroyActivitiesStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
