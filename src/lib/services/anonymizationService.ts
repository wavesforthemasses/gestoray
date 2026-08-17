import { db, doc, getDoc, updateDoc } from '$lib/firebase';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { AuditHistoryService } from '$lib/services/auditHistoryService';

export type AnonymizationStrategy = 
  | 'REDACT' 
  | 'INITIALS' 
  | 'HASH_EMAIL' 
  | 'MASK_PHONE' 
  | 'CLEAR' 
  | 'PRESERVE';

export interface FieldAnonymizationSpec {
  fieldPath: string; // es. "original.nome", "original.email"
  strategy: AnonymizationStrategy;
  customReplacement?: string; // Usato per REDACT (es. "Utente Anonimo")
}

export interface EntityAnonymizationConfig {
  entityType: string;
  collectionName: string;
  label: string;
  fieldSpecs: FieldAnonymizationSpec[];
}

// ---- SPECIFICHE PREDEFINITE ----

export const USERS_ANONYMIZATION_SPEC: FieldAnonymizationSpec[] = [
  { fieldPath: 'original.nome', strategy: 'INITIALS' },
  { fieldPath: 'original.cognome', strategy: 'INITIALS' },
  { fieldPath: 'original.email', strategy: 'HASH_EMAIL' },
];

export const CONTACTS_ANONYMIZATION_SPEC: FieldAnonymizationSpec[] = [
  { fieldPath: 'original.firstName', strategy: 'INITIALS' },
  { fieldPath: 'original.lastName', strategy: 'INITIALS' },
  { fieldPath: 'original.email', strategy: 'HASH_EMAIL' },
  { fieldPath: 'original.phone', strategy: 'CLEAR' },
  { fieldPath: 'original.mobile', strategy: 'CLEAR' },
  { fieldPath: 'original.pec', strategy: 'CLEAR' },
  { fieldPath: 'original.notes', strategy: 'CLEAR' },
  { fieldPath: 'original.doNotContact', strategy: 'PRESERVE' },
];

export const CLIENTS_ANONYMIZATION_SPEC: FieldAnonymizationSpec[] = [
  { fieldPath: 'original.ragioneSociale', strategy: 'REDACT', customReplacement: 'Cliente Anonimizzato' },
  { fieldPath: 'original.nome', strategy: 'INITIALS' },
  { fieldPath: 'original.cognome', strategy: 'INITIALS' },
  { fieldPath: 'original.email', strategy: 'HASH_EMAIL' },
  { fieldPath: 'original.pec', strategy: 'CLEAR' },
  { fieldPath: 'original.telefono', strategy: 'CLEAR' },
  { fieldPath: 'original.cellulare', strategy: 'CLEAR' },
  { fieldPath: 'original.partitaIva', strategy: 'CLEAR' },
  { fieldPath: 'original.codiceFiscale', strategy: 'CLEAR' },
];

export class AnonymizationService {

  /**
   * Trasforma un singolo valore in base alla strategia.
   */
  static anonymizeValue(value: any, strategy: AnonymizationStrategy, customReplacement?: string, contextId?: string): any {
    if (value === undefined) value = null; // Firestore doesn't support undefined

    if (value === null || value === '') {
      if (strategy === 'CLEAR') return '';
      if (strategy === 'HASH_EMAIL') return `anon_${contextId || Math.random().toString(36).substring(2,8)}@anonymized.local`;
      if (strategy === 'REDACT') return customReplacement || 'ANONIMIZZATO';
      return value;
    }

    switch (strategy) {
      case 'REDACT':
        return customReplacement || 'ANONIMIZZATO';
      
      case 'CLEAR':
        if (Array.isArray(value)) return [];
        if (typeof value === 'boolean') return false;
        if (typeof value === 'number') return 0;
        return '';

      case 'INITIALS':
        if (typeof value === 'string') {
          const parts = value.trim().split(/\s+/);
          return parts.map(p => p.charAt(0).toUpperCase() + '.').join(' ');
        }
        return value;

      case 'HASH_EMAIL':
        return `anon_${contextId || Math.random().toString(36).substring(2,8)}@anonymized.local`;

      case 'MASK_PHONE':
        if (typeof value === 'string') {
          const s = value.trim();
          if (s.length <= 4) return '***';
          // Tieni i primi 3 e gli ultimi 2, maschera il centro
          return s.substring(0, 3) + ' *** ' + s.substring(s.length - 2);
        }
        return value;

      case 'PRESERVE':
      default:
        return value;
    }
  }

  /**
   * Applica in-memory le specifiche di anonimizzazione ad un oggetto document (supporta nested field paths).
   */
  static applyAnonymization(originalDoc: Record<string, any>, specs: FieldAnonymizationSpec[], documentId?: string): Record<string, any> {
    const updatedDoc = JSON.parse(JSON.stringify(originalDoc)); // clone

    for (const spec of specs) {
      const parts = spec.fieldPath.split('.');
      let current = updatedDoc;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      const leaf = parts[parts.length - 1];
      current[leaf] = this.anonymizeValue(current[leaf], spec.strategy, spec.customReplacement, documentId);
    }

    return updatedDoc;
  }

