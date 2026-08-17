import {
  db,
  doc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  deleteField,
  Timestamp
} from '$lib/firebase';
import type { Firestore, DocumentReference } from 'firebase/firestore';
import { generateId } from '$lib/utils/helpers';

/** Struttura serializzabile per rappresentare campi assenti in Firestore */
export interface LedgerMissingValue {
  __type: 'MISSING';
}

export const LEDGER_MISSING: LedgerMissingValue = { __type: 'MISSING' };

export function isLedgerMissing(val: unknown): val is LedgerMissingValue {
  return typeof val === 'object' && val !== null && (val as any).__type === 'MISSING';
}

/** Tipi primitivi e composti rigorosamente serializzabili in Firestore */
export type LedgerValue = 
  | null 
  | string 
  | number 
  | boolean 
  | Timestamp 
  | LedgerMissingValue
  | LedgerValue[] 
  | { [key: string]: LedgerValue };

export type LedgerEventType = 
  | 'FIELD_MUTATION'   // Modifica di campi descrittivi o di stato
  | 'NUMERICAL_DELTA'  // Variazione quantitativa/finanziaria (giacenza, saldo additivo)
  | 'STATUS_CHANGE'    // Transizione di workflow (bozza -> attivo -> sospeso -> archiviato)
  | 'REVERSAL'         // Ripristino storico (Rollback time-machine)
  | 'ANONYMIZATION';   // Bonifica GDPR dati personali

export type FieldSemanticsType = 'ADDITIVE' | 'ABSOLUTE' | 'DESCRIPTIVE';
export type ActorType = 'USER' | 'SYSTEM' | 'SERVICE';
export type ReversalMode = 'SAFE_COMPENSATING' | 'FORCED_COMPENSATING';

/** Mappatura mutazione discriminata tipizzata con delta calcolato e validato dal Core */
export type LedgerFieldMutation = 
  | {
      old: LedgerValue;
      new: LedgerValue;
      semantics: 'ADDITIVE';
      delta: number;             // Obbligatorio per grandezze additive (Core convalida delta === new - old)
    }
  | {
      old: LedgerValue;
      new: LedgerValue;
      semantics: 'ABSOLUTE' | 'DESCRIPTIVE';
      delta?: never;             // Vietato per mutazioni di stato/descrittive
    };

/** Riferimento documentale collegato/visualizzato nella UI */
export interface LedgerSourceDoc {
  module: string;              // es. 'contracts', 'interventi', 'invoices', 'tickets'
  entityId: string;            // es. 'contract-123'
  docNumber?: string;          // es. 'CTR-2026-0042', 'DDT-88'
  label?: string;              // es. 'Contratto di Manutenzione Biennale'
}

/** Causa a monte dell'evento (flusso automatizzato / trigger di sistema) */
export interface LedgerCausedBy {
  module: string;              // Modulo che ha originato l'azione
  entityId: string;            // ID dell'entità scatenante
  action: string;              // es. 'CLOSE_INTERVENTION', 'PROCESS_PAYMENT', 'AUTO_REORDER'
}

