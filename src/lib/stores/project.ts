import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';

export interface ProjectSettings {
  projectName: string;
  projectEmail: string;
}

export const projectStore = writable<ProjectSettings | null>(null);

let unsubscribe: (() => void) | null = null;

export function initProjectStore() {
  if (unsubscribe) return;
  const docRef = doc(db, 'settings', 'project');
  unsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      projectStore.set({
        projectName: data.projectName || '',
        projectEmail: data.projectEmail || ''
      });
    } else {
      projectStore.set({ projectName: '', projectEmail: '' });
    }
  }, (err) => {
    console.error('Error fetching project settings:', err);
  });
}

export function destroyProjectStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
