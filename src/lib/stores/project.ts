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
      projectStore.update(curr => curr || { projectName: 'CRM', projectEmail: 'admin@app.local' });
    }
  }, (err: any) => {
    console.warn('Error fetching project settings (offline/HMR):', err);
    projectStore.update(curr => curr || { projectName: 'CRM', projectEmail: 'admin@app.local' });
  });
}

export function destroyProjectStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