export interface SystemLedgerEntry {
  id: string;                       // ID univoco autogenerato (o deterministico per migrazione legacy)
  tenantId: string;                 // Obbligatorio: Isolamento multi-tenant (fail-closed)
  module: string;                   // Modulo di appartenenza (es. 'clients', 'products', 'contracts')
  entityType: string;               // Tipo di entità (es. 'client', 'product', 'contract')
  entityId: string;                 // ID univoco del documento entità target
  entityLabel: string;              // Snapshot leggibile al momento dell'evento (es. "Acme Corp", "Pompa 200W")
  eventType: LedgerEventType;
  baseVersion: number;              // Revisione dell'entità prima della mutazione (N)
  aggregateVersion: number;         // Revisione risultante progressiva (N + 1)
  keysChanged: string[];            // Array dot-notation (es. ['original.ragioneSociale', 'original.pec'])
  mutations: Record<string, LedgerFieldMutation>; // Mappa tipizzata delle modifiche
  reason?: string;                  // Causale di business fornita dal bridge o digitata dall'utente
  sourceDoc?: LedgerSourceDoc;      // Riferimento documentale collegato
  causedBy?: LedgerCausedBy;        // Trigger o processo a monte
  operationId?: string;             // ID operazione batch/massiva (es. "IMPORT_20260817_01")
  correlationId?: string;           // ID correlazione distributed trace
  performedBy: string;              // Firebase Auth UID (per USER) o 'system:process' / 'service:importer'
  actorType: ActorType;             // 'USER' (client) | 'SYSTEM' (backend IAM) | 'SERVICE' (integrazioni)
  performedByName?: string;         // Snapshot visuale del nome operatore
  timestamp: any;                   // Server Timestamp o Timestamp Firestore
  dateInt: number;                  // Data intera YYYYMMDD in timezone Europe/Rome per partizionamento
  isReversal?: boolean;             // true se l'evento è un rollback
  reversalOfEntryId?: string;       // ID dell'evento annullato
  reversalMode?: ReversalMode;      // 'SAFE_COMPENSATING' | 'FORCED_COMPENSATING'
  isForced?: boolean;               // true se il rollback ha forzato un conflitto di concorrenza
  forcedBy?: string;                // UID del Superadmin che ha autorizzato la forzatura
  // Tracciamento specifico per eventi di bonifica GDPR
  anonymizedAt?: any;
  anonymizedBy?: string;
  anonymizationReason?: string;
}

/** Documento Marker per idempotenza atomica del Reversal */
export interface SystemLedgerReversalMarker {
  targetEntryId: string;            // ID dell'evento annullato (chiave del documento)
  reversalLedgerId: string;         // ID dell'evento REVERSAL generato in system_ledger
  reversedAt: any;                  // Server Timestamp dell'operazione di rollback
  reversedBy: string;               // Auth UID del Superadmin che ha eseguito il rollback
  tenantId: string;                 // Tenant di appartenenza
}

export class OptimisticConcurrencyError extends Error {
  constructor(message: string = 'Optimistic Concurrency Conflict: Entity has been modified concurrently.') {
    super(message);
    this.name = 'OptimisticConcurrencyError';
  }
}

export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerValidationError';
  }
}

export class ReversalConflictError extends Error {
  constructor(public conflictingFields: string[], message?: string) {
    super(message || `Reversal Conflict: The following fields have downstream mutations: ${conflictingFields.join(', ')}`);
    this.name = 'ReversalConflictError';
  }
}

export class AlreadyReversedError extends Error {
  constructor(message: string = 'Target ledger entry has already been reversed.') {
    super(message);
    this.name = 'AlreadyReversedError';
  }
}

/**
 * Calcola la data intera YYYYMMDD in timezone Europe/Rome
 */
export function getDateInt(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const formatted = formatter.format(date).replace(/-/g, '');
  return parseInt(formatted, 10);
}

/**
 * Confronta ricorsivamente per valore scalari, array, oggetti, Timestamps e LedgerMissingValue.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;

  // Gestione Sentinel MISSING
  if (isLedgerMissing(a) || isLedgerMissing(b)) {
    return isLedgerMissing(a) && isLedgerMissing(b);
  }
  
  // Gestione specifica per Firestore Timestamps
  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as any;
    const objB = b as any;
    if (typeof objA.toMillis === 'function' && typeof objB.toMillis === 'function') {
      return objA.toMillis() === objB.toMillis();
    }
    if (typeof objA.seconds === 'number' && typeof objB.seconds === 'number' &&
        typeof objA.nanoseconds === 'number' && typeof objB.nanoseconds === 'number') {
      return objA.seconds === objB.seconds && objA.nanoseconds === objB.nanoseconds;
    }
  }

  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => 
    Object.prototype.hasOwnProperty.call(b, key) && deepEqual((a as any)[key], (b as any)[key])
  );
}

/**
 * Helper per estrarre valori dot-notation annidati da un oggetto
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = curr[part];
  }
  return curr;
}

/**
 * Helper per impostare valori dot-notation annidati in un oggetto
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!curr[part] || typeof curr[part] !== 'object') {
      curr[part] = {};
    }
    curr = curr[part];
  }
  const last = parts[parts.length - 1];
  if (isLedgerMissing(value)) {
    delete curr[last];
  } else {
    curr[last] = value;
  }
}

export interface ComputeDiffOptions {
  ignoreKeys?: string[];
  semanticsMap?: Record<string, FieldSemanticsType>;
  prefix?: string;
}

/**
 * Calcola ricorsivamente il diff tra due stati di un'entità generando chiavi in dot-notation.
 */
