import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from '$lib/firebase';
import type { TeamItem } from './schema';

export class TeamsService {
  private static COLLECTION_NAME = 'teams';

  static async getTeams(): Promise<TeamItem[]> {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as TeamItem));
    } catch (e) {
      console.warn('Errore lettura collezioni teams:', e);
      return [];
    }
  }

  static async getTeamById(id: string): Promise<TeamItem | null> {
    const d = await getDoc(doc(db, this.COLLECTION_NAME, id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as TeamItem;
  }

  static async createTeam(team: Partial<TeamItem>): Promise<string> {
    const payload = {
      name: team.name || 'Nuova Squadra',
      leaderUid: team.leaderUid || '',
      memberUids: team.memberUids || [],
      defaultVehicleId: team.defaultVehicleId || '',
      color: team.color || '#3b82f6',
      active: team.active !== undefined ? team.active : true,
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);
    return docRef.id;
  }

  static async updateTeam(id: string, data: Partial<TeamItem>): Promise<void> {
    await updateDoc(doc(db, this.COLLECTION_NAME, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  static async deleteTeam(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }
}
