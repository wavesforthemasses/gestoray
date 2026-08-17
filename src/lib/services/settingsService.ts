import { db, doc, getDoc, setDoc, onSnapshot } from '$lib/firebase';
import type { MenuItemConfig } from '$lib/stores/menu';

export class SettingsService {
  // Menu
  static async getMenuConfig(): Promise<{ list: MenuItemConfig[] } | null> {
    const docSnap = await getDoc(doc(db, 'settings', 'menu'));
    if (docSnap.exists()) {
      return docSnap.data() as { list: MenuItemConfig[] };
    }
    return null;
  }

  static async saveMenuConfig(list: MenuItemConfig[]): Promise<void> {
    await setDoc(doc(db, 'settings', 'menu'), { list }, { merge: true });
  }

  static subscribeToMenuConfig(callback: (list: MenuItemConfig[] | null) => void): () => void {
    return onSnapshot(doc(db, 'settings', 'menu'), (snap) => {
      if (snap.exists()) {
        callback((snap.data() as { list: MenuItemConfig[] }).list);
      } else {
        callback(null);
      }
    });
  }

  static subscribeToModuleSettings(moduleId: string, callback: (settings: any) => void): () => void {
    return onSnapshot(doc(db, 'settings', moduleId), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  }

  // Theme
  static async getThemeConfig(): Promise<any> {
    const docSnap = await getDoc(doc(db, 'settings', 'theme'));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  }

  static async saveThemeConfig(themeData: any): Promise<void> {
    await setDoc(doc(db, 'settings', 'theme'), themeData, { merge: true });
  }

  // Project
  static async getProjectConfig(): Promise<any> {
    const docSnap = await getDoc(doc(db, 'settings', 'project'));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  }

  static async saveProjectConfig(projectData: any): Promise<void> {
    await setDoc(doc(db, 'settings', 'project'), projectData, { merge: true });
  }

  static subscribeToProjectConfig(callback: (projectData: any | null) => void): () => void {
    return onSnapshot(doc(db, 'settings', 'project'), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  }
}