export function computeDiff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  options?: ComputeDiffOptions
): { keysChanged: string[]; mutations: Record<string, LedgerFieldMutation> } {
  const keysChanged: string[] = [];
  const mutations: Record<string, LedgerFieldMutation> = {};

  const ignoreKeys = new Set([
    'updatedAt',
    'modifiedAt',
    'derived',
    'edits',
    ...(options?.ignoreKeys || [])
  ]);

  const semanticsMap = options?.semanticsMap || {};
  const prefix = options?.prefix ? `${options.prefix}.` : '';

  const objBefore = (before && typeof before === 'object') ? before : {};
  const objAfter = (after && typeof after === 'object') ? after : {};

  const allKeys = new Set([...Object.keys(objBefore), ...Object.keys(objAfter)]);

  for (const key of allKeys) {
    if (!options?.prefix && ignoreKeys.has(key)) continue;

    const fullPath = `${prefix}${key}`;
    const valBefore = Object.prototype.hasOwnProperty.call(objBefore, key) ? objBefore[key] : LEDGER_MISSING;
    const valAfter = Object.prototype.hasOwnProperty.call(objAfter, key) ? objAfter[key] : LEDGER_MISSING;

    // Se entrambi uguali tramite deepEqual, nessuna mutazione
    if (deepEqual(valBefore, valAfter)) continue;

    // Se entrambi sono oggetti semplici (non array, non timestamp, non missing), scendiamo in ricorsione
    const isBeforePlainObj = valBefore && typeof valBefore === 'object' && !Array.isArray(valBefore) && !isLedgerMissing(valBefore) && !('toMillis' in valBefore);
    const isAfterPlainObj = valAfter && typeof valAfter === 'object' && !Array.isArray(valAfter) && !isLedgerMissing(valAfter) && !('toMillis' in valAfter);

    if (isBeforePlainObj && isAfterPlainObj) {
      const nestedDiff = computeDiff(valBefore, valAfter, {
        ...options,
        prefix: fullPath
      });
      for (const nestedKey of nestedDiff.keysChanged) {
        keysChanged.push(nestedKey);
        mutations[nestedKey] = nestedDiff.mutations[nestedKey];
      }
      continue;
    }

    const semantics = semanticsMap[fullPath] || 'DESCRIPTIVE';

    if (semantics === 'ADDITIVE') {
      const numBefore = isLedgerMissing(valBefore) ? 0 : valBefore;
      const numAfter = isLedgerMissing(valAfter) ? 0 : valAfter;

      if (typeof numBefore !== 'number' || typeof numAfter !== 'number' || isNaN(numBefore) || isNaN(numAfter)) {
        throw new LedgerValidationError(
          `Semantics 'ADDITIVE' declared for field '${fullPath}', but values are not valid numbers (old: ${JSON.stringify(valBefore)}, new: ${JSON.stringify(valAfter)}).`
        );
      }

      const delta = numAfter - numBefore;
      keysChanged.push(fullPath);
      mutations[fullPath] = {
        old: valBefore as LedgerValue,
        new: valAfter as LedgerValue,
        semantics: 'ADDITIVE',
        delta
      };
    } else {
      keysChanged.push(fullPath);
      mutations[fullPath] = {
        old: valBefore as LedgerValue,
        new: valAfter as LedgerValue,
        semantics: semantics as 'ABSOLUTE' | 'DESCRIPTIVE'
      };
    }
  }

  return { keysChanged, mutations };
}

export interface DualWriteLedgerPayload {
  tenantId: string;
  module: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  eventType: LedgerEventType;
  keysChanged: string[];
  mutations: Record<string, LedgerFieldMutation>;
  performedBy: string;
  actorType?: ActorType;
  performedByName?: string;
  reason?: string;
  sourceDoc?: LedgerSourceDoc;
  causedBy?: LedgerCausedBy;
  operationId?: string;
  correlationId?: string;
}