  /**
   * Esegue l'intero flusso su Firestore:
   * 1. Legge doc
   * 2. Applica trasformazione
   * 3. Rigenera ricerca
   * 4. Salva su Firestore
   * 5. Aggiorna cache
   */
  static async anonymizeEntity(collectionName: string, id: string, specs: FieldAnonymizationSpec[], authorUid: string): Promise<void> {
    const ref = doc(db, collectionName, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      throw new Error(`Documento non trovato in ${collectionName}/${id}`);
    }

    const data = snap.data();
    const updatedData = this.applyAnonymization(data, specs, id);

    // Ricalcola testSearch se il documento lo prevede
    if (updatedData.original) {
      // Cerca di estrarre un nome rappresentativo (es. nome/cognome, firstName/lastName, ragioneSociale)
      const nome = updatedData.original.nome || updatedData.original.firstName || '';
      const cognome = updatedData.original.cognome || updatedData.original.lastName || '';
      const email = updatedData.original.email || '';
      const ragione = updatedData.original.ragioneSociale || '';
      
      const searchString = `${ragione} ${nome} ${cognome} ${email}`.trim();
      if (!updatedData.derived) updatedData.derived = {};
      updatedData.derived.textSearch = generateSearchTerms(searchString);

      // Aggiungi flag di anonimizzazione
      if (!updatedData.edits) updatedData.edits = {};
      updatedData.edits.anonymizedAt = new Date().toISOString();
      updatedData.edits.modifiedAt = new Date().toISOString();
      updatedData.edits.modifiedBy = authorUid;
      updatedData.original.isAnonymized = true; // per facile query/check visivo
    }

    await updateDoc(ref, updatedData);

    // Aggiorna CacheLookupService se pertinente
    try {
      const nome = updatedData.original?.nome || updatedData.original?.firstName || '';
      const cognome = updatedData.original?.cognome || updatedData.original?.lastName || '';
      const ragione = updatedData.original?.ragioneSociale || '';
      
      let cacheLabel = '';
      if (ragione) cacheLabel = ragione;
      else if (nome || cognome) cacheLabel = `${nome} ${cognome}`.trim();
      else cacheLabel = 'Anonimo';

      // Cerchiamo di dedurre il tipo cache dalla collection
      if (collectionName === 'users') {
        await CacheLookupService.updateEntityCache('users', id, cacheLabel);
      } else if (collectionName === 'clients') {
        await CacheLookupService.updateEntityCache('clients', id, cacheLabel);
      }
      // contacts non usa entity cache globali attualmente, ma per sicurezza potremmo.
    } catch (e) {
      console.warn('Errore durante l\'aggiornamento cache post-anonimizzazione:', e);
    }

    // WIPE History Logs and insert ANONYMIZED log entry
    try {
      await AuditHistoryService.wipeHistoryForAnonymization(collectionName, id, authorUid);
    } catch (e) {
      console.warn(`Impossibile pulire i log storici per l'entità ${collectionName}/${id}`, e);
    }

    // Scrub System Ledger Entries for GDPR Oblivion
    try {
      await this.scrubLedgerForAnonymization(id, authorUid);
    } catch (e) {
      console.warn(`Impossibile bonificare system_ledger per l'entità ${id}`, e);
    }
  }

  /**
   * Pulisce e redige i record di system_ledger per un'entità anonimizzata (GDPR Oblivion).
   */
  static async scrubLedgerForAnonymization(entityId: string, authorUid: string = 'system'): Promise<number> {
    try {
      const { collection, getDocs, query, where, updateDoc } = await import('$lib/firebase');
      const q = query(collection(db, 'system_ledger'), where('entityId', '==', entityId));
      const snap = await getDocs(q);
      let count = 0;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const scrubbedMutations: Record<string, any> = {};

        if (data.mutations && typeof data.mutations === 'object') {
          for (const [key, mut] of Object.entries(data.mutations as Record<string, any>)) {
            scrubbedMutations[key] = {
              ...mut,
              old: typeof mut.old === 'string' ? '[GDPR OBLIVION]' : mut.old,
              new: typeof mut.new === 'string' ? '[GDPR OBLIVION]' : mut.new
            };
          }
        }

        const updates: Record<string, any> = {
          entityLabel: '[DATO PERSONALE CANCELLATO]',
          mutations: scrubbedMutations,
          reason: '[GDPR OBLIVION]',
          performedByName: '[OPERATORE ANONIMIZZATO]',
          anonymizedAt: new Date().toISOString(),
          anonymizedBy: authorUid,
          anonymizationReason: "Diritto all'Oblio (GDPR Art. 17)"
        };

        if (data.sourceDoc) {
          updates['sourceDoc.label'] = '[DOCUMENTO ANONIMIZZATO]';
          updates['sourceDoc.docNumber'] = '[MASKED]';
        }

        await updateDoc(doc(db, 'system_ledger', docSnap.id), updates);
        count++;
      }

      return count;
    } catch (e) {
      console.warn('Errore durante la bonifica GDPR di system_ledger:', e);
      return 0;
    }
  }
}
