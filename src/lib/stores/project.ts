import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';

export interface ProjectSettings {
  projectName: string;
  projectEmail: string;
  // Theme
  brandHue?: number;
  brandSaturation?: number;
  brandLightness?: number;
  secondaryHue?: number;
  secondarySaturation?: number;
  secondaryLightness?: number;
  neutralChroma?: number;
}

export const projectStore = writable<ProjectSettings | null>(null);

let unsubscribe: (() => void) | null = null;

export function initProjectStore() {
  if (unsubscribe) return;
  const docRef = doc(db, 'settings', 'project');
  unsubscribe = onSnapshot(docRef, (snap: any) => {
    if (snap.exists()) {
      const data = snap.data();
      projectStore.set({
        projectName: data.projectName || '',
        projectEmail: data.projectEmail || '',
        brandHue: data.brandHue,
        brandSaturation: data.brandSaturation,
        brandLightness: data.brandLightness,
        secondaryHue: data.secondaryHue,
        secondarySaturation: data.secondarySaturation,
        secondaryLightness: data.secondaryLightness,
        neutralChroma: data.neutralChroma
      });
    } else {
      projectStore.set({ projectName: '', projectEmail: '' });
    }
  }, (err: any) => {
    console.warn('Error fetching project settings (offline/HMR):', err);
    // Keep current store state on transient offline socket error
  });
}

export function destroyProjectStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