export interface RevertLedgerOptions {
  entryId: string;
  entityRef: DocumentReference;
  reason?: string;
  performedBy: string;
  performedByName?: string;
  tenantId: string;
  isForced?: boolean;
}

/**
 * Servizio Core del Mutation Ledger e Versioning di Sistema (system_ledger)
 */
export class VersioningService {
  
  /**
   * Esegue una mutazione atomica su un'entità e registra la corrispondente voce immutabile nel system_ledger
   * garantendo le invarianti I1 (Monotonicity), I2 (Parity), I3 (OCC Concurrency Gate) e I4 (Transactional Atomicity).
   */
  static async executeDualWriteTransaction<T extends Record<string, any>>(
    dbInstance: Firestore,
    entityRef: DocumentReference,
    nextEntityData: T,
    ledgerPayload: DualWriteLedgerPayload,
    expectedBaseVersion?: number
  ): Promise<{ aggregateVersion: number; ledgerId: string }> {
    return await runTransaction(dbInstance, async (tx) => {
      const entitySnap = await tx.get(entityRef);
      const exists = entitySnap.exists();
      const currentEntityData = exists ? (entitySnap.data() as Record<string, any>) : null;

      const currentVersion = (currentEntityData?.edits?.aggregateVersion as number) ?? 0;

      // Invariante I3: Controllo di Concorrenza Ottimistica
      if (expectedBaseVersion !== undefined && currentVersion !== expectedBaseVersion) {
        throw new OptimisticConcurrencyError(
          `Expected entity base version ${expectedBaseVersion}, but found current version ${currentVersion}.`
        );
      }

      // Invariante I1: aggregateVersion = baseVersion + 1
      const nextVersion = currentVersion + 1;
      const ledgerId = generateId('ledger');
      const ledgerRef = doc(dbInstance, 'system_ledger', ledgerId);
      const dateInt = getDateInt();

      // Invariante I2 & I4: Scrittura atomica combinata di Entity + Ledger
      const entityEdits = {
        ...(currentEntityData?.edits || {}),
        aggregateVersion: nextVersion,
        lastLedgerId: ledgerId,
        updatedAt: serverTimestamp()
      };

      const entityPayloadToSave = {
        ...nextEntityData,
        edits: entityEdits
      };

      if (exists) {
        tx.set(entityRef, entityPayloadToSave, { merge: true });
      } else {
        tx.set(entityRef, entityPayloadToSave);
      }

      const ledgerRecord: SystemLedgerEntry = {
        id: ledgerId,
        tenantId: ledgerPayload.tenantId,
        module: ledgerPayload.module,
        entityType: ledgerPayload.entityType,
        entityId: ledgerPayload.entityId,
        entityLabel: ledgerPayload.entityLabel,
        eventType: ledgerPayload.eventType,
        baseVersion: currentVersion,
        aggregateVersion: nextVersion,
        keysChanged: ledgerPayload.keysChanged,
        mutations: ledgerPayload.mutations,
        performedBy: ledgerPayload.performedBy,
        actorType: ledgerPayload.actorType || 'USER',
        performedByName: ledgerPayload.performedByName,
        timestamp: serverTimestamp(),
        dateInt,
        ...(ledgerPayload.reason ? { reason: ledgerPayload.reason } : {}),
        ...(ledgerPayload.sourceDoc ? { sourceDoc: ledgerPayload.sourceDoc } : {}),
        ...(ledgerPayload.causedBy ? { causedBy: ledgerPayload.causedBy } : {}),
        ...(ledgerPayload.operationId ? { operationId: ledgerPayload.operationId } : {}),
        ...(ledgerPayload.correlationId ? { correlationId: ledgerPayload.correlationId } : {})
      };

      tx.set(ledgerRef, ledgerRecord);

      return {
        aggregateVersion: nextVersion,
        ledgerId
      };
    });
  }

