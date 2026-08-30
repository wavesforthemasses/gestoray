import type { GeoPoint } from 'firebase/firestore';

export type PlaceType =
  | 'site'           // Cantiere / Luogo di lavoro / Intervento
  | 'warehouse'      // Magazzino / Deposito / Hub logistico
  | 'headquarters'   // Sede Legale
  | 'branch'         // Sede Operativa / Filiale
  | 'store'          // Punto vendita / Showroom
  | 'delivery_point' // Punto di Consegna / Scarico merci
  | 'client_site'    // Sede Cliente / Impianto
  | 'supplier_site'  // Sede Fornitore / Centro conferimento
  | 'custom';

export type PlaceStatus = 
  | 'active' 
  | 'temporary' 
  | 'completed' 
  | 'archived'
  | 'attivo'    // Legacy fallback
  | 'inattivo'; // Legacy fallback

export type GeocodingStatus = 'pending' | 'resolved' | 'failed' | 'manual';

export interface PlaceAddress {
  street: string;                // es. "Via Roma 12"
  city: string;                  // es. "Milano"
  province?: string;             // es. "MI"
  postalCode?: string;           // es. "20121"
  country: string;               // ISO 3166-1 alpha-2 (default: "IT")
  formattedAddress: string;     // Stringa leggibile completa
  normalizedKey: string;         // es. "it|20121|milano|via roma|12"
  coordinates?: { lat: number; lng: number };
  lat?: number;
  lng?: number;
}

export interface PlaceGeo {
  location: GeoPoint;            // GeoPoint nativo per spatial indexing
  geohash: string;               // Geohash precision 7-9 per bounding box queries
  radiusMeters: number;          // Default: 100 per geofencing e check-in
  coordinates?: {
    latitude: number;
    longitude: number;
    lat?: number;
    lng?: number;
  };
}

export interface PlaceContact {
  id: string;
  name: string;
  role: string;                  // es. "Capocantiere", "Responsabile Scarico"
  phone: string;
  email?: string;
  isPrimary: boolean;
}

export interface PlaceAccessInfo {
  notes?: string;                // Istruzioni citofono / codice cancello
  heavyVehicleAccessible?: boolean;
  openingHours?: Record<string, { open: string; close: string }>;
}

export interface PlaceSummary {
  label: string;                 // es. "Cantiere Milano (Lotto 1)"
  shortAddress: string;          // es. "Via Roma 12, Milano"
}

export interface PlaceDocument {
  id: string;
  orgId: string;                   // Tenant boundary & Security Rules check
  name: string;                    // es. "Cantiere Residenziale Le Palme"
  code?: string;                   // es. "CNT-2025-001" (univoco per org)
  types: PlaceType[];              // Ruoli multipli es. ['headquarters', 'warehouse']
  status: PlaceStatus;

  // 1. Gerarchia ad Albero Opzionale (Materialized Path NoSQL)
  parentId: string | null;         // ID diretto del genitore (null per root)
  ancestors: string[];             // Array ordinato di ID antenati: ['root_id', 'parent_id']
  depth: number;                   // 0 = root, 1 = sotto-area, 2 = corsia/settore

  // 2. Indirizzo Canonico e Chiave di Deduplicazione
  address: PlaceAddress;

  // 3. Geospaziale Opzionale (Firestore Native + Geohash)
  geo?: PlaceGeo;
  geocodingStatus: GeocodingStatus;

  // 4. Relazioni di Dominio Opzionali
  customerId?: string;             // Collegamento opzionale a Cliente
  clientId?: string;               // Alias retrocompatibile
  clientName?: string;             // Denormalized client name for quick search/display
  supplierId?: string;             // Collegamento opzionale a Fornitore

  // 5. Snapshot Denormalizzato Compatto (Zero N+1 reads)
  summary: PlaceSummary;

  // 6. Contatti sul Posto Opzionali
  contacts: PlaceContact[];

  // 7. Accessibilità e Vincoli Operativi Opzionali
  accessInfo?: PlaceAccessInfo;

  tags: string[];
  metadata: Record<string, unknown>;

  createdAt: string;               // ISO 8601 UTC (Immutabile)
  updatedAt: string;               // ISO 8601 UTC
  syncStatus?: 'synced' | 'local_mutation';

  original?: Record<string, any>;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  geofenceRadiusMeters?: number;
  radiusMeters?: number;
  activityId?: string;
  activityName?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
    deleted?: boolean;
    [key: string]: any;
  };
  edits?: Record<string, any>;
}

// Snapshot denormalizzato compatto per Activity / Task / DDT / Ordini
export interface PlaceDenormalizedRef {
  placeId: string;
  name: string;
  formattedAddress: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  geofenceRadiusMeters?: number;
}

// Nodo ad albero per rendering ricorsivo
export interface PlaceHierarchyNode {
  place: PlaceDocument;
  children: PlaceHierarchyNode[];
}
