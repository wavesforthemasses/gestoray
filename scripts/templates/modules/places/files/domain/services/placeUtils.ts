import type { PlaceAddress, PlaceDocument, PlaceHierarchyNode, PlaceSummary, PlaceType } from '../models/place';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Genera la chiave di deduplicazione canonica dell'indirizzo
 * es. "it|20121|milano|via roma 12"
 */
export function buildNormalizedKey(address: {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): string {
  const country = (address.country || 'IT').trim().toLowerCase();
  const cap = (address.postalCode || '').trim().toLowerCase();
  const city = (address.city || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const street = (address.street || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${country}|${cap}|${city}|${street}`;
}

/**
 * Calcola il Geohash per coordinate geografiche
 */
export function calculateGeohash(latitude: number, longitude: number, precision = 8): string {
  let latMin = -90.0, latMax = 90.0;
  let lonMin = -180.0, lonMax = 180.0;
  let geohash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (isEven) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude >= lonMid) {
        ch |= 1 << (4 - bit);
        lonMin = lonMid;
      } else {
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude >= latMid) {
        ch |= 1 << (4 - bit);
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Decodifica i bounding box min/max di un geohash
 */
function decodeGeohashBbox(geohash: string): { latMin: number; latMax: number; lonMin: number; lonMax: number } {
  let latMin = -90.0, latMax = 90.0;
  let lonMin = -180.0, lonMax = 180.0;
  let isEven = true;

  for (let i = 0; i < geohash.length; i++) {
    const c = geohash[i];
    const cd = BASE32.indexOf(c);
    if (cd === -1) continue;

    for (let j = 4; j >= 0; j--) {
      const mask = 1 << j;
      if (isEven) {
        const lonMid = (lonMin + lonMax) / 2;
        if ((cd & mask) !== 0) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if ((cd & mask) !== 0) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      isEven = !isEven;
    }
  }

  return { latMin, latMax, lonMin, lonMax };
}

/**
 * Risolve i 9 vicini geohash (cella centrale + 8 celle adiacenti)
 * per prevenire l'effetto bordo (Geohash Edge Effect) nelle query di prossimità
 */
export function get9CellGeohashNeighbors(geohash: string): string[] {
  if (!geohash) return [];
  const bbox = decodeGeohashBbox(geohash);
  const latStep = bbox.latMax - bbox.latMin;
  const lonStep = bbox.lonMax - bbox.lonMin;
  const latCenter = (bbox.latMin + bbox.latMax) / 2;
  const lonCenter = (bbox.lonMin + bbox.lonMax) / 2;
  const precision = geohash.length;

  const neighbors = new Set<string>();
  neighbors.add(geohash);

  for (const latOffset of [-latStep, 0, latStep]) {
    for (const lonOffset of [-lonStep, 0, lonStep]) {
      const neighborLat = Math.min(Math.max(latCenter + latOffset, -89.999), 89.999);
      let neighborLon = lonCenter + lonOffset;
      if (neighborLon > 180) neighborLon -= 360;
      if (neighborLon < -180) neighborLon += 360;

      const nHash = calculateGeohash(neighborLat, neighborLon, precision);
      neighbors.add(nHash);
    }
  }

  return Array.from(neighbors);
}

/**
 * Calcola la distanza esatta in metri tra due coordinate geografiche (Haversine Formula)
 */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Raggio medio della terra in metri
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Normalizza e migra in modo trasparente documenti con schema legacy
 */
export function normalizeLegacyPlace(raw: any, defaultOrgId = 'default'): PlaceDocument {
  if (!raw) {
    throw new Error('Impossibile normalizzare un documento vuoto');
  }

  const isLegacyStatus = raw.status === 'attivo' || raw.status === 'inattivo';
  const mappedStatus = isLegacyStatus
    ? (raw.status === 'attivo' ? 'active' : 'archived')
    : (raw.status || 'active');

  const street = raw.address?.street || raw.street || raw.indirizzo || raw.original?.address?.street || raw.original?.street || raw.original?.indirizzo || '';
  const city = raw.address?.city || raw.city || raw.citta || raw.original?.address?.city || raw.original?.city || raw.original?.citta || '';
  const province = raw.address?.province || raw.province || raw.provincia || raw.original?.address?.province || raw.original?.provincia || '';
  const postalCode = raw.address?.postalCode || raw.address?.zip || raw.postalCode || raw.zip || raw.cap || raw.original?.address?.zip || raw.original?.cap || '';
  const country = raw.address?.country || raw.country || raw.original?.address?.country || 'IT';
  const formattedAddress = raw.address?.formattedAddress || 
    (street || city ? `${street ? street + ', ' : ''}${postalCode ? postalCode + ' ' : ''}${city}${province ? ' (' + province + ')' : ''}` : '');

  const normKey = raw.address?.normalizedKey || buildNormalizedKey({ street, city, postalCode, country });

  let geo = raw.geo;
  if (!geo && (raw.lat || raw.latitude) && (raw.lng || raw.longitude)) {
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      geo = {
        location: { latitude: lat, longitude: lng } as any,
        geohash: raw.geohash || calculateGeohash(lat, lng),
        radiusMeters: raw.radiusMeters || 100
      };
    }
  }

  const name = raw.name || raw.nome || raw.original?.name || raw.original?.nome || 'Luogo Senza Nome';
  const parentId = raw.parentId ?? raw.parentPlaceId ?? null;
  const ancestors = Array.isArray(raw.ancestors) ? raw.ancestors : [];
  const depth = typeof raw.depth === 'number' ? raw.depth : ancestors.length;

  const rawTypes = raw.types || (raw.type ? [raw.type] : ['site']);
  const types: PlaceType[] = Array.isArray(rawTypes) && rawTypes.length > 0 ? rawTypes : ['site'];

  const customerId = raw.customerId || raw.clientId || raw.original?.clientId || undefined;
  const clientName = raw.clientName || raw.original?.clientName || undefined;

  return {
    id: raw.id || raw._id || '',
    orgId: raw.orgId || raw.tenantId || defaultOrgId,
    name,
    code: raw.code || raw.codice || raw.original?.code || undefined,
    types,
    status: mappedStatus,
    parentId,
    ancestors,
    depth,
    address: {
      street,
      city,
      province,
      postalCode,
      country,
      formattedAddress,
      normalizedKey: normKey
    },
    geo,
    geocodingStatus: raw.geocodingStatus || (geo ? 'resolved' : 'pending'),
    customerId,
    clientId: customerId,
    clientName,
    supplierId: raw.supplierId || undefined,
    summary: raw.summary || {
      label: name,
      shortAddress: city ? `${street ? street + ', ' : ''}${city}` : (formattedAddress || name)
    },
    contacts: Array.isArray(raw.contacts) ? raw.contacts : (
      raw.contactPerson || raw.phone ? [{
        id: 'legacy-contact',
        name: raw.contactPerson || raw.original?.contactPerson || 'Referente',
        role: 'Referente',
        phone: raw.phone || raw.original?.phone || '',
        email: raw.email || raw.original?.email || '',
        isPrimary: true
      }] : []
    ),
    accessInfo: raw.accessInfo || (raw.notes || raw.original?.notes ? { notes: raw.notes || raw.original?.notes } : undefined),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    metadata: raw.metadata || {},
    createdAt: raw.createdAt || raw.original?.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.original?.updatedAt || new Date().toISOString(),
    syncStatus: 'synced',
    derived: raw.derived,
    original: raw.original,
    edits: raw.edits
  };
}

/**
 * Crea lo snapshot denormalizzato del Luogo
 */
export function buildPlaceSummary(name: string, address?: Partial<PlaceAddress>, parentName?: string): PlaceSummary {
  const label = parentName ? `${parentName} › ${name}` : name;
  const shortAddress = address?.city ? `${address.street ? address.street + ', ' : ''}${address.city}` : (address?.formattedAddress || '');
  return { label, shortAddress };
}

/**
 * Costruisce l'albero gerarchico dei nodi Place
 */
export function buildHierarchyTree(places: PlaceDocument[]): PlaceHierarchyNode[] {
  const nodeMap = new Map<string, PlaceHierarchyNode>();
  const rootNodes: PlaceHierarchyNode[] = [];

  // 1. Crea tutti i nodi
  for (const place of places) {
    nodeMap.set(place.id, { place, children: [] });
  }

  // 2. Collega i nodi
  for (const place of places) {
    const node = nodeMap.get(place.id)!;
    if (place.parentId && nodeMap.has(place.parentId)) {
      nodeMap.get(place.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // 3. Ordina nodi radice e figli per nome
  function sortNodes(nodes: PlaceHierarchyNode[]) {
    nodes.sort((a, b) => a.place.name.localeCompare(b.place.name));
    for (const n of nodes) {
      if (n.children.length > 0) {
        sortNodes(n.children);
      }
    }
  }

  sortNodes(rootNodes);
  return rootNodes;
}