  /**
   * Esegue il rollback time-machine matematico di un evento di ledger (Invarianti I6, I7, I8).
   * Riservato a superadmin. Crea un marker immutabile in system_ledger_reversals e registra un evento REVERSAL.
   */
  static async revertLedgerEntry(
    dbInstance: Firestore,
    options: RevertLedgerOptions
  ): Promise<{ aggregateVersion: number; reversalLedgerId: string; mode: ReversalMode }> {
    const { entryId, entityRef, reason, performedBy, performedByName, tenantId, isForced } = options;

    return await runTransaction(dbInstance, async (tx) => {
      const targetLedgerRef = doc(dbInstance, 'system_ledger', entryId);
      const markerRef = doc(dbInstance, 'system_ledger_reversals', entryId);

      const [targetSnap, markerSnap, entitySnap] = await Promise.all([
        tx.get(targetLedgerRef),
        tx.get(markerRef),
        tx.get(entityRef)
      ]);

      if (!targetSnap.exists()) {
        throw new Error(`Target ledger entry '${entryId}' not found.`);
      }

      // Invariante I6: Unicità e Idempotenza del Reversal
      if (markerSnap.exists()) {
        throw new AlreadyReversedError(`Ledger entry '${entryId}' has already been reversed.`);
      }

      if (!entitySnap.exists()) {
        throw new Error(`Entity '${entityRef.id}' not found.`);
      }

      const targetEntry = targetSnap.data() as SystemLedgerEntry;
      const currentEntityData = (entitySnap.data() as Record<string, any>) || {};

      // Verifica tenant match
      if (targetEntry.tenantId !== tenantId) {
        throw new Error(`Tenant mismatch: Entry belongs to tenant '${targetEntry.tenantId}', request is for '${tenantId}'.`);
      }

      const currentVersion = (currentEntityData?.edits?.aggregateVersion as number) ?? 0;
      const nextVersion = currentVersion + 1;
      const revLedgerId = generateId('ledger');
      const revLedgerRef = doc(dbInstance, 'system_ledger', revLedgerId);

      const reversalEntityUpdates: Record<string, any> = {};
      const reversalMutations: Record<string, LedgerFieldMutation> = {};
      const conflictingFields: string[] = [];
      let overallMode: ReversalMode = 'SAFE_COMPENSATING';

      for (const fieldPath of Object.keys(targetEntry.mutations)) {
        const mut = targetEntry.mutations[fieldPath];
        const currentVal = getNestedValue(currentEntityData, fieldPath);

        if (mut.semantics === 'ADDITIVE') {
          // Semantica Matematica ADDITIVE: inversione aritmetica netta (Δ_rev = -Δ)
          const currentNum = typeof currentVal === 'number' ? currentVal : 0;
          const deltaRev = -mut.delta;
          const nextVal = currentNum + deltaRev;

          setNestedValue(reversalEntityUpdates, fieldPath, nextVal);
          reversalMutations[fieldPath] = {
            old: currentNum,
            new: nextVal,
            semantics: 'ADDITIVE',
            delta: deltaRev
          };
        } else {
          // Semantica ABSOLUTE o DESCRIPTIVE: ripristino compensativo del valore storico
          const targetNewVal = mut.new;
          const targetOldVal = mut.old;

          // Se il valore attuale coincide con quello introdotto dalla mutazione da annullare
          const isValueCompatible = deepEqual(
            currentVal === undefined ? LEDGER_MISSING : currentVal,
            targetNewVal
          );

          if (!isValueCompatible) {
            conflictingFields.push(fieldPath);
          }

          if (isLedgerMissing(targetOldVal)) {
            // Il campo era assente prima dell'evento: rimuoviamo la chiave
            setNestedValue(reversalEntityUpdates, fieldPath, LEDGER_MISSING);
            // In Firestore impostiamo deleteField() per la chiave dot-notation
            reversalEntityUpdates[fieldPath] = deleteField();
          } else {
            setNestedValue(reversalEntityUpdates, fieldPath, targetOldVal);
          }

          reversalMutations[fieldPath] = {
            old: currentVal === undefined ? LEDGER_MISSING : currentVal,
            new: targetOldVal,
            semantics: mut.semantics
          };
        }
      }

      // Se ci sono conflitti di concorrenza su campi non additivi
      if (conflictingFields.length > 0) {
        if (!isForced) {
          throw new ReversalConflictError(
            conflictingFields,
            `Conflitto di concorrenza: i campi [${conflictingFields.join(', ')}] hanno subito mutazioni a valle. È richiesta la forzatura esplicita da parte del Superadmin.`
          );
        }
        overallMode = 'FORCED_COMPENSATING';
      }

      // Invariante I4: Scrittura Tripla Atomica (Entity + Marker + Reversal Ledger Event)
      const updatedEntityPayload = {
        ...currentEntityData,
        ...reversalEntityUpdates,
        edits: {
          ...(currentEntityData?.edits || {}),
          aggregateVersion: nextVersion,
          lastLedgerId: revLedgerId,
          updatedAt: serverTimestamp()
        }
      };

      tx.set(entityRef, updatedEntityPayload);

      // Scrittura Marker Reversal
      const markerPayload: SystemLedgerReversalMarker = {
        targetEntryId: entryId,
        reversalLedgerId: revLedgerId,
        reversedAt: serverTimestamp(),
        reversedBy: performedBy,
        tenantId
      };
      tx.set(markerRef, markerPayload);

      // Scrittura Record REVERSAL nel system_ledger
      const reversalLedgerEntry: SystemLedgerEntry = {
        id: revLedgerId,
        tenantId,
        module: targetEntry.module,
        entityType: targetEntry.entityType,
        entityId: targetEntry.entityId,
        entityLabel: targetEntry.entityLabel,
        eventType: 'REVERSAL',
        baseVersion: currentVersion,
        aggregateVersion: nextVersion,
        keysChanged: Object.keys(reversalMutations),
        mutations: reversalMutations,
        performedBy,
        actorType: 'USER',
        performedByName,
        timestamp: serverTimestamp(),
        dateInt: getDateInt(),
        isReversal: true,
        reversalOfEntryId: entryId,
        reversalMode: overallMode,
        ...(isForced ? { isForced: true, forcedBy: performedBy } : {}),
        reason: reason || `Rollback operazione ${entryId} (versione ${targetEntry.aggregateVersion})`
      };

      tx.set(revLedgerRef, reversalLedgerEntry);

      return {
        aggregateVersion: nextVersion,
        reversalLedgerId: revLedgerId,
        mode: overallMode
      };
    });
  }

