import { db, collection, getDocs, doc, setDoc, query, orderBy, limit, serverTimestamp } from '$lib/firebase';

export interface TagItem {
  id: string;
  name: string;
  normalized: string;
  usageCount: number;
  color?: string;
}

export class TagsService {
  private static COLLECTION_NAME = 'system_tags';

  /**
   * Normalizza il nome del tag per ricerche e confronti case-insensitive (es. "#Urgent" -> "urgent")
   */
  static normalizeTag(tag: string): string {
    return tag.replace(/^#/, '').trim().toLowerCase();
  }

  /**
   * Recupera la lista di tutti i tag registrati nel sistema ordinati per utilizzo ed ordine alfabetico
   */
  static async getTags(): Promise<TagItem[]> {
    try {
      let snap;
      try {
        const q = query(collection(db, this.COLLECTION_NAME), orderBy('name', 'asc'), limit(200));
        snap = await getDocs(q);
      } catch (err) {
        snap = await getDocs(query(collection(db, this.COLLECTION_NAME), limit(200)));
      }
      if (snap.empty) {
        snap = await getDocs(query(collection(db, this.COLLECTION_NAME), limit(200)));
      }
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TagItem));
    } catch (err) {
      console.warn('[TagsService] Impossibile caricare i tag di sistema:', err);
      return [];
    }
  }

  /**
   * Garantisce che un insieme di tag esista nella collezione globale system_tags
   */
  static async ensureTagsExist(tagNames: string[]): Promise<void> {
    if (!tagNames || tagNames.length === 0) return;

    for (const rawName of tagNames) {
      const cleanName = rawName.replace(/^#/, '').trim();
      const norm = this.normalizeTag(cleanName);
      if (!norm) continue;

      try {
        const tagRef = doc(db, this.COLLECTION_NAME, norm);
        await setDoc(tagRef, {
          id: norm,
          name: cleanName,
          normalized: norm,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn(`[TagsService] Errore salvataggio tag "${cleanName}":`, err);
      }
    }
  }
}
