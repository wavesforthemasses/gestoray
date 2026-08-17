import { writable } from 'svelte/store';
import { SettingsService } from '$lib/services/settingsService';

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
  unsubscribe = SettingsService.subscribeToProjectConfig((data: any) => {
    if (data) {
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
  });
}

export function destroyProjectStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
