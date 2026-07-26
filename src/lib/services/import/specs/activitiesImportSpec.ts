import { db, collection, writeBatch, doc } from '$lib/firebase';
import type { ImportModuleSpec, ConflictStrategy } from '$lib/types/importTypes';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { uuidv7 } from 'uuidv7';

export const activitiesImportSpec: ImportModuleSpec = {
  entityType: 'activities',
  label: 'Attività & Interventi',
  collectionName: 'activities',
  prerequisites: ['clients'],
  lookupKeys: ['title', 'id'],
  fields: [
    { key: 'title', label: 'Titolo Attività', type: 'string', required: true },
    { key: 'clientId', label: 'ID o Nome Cliente', type: 'string', required: true },
    { key: 'date', label: 'Data Attività', type: 'date', required: false },
    { key: 'status', label: 'Stato', type: 'string', required: false, defaultValue: 'aperto' },
    { key: 'operator', label: 'Operatore', type: 'string', required: false },
    { key: 'notes', label: 'Note / Dettagli', type: 'string', required: false }
  ],

  processBatch: async (
    rows: Record<string, any>[],
    sessionMap: Record<string, string>,
    conflictStrategy: ConflictStrategy
  ) => {
    const batch = writeBatch(db);
    let succeeded = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];
    const createdMap: Record<string, string> = {};

    rows.forEach((row, idx) => {
      try {
        const legacyId = row.id;
        const targetId = (conflictStrategy === 'upsert' && legacyId) ? legacyId : uuidv7();
        const docRef = doc(collection(db, 'activities'), targetId);

        // Resolve clientId from sessionMap if passed as legacy key
        const resolvedClientId = sessionMap[row.clientId] || row.clientId;

        const activityDoc = {
          title: (row.title || '').trim(),
          clientId: resolvedClientId || '',
          date: row.date || new Date().toISOString(),
          status: row.status || 'aperto',
          operator: row.operator || '',
          notes: row.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        batch.set(docRef, activityDoc, { merge: conflictStrategy === 'upsert' });
        succeeded++;

        if (legacyId) {
          createdMap[legacyId] = targetId;
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: idx, error: err.message || 'Errore salvataggio attività' });
      }
    });

    await batch.commit();

    try {
      await CacheLookupService.rebuildCacheForType('activities');
    } catch (e) {
      console.warn('[activitiesImportSpec] Cache rebuild warning:', e);
    }

    return { succeeded, failed, errors, createdMap };
  }
};
