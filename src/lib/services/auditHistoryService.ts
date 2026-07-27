import { db, collection, addDoc, doc, getDoc, getDocs, deleteDoc, setDoc } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { CacheLookupService } from './cacheLookupService';

export interface AuditHistoryLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ANONYMIZED';
  entityType: string;
  entityId: string;
  performedBy: string; // uid
  timestamp: string; // ISO string
  changes?: Record<string, { old: any, new: any }>;
  notes?: string;
}

export class AuditHistoryService {
  
  /**
   * Controlla se i log di sistema sono abilitati nelle impostazioni.
   */
  static async isHistoryEnabled(): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'project'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.enableHistoryLogs === false) return false;
      }
      return true; // Default true
    } catch (e) {
      console.warn('Errore lettura impostazioni history:', e);
      return true;
    }
  }

  /**
   * Crea un log di modifica (history) in una subcollection dell'entità genitore.
   * La path sarà: `/{collectionName}/{entityId}/history/{logId}`
   */
  static async logChange(
    collectionName: string, 
    entityId: string, 
    action: AuditHistoryLog['action'], 
    performedBy: string, 
    changes?: Record<string, { old: any, new: any }>,
    notes?: string
  ): Promise<void> {
    
    // Controlla impostazioni
    const enabled = await this.isHistoryEnabled();
    if (!enabled) return;

    // Se non ci sono modifiche effettive e l'azione è UPDATE, evadiamo.
    if (action === 'UPDATE' && (!changes || Object.keys(changes).length === 0)) return;

    const logId = generateId('audit');
    const historyRef = doc(db, collectionName, entityId, 'history', logId);

    const log: AuditHistoryLog = {
      id: logId,
      action,
      entityType: collectionName,
      entityId,
      performedBy,
      timestamp: new Date().toISOString(),
      ...(changes ? { changes } : {}),
      ...(notes ? { notes } : {})
    };

    await setDoc(historyRef, log);
  }

  /**
   * Recupera la history di una specifica entità
   */
  static async getEntityHistory(collectionName: string, entityId: string): Promise<AuditHistoryLog[]> {
    const snap = await getDocs(collection(db, collectionName, entityId, 'history'));
    const list: AuditHistoryLog[] = [];
    snap.forEach(d => list.push(d.data() as AuditHistoryLog));
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Pulisce l'intera history ed inietta un log di cancellazione/anonimizzazione
   * per rispettare il GDPR Diritto all'Oblio.
   */
  static async wipeHistoryForAnonymization(collectionName: string, entityId: string, performedBy: string = 'system'): Promise<void> {
    const historyColRef = collection(db, collectionName, entityId, 'history');
    const snap = await getDocs(historyColRef);
    
    // Elimina i vecchi log che contengono PII
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(historyColRef, docSnap.id));
    }

    // Inietta il log di avvenuta anonimizzazione
    await this.logChange(
      collectionName,
      entityId,
      'ANONYMIZED',
      performedBy,
      undefined,
      'Dati personali cancellati per anonimizzazione (GDPR Right to be Forgotten)'
    );
  }

  /**
   * Utilities per calcolare il diff (utile per l'update)
   */
  static calculateDiff(oldData: Record<string, any>, newData: Record<string, any>): Record<string, { old: any, new: any }> {
    const changes: Record<string, { old: any, new: any }> = {};
    
    // Unione di tutte le chiavi
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    
    for (const key of allKeys) {
      // Evitiamo di tracciare campi tecnici come updateAt se non c'è altro
      if (key === 'updatedAt' || key === 'modifiedAt' || key === 'derived' || key === 'edits') continue;

      const oldVal = oldData[key];
      const newVal = newData[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = {
          old: oldVal,
          new: newVal
        };
      }
    }
    
    return changes;
  }
}
