import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  collection,
  getDocs,
  query,
  where,
  increment
} from '$lib/firebase';

export interface CacheLookupItem {
  id: string;
  name: string;
}

/**
 * CacheLookupService
 * Scalable Chunked & Sharded Cache Lookup Service for the application.
 * 
 * Features:
 * 1. Multi-entity support ('clients', 'interventions', 'tickets', etc.)
 * 2. Automatic Chunking (Max 200 items per chunk document, ~10KB) preventing 1MB Firestore limit.
 * 3. Fast reads via `type` query & targeted single-chunk updates.
 */
export class CacheLookupService {
  private static CACHE_COLLECTION = 'system_cache';
  public static MAX_ITEMS_PER_CHUNK = 200;

  /**
   * Fetches lightweight lookup map for ANY entity type ('clients', 'tickets', etc.).
   */
  static async getLookup(type: string): Promise<CacheLookupItem[]> {
    if (!type) return [];
    try {
      const cacheQuery = query(
        collection(db, this.CACHE_COLLECTION),
        where('type', '==', type)
      );
      const snap = await getDocs(cacheQuery);

      if (!snap.empty) {
        const result: CacheLookupItem[] = [];
        snap.docs.forEach((d) => {
          const items = d.data().items || {};
          Object.entries(items).forEach(([id, name]) => {
            result.push({ id, name: String(name) });
          });
        });
        return result;
      }

      // If no chunks exist for this type, perform 1-time fallback build from main collection
      return await this.rebuildCacheForType(type);
    } catch (err) {
      console.warn(`[CacheLookupService] Error reading lookup cache for type "${type}":`, err);
      return [];
    }
  }

  /**
   * Backward-compatible helper for clients lookup.
   */
  static async getClientsLookup(): Promise<CacheLookupItem[]> {
    return this.getLookup('clients');
  }

  /**
   * Updates or removes an entry in the chunked cache system.
   * Returns the chunkId where the item is stored.
   */
  static async updateEntityCache(
    type: string,
    id: string,
    name?: string,
    isDelete = false,
    existingChunkId?: string
  ): Promise<string | null> {
    if (!type || !id) return null;

    try {
      // 1. DELETE OPERATION
      if (isDelete) {
        if (existingChunkId) {
          const chunkRef = doc(db, this.CACHE_COLLECTION, existingChunkId);
          await updateDoc(chunkRef, {
            [`items.${id}`]: deleteField(),
            count: increment(-1)
          });
          return null;
        }

        // Search chunk containing this ID if existingChunkId wasn't passed
        const cacheQuery = query(
          collection(db, this.CACHE_COLLECTION),
          where('type', '==', type)
        );
        const snap = await getDocs(cacheQuery);
        for (const chunkDoc of snap.docs) {
          const items = chunkDoc.data().items || {};
          if (id in items) {
            await updateDoc(chunkDoc.ref, {
              [`items.${id}`]: deleteField(),
              count: increment(-1)
            });
            break;
          }
        }
        return null;
      }

      // 2. UPDATE / INSERT OPERATION
      if (!name) return null;

      // If existingChunkId is specified, update directly in that chunk
      if (existingChunkId) {
        const chunkRef = doc(db, this.CACHE_COLLECTION, existingChunkId);
        const chunkSnap = await getDoc(chunkRef);
        if (chunkSnap.exists()) {
          const isNewItem = !(id in (chunkSnap.data().items || {}));
          await updateDoc(chunkRef, {
            [`items.${id}`]: name,
            ...(isNewItem ? { count: increment(1) } : {})
          });
          return existingChunkId;
        }
      }

      // Find an existing chunk for 'type' with available space (< MAX_ITEMS_PER_CHUNK)
      const cacheQuery = query(
        collection(db, this.CACHE_COLLECTION),
        where('type', '==', type)
      );
      const snap = await getDocs(cacheQuery);

      let targetChunkDocId: string | null = null;
      let nextIndex = 0;

      for (const chunkDoc of snap.docs) {
        const data = chunkDoc.data();
        const items = data.items || {};
        const count = data.count ?? Object.keys(items).length;
        const cIndex = data.chunkIndex ?? 0;
        if (cIndex >= nextIndex) {
          nextIndex = cIndex + 1;
        }

        // Check if item already exists in this chunk
        if (id in items) {
          await updateDoc(chunkDoc.ref, {
            [`items.${id}`]: name
          });
          return chunkDoc.id;
        }

        // If chunk has space, select it
        if (!targetChunkDocId && count < this.MAX_ITEMS_PER_CHUNK) {
          targetChunkDocId = chunkDoc.id;
        }
      }

      // If an existing chunk with space was found, add item to it
      if (targetChunkDocId) {
        const chunkRef = doc(db, this.CACHE_COLLECTION, targetChunkDocId);
        await updateDoc(chunkRef, {
          [`items.${id}`]: name,
          count: increment(1)
        });
        return targetChunkDocId;
      }

      // Otherwise, create a new chunk document: `${type}_chunk_${nextIndex}`
      const newChunkId = `${type}_chunk_${nextIndex}`;
      const newChunkRef = doc(db, this.CACHE_COLLECTION, newChunkId);
      await setDoc(newChunkRef, {
        type,
        chunkIndex: nextIndex,
        count: 1,
        createdAt: Date.now(),
        items: { [id]: name }
      });
      return newChunkId;
    } catch (err) {
      console.warn(`[CacheLookupService] Error updating cache for entity "${id}" in type "${type}":`, err);
      return null;
    }
  }

