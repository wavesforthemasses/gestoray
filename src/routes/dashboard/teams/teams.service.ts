import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from '$lib/firebase';
import type { TeamItem } from './schema';
import { TeamSettingsService } from './teamSettingsService';

export class TeamsService {
  private static COLLECTION_NAME = 'teams';

  static async getTeams(): Promise<TeamItem[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamItem));
    } catch (e) {
      console.error('Errore durante la lettura delle squadre:', e);
      throw e;
    }
  }

  static async getTeamById(id: string): Promise<TeamItem | null> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as TeamItem;
      }
      return null;
    } catch (e) {
      console.error(`Errore durante il recupero della squadra ${id}:`, e);
      throw e;
    }
  }

  static async createTeam(teamData: Omit<TeamItem, 'id' | 'code' | 'createdAt'>): Promise<string> {
    try {
      const { code, updatedSettings } = await TeamSettingsService.generateNextCode();
      const payload = {
        ...teamData,
        code,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);
      await TeamSettingsService.saveSettings(updatedSettings);
      return docRef.id;
    } catch (e) {
      console.error('Errore durante la creazione della squadra:', e);
      throw e;
    }
  }

  static async updateTeam(id: string, updates: Partial<TeamItem>): Promise<void> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(ref, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Errore durante l'aggiornamento della squadra ${id}:`, e);
      throw e;
    }
  }

  static async deleteTeam(id: string): Promise<void> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(ref);
    } catch (e) {
      console.error(`Errore durante l'eliminazione della squadra ${id}:`, e);
      throw e;
    }
  }
}
