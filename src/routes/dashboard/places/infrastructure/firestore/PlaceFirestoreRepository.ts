import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  runTransaction,
  type Firestore,
  type DocumentReference
} from 'firebase/firestore';
import { db as defaultDb } from '$lib/firebase';
import type { PlaceDocument } from '../../domain/models/place';
import {
  normalizeLegacyPlace,
  calculateGeohash,
  get9CellGeohashNeighbors,
  haversineDistanceMeters
} from '../../domain/services/placeUtils';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { cleanUndefined, generateId } from '$lib/utils/helpers';
import { computeDiff } from '$lib/services/versioningService';
import { PlacesVersioningBridge } from '../../places.versioning.bridge';


export interface PlaceQueryFilters {
  status?: string;
  type?: string;
  clientId?: string;
  search?: string;
  includeDeleted?: boolean;
}

export class PlaceFirestoreRepository {
  private db: Firestore;
  private collectionName = 'places';

  constructor(dbInstance?: Firestore) {
    this.db = dbInstance || defaultDb;
  }

  private getPlacesCollection() {
    return collection(this.db, this.collectionName);
  }

  private getUniqueKeysCollection(orgId: string) {
    return collection(this.db, 'unique_keys');
  }

  /**
   * Reparenting sicuro: previene cicli infiniti e gestisce la cascata ad albero a blocchi di 450 ops
   */
  async updatePlaceParentWithCascade(
    orgId: string,
    targetPlaceId: string,
    newParentId: string | null
  ): Promise<void> {
    // 1. Guardia di auto-referenzialità
    if (targetPlaceId === newParentId) {
      throw new Error('Un luogo non può essere genitore di se stesso.');
    }

    const placesCol = this.getPlacesCollection();

    // 2. Recupera tutti i discendenti attuali
    const descendantsQuery = query(placesCol, where('ancestors', 'array-contains', targetPlaceId));
    const descendantsSnap = await getDocs(descendantsQuery);
    const descendantIds = descendantsSnap.docs.map(d => d.id);

    // 3. Cycle Detection: il nuovo genitore non può essere un discendente del nodo target
    if (newParentId && descendantIds.includes(newParentId)) {
      throw new Error('Riferimento circolare rilevato: impossibile spostare un elemento sotto un proprio discendente.');
    }

    // 4. Risoluzione nuovi antenati
    let newAncestors: string[] = [];
    let newDepth = 0;

    if (newParentId) {
      const parentSnap = await getDoc(doc(placesCol, newParentId));
      if (!parentSnap.exists()) {
        throw new Error('Nuovo genitore non trovato.');
      }
      const parentData = normalizeLegacyPlace({ id: parentSnap.id, ...parentSnap.data() }, orgId);
      newAncestors = [...parentData.ancestors, newParentId];
      newDepth = parentData.depth + 1;
    }

    // 5. Preparazione operazioni
    const targetDocRef = doc(placesCol, targetPlaceId);
    const operations: Array<{ ref: DocumentReference; data: Partial<PlaceDocument> }> = [
      {
        ref: targetDocRef,
        data: {
          parentId: newParentId,
          ancestors: newAncestors,
          depth: newDepth,
          updatedAt: new Date().toISOString()
        }
      }
    ];

    for (const descendantDoc of descendantsSnap.docs) {
      const descendant = normalizeLegacyPlace({ id: descendantDoc.id, ...descendantDoc.data() }, orgId);
      const splitIndex = descendant.ancestors.indexOf(targetPlaceId);
      const subPath = descendant.ancestors.slice(splitIndex);
      const updatedAncestors = [...newAncestors, ...subPath];

      operations.push({
        ref: descendantDoc.ref,
        data: {
          ancestors: updatedAncestors,
          depth: updatedAncestors.length,
          updatedAt: new Date().toISOString()
        }
      });
    }

    // 6. Esegui commit a blocchi di 450 documenti (rispetta il limite Firestore di 500)
    const CHUNK_SIZE = 450;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const batch = writeBatch(this.db);
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      chunk.forEach(op => batch.update(op.ref, op.data));
      await batch.commit();
    }
  }

  /**
   * Salva o aggiorna un Place gestendo atomicità e rilascio/acquisizione lock codice
   */
  async savePlaceWithUniqueCodeLock(
    orgId: string,
    placeData: Partial<PlaceDocument>,
    existingPlaceId?: string,
    oldCode?: string
  ): Promise<string> {
    return await runTransaction(this.db, async (tx) => {
      const placesCol = this.getPlacesCollection();
      const placeId = existingPlaceId || doc(placesCol).id;
      const placeRef = doc(this.db, this.collectionName, placeId);

      const newCode = placeData.code?.trim().toLowerCase();
      const normalizedOldCode = oldCode?.trim().toLowerCase();

      // 1. Lock sul nuovo codice
      if (newCode && newCode !== normalizedOldCode) {
        const lockKey = `${orgId}_code_${newCode}`;
        const newLockRef = doc(this.db, 'unique_keys', lockKey);
        const newLockSnap = await tx.get(newLockRef);
        if (newLockSnap.exists() && newLockSnap.data()?.placeId !== placeId) {
          throw new Error(`Il codice "${placeData.code}" è già utilizzato in questa organizzazione.`);
        }
        tx.set(newLockRef, { 
          placeId, 
          code: placeData.code,
          orgId,
          createdAt: new Date().toISOString() 
        });
      }

      // 2. Rilascio vecchio lock se il codice è stato sostituito
      if (normalizedOldCode && normalizedOldCode !== newCode) {
        const oldLockKey = `${orgId}_code_${normalizedOldCode}`;
        const oldLockRef = doc(this.db, 'unique_keys', oldLockKey);
        tx.delete(oldLockRef);
      }

      // 3. Generazione termini di ricerca
      const searchTerms = generateSearchTerms(
        placeData.code || '',
        placeData.name || '',
        placeData.summary?.shortAddress || '',
        placeData.address?.city || '',
        placeData.address?.street || '',
        placeData.clientName || '',
        ...(placeData.tags || [])
      );

      const now = new Date().toISOString();
      const existingPlaceSnap = existingPlaceId ? await tx.get(placeRef) : null;
      const currentVersion = (existingPlaceSnap?.data()?.edits?.aggregateVersion as number) ?? 0;
      const nextVersion = currentVersion + 1;
      const ledgerId = generateId('ledger');
      const ledgerRef = doc(this.db, 'system_ledger', ledgerId);

      const entityEdits = {
        ...(placeData.edits || {}),
        ...(existingPlaceSnap?.data()?.edits || {}),
        createdAt: existingPlaceSnap?.data()?.edits?.createdAt || placeData.edits?.createdAt || now,
        createdBy: existingPlaceSnap?.data()?.edits?.createdBy || placeData.edits?.createdBy || 'system',
        modifiedAt: now,
        aggregateVersion: nextVersion,
        lastLedgerId: ledgerId
      };

      const payload = cleanUndefined({
        ...placeData,
        id: placeId,
        orgId: placeData.orgId || orgId,
        updatedAt: now,
        edits: entityEdits,
        derived: {
          ...(placeData.derived || {}),
          textSearch: searchTerms,
          deleted: false
        }
      });

      if (existingPlaceId) {
        tx.update(placeRef, payload);
      } else {
        tx.set(placeRef, {
          ...payload,
          createdAt: placeData.createdAt || now
        });
      }

      const diff = computeDiff(existingPlaceSnap && existingPlaceSnap.exists() ? existingPlaceSnap.data() : null, payload, {
        semanticsMap: PlacesVersioningBridge.getSemanticsMap()
      });

      tx.set(ledgerRef, {
        id: ledgerId,
        tenantId: orgId || 'default',
        module: 'places',
        entityType: 'place',
        entityId: placeId,
        entityLabel: PlacesVersioningBridge.getEntityLabel(payload),
        aggregateVersion: nextVersion,
        eventType: 'FIELD_MUTATION',
        keysChanged: diff.keysChanged,
        mutations: diff.mutations,
        performedBy: 'system',
        actorType: 'USER',
        timestamp: new Date(),
        reason: existingPlaceId ? 'Aggiornamento scheda luogo' : 'Creazione scheda luogo'
      });

      return placeId;
    });
  }

  /**
   * Elimina un Place e rilascia automaticamente il relativo lock sul codice
   */
  async deletePlaceWithLockRelease(
    orgId: string,
    placeId: string,
    softDelete = true,
    deletedByUid?: string
  ): Promise<void> {
    await runTransaction(this.db, async (tx) => {
      const placeRef = doc(this.db, this.collectionName, placeId);
      const placeSnap = await tx.get(placeRef);

      if (!placeSnap.exists()) {
        return; // Idempotenza
      }

      const placeData = normalizeLegacyPlace({ id: placeSnap.id, ...placeSnap.data() }, orgId);

      // Rilascia automaticamente il lock del codice se presente
      if (placeData.code) {
        const lockKey = `${orgId}_code_${placeData.code.trim().toLowerCase()}`;
        const lockRef = doc(this.db, 'unique_keys', lockKey);
        tx.delete(lockRef);
      }

      if (softDelete) {
        const currentVersion = (placeSnap.data()?.edits?.aggregateVersion as number) ?? 0;
        const nextVersion = currentVersion + 1;
        const ledgerId = generateId('ledger');
        const ledgerRef = doc(this.db, 'system_ledger', ledgerId);

        tx.update(placeRef, {
          'derived.deleted': true,
          'edits.deletedAt': new Date().toISOString(),
          'edits.deletedBy': deletedByUid || 'system',
          'edits.aggregateVersion': nextVersion,
          'edits.lastLedgerId': ledgerId,
          updatedAt: new Date().toISOString()
        });

        tx.set(ledgerRef, {
          id: ledgerId,
          tenantId: orgId || 'default',
          module: 'places',
          entityType: 'place',
          entityId: placeId,
          entityLabel: PlacesVersioningBridge.getEntityLabel(placeData),
          aggregateVersion: nextVersion,
          eventType: 'STATUS_CHANGE',
          keysChanged: ['derived.deleted'],
          mutations: {
            'derived.deleted': {
              old: false,
              new: true,
              semantics: 'DESCRIPTIVE'
            }
          },
          performedBy: deletedByUid || 'system',
          actorType: 'USER',
          timestamp: new Date(),
          reason: 'Cancellazione logica luogo'
        });
      } else {
        tx.delete(placeRef);
      }
    });

    try {
      await CacheLookupService.removeEntityFromCache('places', placeId);
    } catch (e) {
      console.warn('Errore rimozione cache luogo:', e);
    }
  }

  /**
   * Recupera tutti i luoghi con supporto per filtri e normalizzazione trasparente
   */
  async fetchPlaces(orgId: string, filters?: PlaceQueryFilters): Promise<PlaceDocument[]> {
    try {
      const placesCol = this.getPlacesCollection();
      let snap;

      if (filters?.clientId) {
        try {
          snap = await getDocs(query(placesCol, where('clientId', '==', filters.clientId)));
        } catch {
          snap = await getDocs(placesCol);
        }
      } else {
        try {
          snap = await getDocs(query(placesCol, orderBy('createdAt', 'desc')));
        } catch {
          snap = await getDocs(placesCol);
        }
      }

      const places: PlaceDocument[] = [];
      snap.forEach(docSnap => {
        const raw = docSnap.data();
        if (!filters?.includeDeleted && (raw?.derived?.deleted || raw?.deleted)) {
          return;
        }
        const docObj = normalizeLegacyPlace({ id: docSnap.id, ...raw }, orgId);

        // Filtro stato
        if (filters?.status && filters.status !== 'all') {
          if (docObj.status !== filters.status && (docObj as any).status !== filters.status) {
            // Check legacy map
            const legacyMatches = 
              (filters.status === 'active' && docObj.status === 'attivo') ||
              (filters.status === 'attivo' && docObj.status === 'active') ||
              (filters.status === 'archived' && docObj.status === 'inattivo') ||
              (filters.status === 'inattivo' && docObj.status === 'archived');
            if (!legacyMatches) return;
          }
        }

        // Filtro tipo
        if (filters?.type && filters.type !== 'all') {
          if (!docObj.types.includes(filters.type as any)) return;
        }

        // Filtro ricerca testuale
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          const match =
            docObj.name.toLowerCase().includes(s) ||
            (docObj.code && docObj.code.toLowerCase().includes(s)) ||
            (docObj.address.city && docObj.address.city.toLowerCase().includes(s)) ||
            (docObj.clientName && docObj.clientName.toLowerCase().includes(s));
          if (!match) return;
        }

        places.push(docObj);
      });

      return places.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (e) {
      console.error('Errore fetchPlaces:', e);
      return [];
    }
  }

  /**
   * Recupera un singolo luogo per ID
   */
  async fetchPlaceById(orgId: string, placeId: string): Promise<PlaceDocument | null> {
    try {
      const placeRef = doc(this.db, this.collectionName, placeId);
      const snap = await getDoc(placeRef);
      if (!snap.exists()) return null;
      const raw = snap.data();
      if (raw?.derived?.deleted || raw?.deleted) return null;
      return normalizeLegacyPlace({ id: snap.id, ...raw }, orgId);
    } catch (e) {
      console.error('Errore fetchPlaceById:', e);
      return null;
    }
  }

  /**
   * Query di prossimità con 9-cell geohash bounding box e filtro Haversine
   */
  async fetchNearbyPlaces(
    orgId: string,
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ): Promise<Array<{ place: PlaceDocument; distanceMeters: number }>> {
    const centerGeohash = calculateGeohash(centerLat, centerLng, 6);
    const cells = get9CellGeohashNeighbors(centerGeohash);

    const allPlaces = await this.fetchPlaces(orgId);
    const results: Array<{ place: PlaceDocument; distanceMeters: number }> = [];

    for (const place of allPlaces) {
      if (!place.geo?.location) continue;
      const pLat = (place.geo.location as any).latitude ?? (place.geo.location as any).lat;
      const pLng = (place.geo.location as any).longitude ?? (place.geo.location as any).lng;
      if (typeof pLat !== 'number' || typeof pLng !== 'number') continue;

      const dist = haversineDistanceMeters(centerLat, centerLng, pLat, pLng);
      if (dist <= radiusMeters) {
        results.push({ place, distanceMeters: dist });
      }
    }

    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