  /**
   * Removes an entity from the chunked cache system.
   */
  static async removeEntityFromCache(type: string, id: string, existingChunkId?: string): Promise<void> {
    await this.updateEntityCache(type, id, undefined, true, existingChunkId);
  }

  /**
   * Backward-compatible update helper for clients.
   */
  static async updateClientCache(
    id: string,
    name?: string,
    isDelete = false,
    existingChunkId?: string
  ): Promise<string | null> {
    return this.updateEntityCache('clients', id, name, isDelete, existingChunkId);
  }

  /**
   * Rebuilds cache chunks from scratch for a given collection.
   */
  public static async rebuildCacheForType(type: string): Promise<CacheLookupItem[]> {
    const snap = await getDocs(collection(db, type));
    const resultList: CacheLookupItem[] = [];

    if (snap.empty) return resultList;

    let currentChunkIndex = 0;
    let currentChunkItems: Record<string, string> = {};
    let currentChunkCount = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const orig = data.original || data;
      const name =
        (orig.nome && orig.cognome ? `${orig.nome} ${orig.cognome}`.trim() : null) ||
        orig.ragioneSociale ||
        orig.companyName ||
        orig.nome ||
        orig.cognome ||
        orig.title ||
        orig.subject ||
        orig.contractNumber ||
        orig.plate ||
        orig.name ||
        orig.displayName ||
        orig.email ||
        `${type} ${d.id}`;

      resultList.push({ id: d.id, name });
      currentChunkItems[d.id] = name;
      currentChunkCount++;

      if (currentChunkCount >= this.MAX_ITEMS_PER_CHUNK) {
        const chunkId = `${type}_chunk_${currentChunkIndex}`;
        await setDoc(doc(db, this.CACHE_COLLECTION, chunkId), {
          type,
          chunkIndex: currentChunkIndex,
          count: currentChunkCount,
          createdAt: Date.now(),
          items: currentChunkItems
        });
        currentChunkIndex++;
        currentChunkItems = {};
        currentChunkCount = 0;
      }
    }

    if (currentChunkCount > 0) {
      const chunkId = `${type}_chunk_${currentChunkIndex}`;
      await setDoc(doc(db, this.CACHE_COLLECTION, chunkId), {
        type,
        chunkIndex: currentChunkIndex,
        count: currentChunkCount,
        createdAt: Date.now(),
        items: currentChunkItems
      });
    }

    return resultList;
  }
}