  /**
   * Recupera la cronologia completa (timeline) delle mutazioni di un'entità ordinata per aggregateVersion decrescente.
   */
  static async getEntityTimeline(
    entityId: string,
    options?: { tenantId?: string; module?: string; limitCount?: number }
  ): Promise<SystemLedgerEntry[]> {
    try {
      const constraints: any[] = [
        where('entityId', '==', entityId)
      ];

      if (options?.tenantId) {
        constraints.push(where('tenantId', '==', options.tenantId));
      }
      if (options?.module) {
        constraints.push(where('module', '==', options.module));
      }

      constraints.push(orderBy('aggregateVersion', 'desc'));

      if (options?.limitCount) {
        constraints.push(limit(options.limitCount));
      }

      const q = query(collection(db, 'system_ledger'), ...constraints);
      const snap = await getDocs(q);

      const list: SystemLedgerEntry[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as SystemLedgerEntry);
      });

      return list;
    } catch (e) {
      console.warn('Errore lettura timeline ledger:', e);
      return [];
    }
  }

  /**
   * Recupera la storia delle variazioni su uno specifico percorso di campo (dot-notation)
   */
  static async getFieldHistory(
    entityId: string,
    fieldPath: string,
    options?: { tenantId?: string; limitCount?: number }
  ): Promise<SystemLedgerEntry[]> {
    try {
      const constraints: any[] = [
        where('entityId', '==', entityId),
        where('keysChanged', 'array-contains', fieldPath)
      ];

      if (options?.tenantId) {
        constraints.push(where('tenantId', '==', options.tenantId));
      }

      constraints.push(orderBy('aggregateVersion', 'desc'));

      if (options?.limitCount) {
        constraints.push(limit(options.limitCount));
      }

      const q = query(collection(db, 'system_ledger'), ...constraints);
      const snap = await getDocs(q);

      const list: SystemLedgerEntry[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as SystemLedgerEntry);
      });

      return list;
    } catch (e) {
      console.warn('Errore lettura storia campo ledger:', e);
      return [];
    }
  }
}
