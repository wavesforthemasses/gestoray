import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, orderBy, where, runTransaction } from '$lib/firebase';
import type { TeamItem, TeamMember } from './schema';
import { TeamSettingsService } from './teamSettingsService';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { cleanUndefined } from '$lib/utils/helpers';

export class TeamsService {
  private static COLLECTION_NAME = 'teams';

  static async getTeams(): Promise<TeamItem[]> {
    try {
      let snap;
      try {
        const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
        snap = await getDocs(q);
      } catch (e) {
        snap = await getDocs(collection(db, this.COLLECTION_NAME));
      }
      if (snap.empty) {
        snap = await getDocs(collection(db, this.COLLECTION_NAME));
      }
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamItem));
      list.sort((a, b) => {
        const dA = a.createdAt || '';
        const dB = b.createdAt || '';
        return dB.localeCompare(dA);
      });
      return list;
    } catch (e) {
      console.error('[TeamsService] Errore durante la lettura delle squadre:', e);
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
      console.error(`[TeamsService] Errore durante il recupero della squadra ${id}:`, e);
      throw e;
    }
  }

  /**
   * Restituisce tutti i team in cui l'utente figura come membro o come leader.
   */
  static async getTeamsForUser(userId: string): Promise<TeamItem[]> {
    try {
      const allTeams = await this.getTeams();
      return allTeams.filter(t => 
        t.status === 'attiva' && 
        (t.leaderId === userId || (Array.isArray(t.members) && t.members.some(m => m.userId === userId)))
      );
    } catch (e) {
      console.warn('[TeamsService] Errore recupero team per utente:', e);
      return [];
    }
  }

  static async createTeam(
    teamData: Omit<TeamItem, 'id' | 'code' | 'createdAt'>,
    author?: { uid: string; displayName?: string }
  ): Promise<string> {
    try {
      const { code, updatedSettings } = await TeamSettingsService.generateNextCode();
      const nowIso = new Date().toISOString();
      const payload: Partial<TeamItem> = cleanUndefined({
        ...teamData,
        code,
        createdAt: nowIso,
        updatedAt: nowIso,
        edits: {
          createdAt: nowIso,
          createdBy: author?.uid || 'system'
        }
      });
      
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);
      await TeamSettingsService.saveSettings(updatedSettings);

      try {
        await CacheLookupService.updateEntityCache('teams', docRef.id, payload.name || code);
      } catch (e) {
        // Non-blocking
      }

      return docRef.id;
    } catch (e) {
      console.error('[TeamsService] Errore durante la creazione della squadra:', e);
      throw e;
    }
  }

  static async updateTeam(
    id: string, 
    updates: Partial<TeamItem>,
    author?: { uid: string; displayName?: string }
  ): Promise<void> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      const nowIso = new Date().toISOString();
      const payload = cleanUndefined({
        ...updates,
        updatedAt: nowIso,
        ...(author ? { 'edits.modifiedAt': nowIso, 'edits.modifiedBy': author.uid } : {})
      });
      
      await updateDoc(ref, payload);

      if (updates.name) {
        try {
          await CacheLookupService.updateEntityCache('teams', id, updates.name);
        } catch (e) {
          // Non-blocking
        }
      }
    } catch (e) {
      console.error(`[TeamsService] Errore durante l'aggiornamento della squadra ${id}:`, e);
      throw e;
    }
  }

  static async deleteTeam(id: string): Promise<void> {
    try {
      const ref = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(ref);
      try {
        await CacheLookupService.deleteEntityFromCache('teams', id);
      } catch (e) {
        // Non-blocking
      }
    } catch (e) {
      console.error(`[TeamsService] Errore durante l'eliminazione della squadra ${id}:`, e);
      throw e;
    }
  }

  /**
   * Sposta atomicamente un membro da una squadra sorgente a una squadra target.
   */
  static async reassignMember(
    member: TeamMember,
    sourceTeamId: string | null,
    targetTeamId: string | null,
    author?: { uid: string; displayName?: string }
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const nowIso = new Date().toISOString();

      // 1. Rimuovi dalla squadra sorgente
      if (sourceTeamId) {
        const srcRef = doc(db, this.COLLECTION_NAME, sourceTeamId);
        const srcSnap = await transaction.get(srcRef);
        if (srcSnap.exists()) {
          const srcData = srcSnap.data() as TeamItem;
          const updatedMembers = (srcData.members || []).filter(m => m.userId !== member.userId);
          const updates: any = {
            members: updatedMembers,
            updatedAt: nowIso
          };
          if (srcData.leaderId === member.userId) {
            updates.leaderId = null;
            updates.leaderName = null;
          }
          transaction.update(srcRef, cleanUndefined(updates));
        }
      }

      // 2. Aggiungi alla squadra target
      if (targetTeamId) {
        const dstRef = doc(db, this.COLLECTION_NAME, targetTeamId);
        const dstSnap = await transaction.get(dstRef);
        if (dstSnap.exists()) {
          const dstData = dstSnap.data() as TeamItem;
          const currentMembers = (dstData.members || []).filter(m => m.userId !== member.userId);
          currentMembers.push({
            ...member,
            joinedAt: nowIso
          });
          const updates: any = {
            members: currentMembers,
            updatedAt: nowIso
          };
          if (member.isLeader) {
            updates.leaderId = member.userId;
            updates.leaderName = member.userName;
          }
          transaction.update(dstRef, cleanUndefined(updates));
        }
      }
    });
  }
}
