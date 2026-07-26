import { CacheLookupService, type CacheLookupItem } from '$lib/services/cacheLookupService';
import type { MatchStatus } from '$lib/types/importTypes';

export interface EntityLookupMap {
  idMap: Map<string, string>; // normalizedKey -> documentId
  nameMap: Map<string, string>; // normalizedKey -> originalName
  allEntities: CacheLookupItem[];
}

/**
 * Fast Normalized Entity Resolution Engine ($O(1)$ In-Memory Matching)
 */
export class EntityResolutionService {
  private static lookupCache: Map<string, EntityLookupMap> = new Map();

  /**
   * Normalizes search keys (strips non-alphanumeric, lowercases, trims).
   */
  static cleanKey(input: any): string {
    if (input === null || input === undefined) return '';
    return String(input)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Strip diacritics/accents
      .replace(/[^a-z0-9]/g, ''); // Strip punctuation and spaces
  }

  /**
   * Pre-fetches entity lookups into memory once per import session to eliminate N+1 queries.
   */
  static async prefetchEntityLookup(entityType: string): Promise<EntityLookupMap> {
    const items = await CacheLookupService.getLookup(entityType);
    const idMap = new Map<string, string>();
    const nameMap = new Map<string, string>();

    for (const item of items) {
      const cleanId = this.cleanKey(item.id);
      const cleanName = this.cleanKey(item.name);

      if (cleanId) {
        idMap.set(cleanId, item.id);
        nameMap.set(cleanId, item.name);
      }
      if (cleanName) {
        idMap.set(cleanName, item.id);
        nameMap.set(cleanName, item.name);
      }
    }

    const lookupMap: EntityLookupMap = {
      idMap,
      nameMap,
      allEntities: items
    };

    this.lookupCache.set(entityType, lookupMap);
    return lookupMap;
  }

  /**
   * Attempts to resolve a record identifier against the pre-fetched in-memory lookup map.
   */
  static resolveEntity(
    entityType: string,
    searchValue: string
  ): {
    status: MatchStatus;
    matchedId?: string;
    matchedName?: string;
    candidates: { id: string; name: string }[];
  } {
    const cleanSearch = this.cleanKey(searchValue);
    if (!cleanSearch) {
      return { status: 'UNMATCHED', candidates: [] };
    }

    const lookupMap = this.lookupCache.get(entityType);
    if (!lookupMap) {
      return { status: 'UNMATCHED', candidates: [] };
    }

    // Direct Exact Key Match
    if (lookupMap.idMap.has(cleanSearch)) {
      const matchedId = lookupMap.idMap.get(cleanSearch)!;
      const matchedName = lookupMap.nameMap.get(cleanSearch) || searchValue;
      return {
        status: 'EXACT_MATCH',
        matchedId,
        matchedName,
        candidates: [{ id: matchedId, name: matchedName }]
      };
    }

    // Fuzzy / Candidate Matching
    const candidates: { id: string; name: string }[] = [];
    for (const entity of lookupMap.allEntities) {
      const cleanName = this.cleanKey(entity.name);
      if (cleanName.includes(cleanSearch) || cleanSearch.includes(cleanName)) {
        candidates.push(entity);
      }
      if (candidates.length >= 5) break; // Limit candidate list to top 5
    }

    if (candidates.length === 1) {
      return {
        status: 'EXACT_MATCH',
        matchedId: candidates[0].id,
        matchedName: candidates[0].name,
        candidates
      };
    } else if (candidates.length > 1) {
      return {
        status: 'AMBIGUOUS_MATCH',
        candidates
      };
    }

    return {
      status: 'UNMATCHED',
      candidates: []
    };
  }

  /**
   * Registers a newly reconciled or on-the-fly created entity into the memory lookup cache.
   */
  static registerNewEntity(entityType: string, id: string, name: string): void {
    let lookupMap = this.lookupCache.get(entityType);
    if (!lookupMap) {
      lookupMap = { idMap: new Map(), nameMap: new Map(), allEntities: [] };
      this.lookupCache.set(entityType, lookupMap);
    }

    const cleanId = this.cleanKey(id);
    const cleanName = this.cleanKey(name);

    if (cleanId) {
      lookupMap.idMap.set(cleanId, id);
      lookupMap.nameMap.set(cleanId, name);
    }
    if (cleanName) {
      lookupMap.idMap.set(cleanName, id);
      lookupMap.nameMap.set(cleanName, name);
    }

    lookupMap.allEntities.push({ id, name });
  }
}
