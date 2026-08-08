import { db, collection, writeBatch, doc } from '$lib/firebase';
import type { ImportModuleSpec, ConflictStrategy } from '$lib/types/importTypes';
import { uuidv7 } from 'uuidv7';

export const teamsImportSpec: ImportModuleSpec = {
  entityType: 'teams',
  label: 'Squadre & Risorse',
  collectionName: 'teams',
  prerequisites: [],
  lookupKeys: ['id', 'code', 'name'],
  fields: [
    {
      key: 'id',
      label: 'ID Squadra (Opzionale)',
      type: 'string',
      required: false,
      description: 'ID univoco della squadra. Se non fornito, viene generato automaticamente.'
    },
    { key: 'code', label: 'Codice Squadra', type: 'string', required: false, aliases: ['codice', 'cod'] },
    { key: 'name', label: 'Nome Squadra', type: 'string', required: true, aliases: ['nome', 'squadra', 'team', 'gruppo'] },
    { key: 'status', label: 'Stato', type: 'string', required: false, defaultValue: 'attiva', aliases: ['stato', 'status'] },
    { key: 'evaluationType', label: 'Unità di Misura (mc, mq, mc_plus_mq, giornata)', type: 'string', required: false, aliases: ['unità di misura', 'misura', 'valutazione', 'evaluationType'] },
    { key: 'leaderId', label: 'ID Caposquadra', type: 'string', required: false, aliases: ['caposquadra id', 'leader id'] },
    { key: 'leaderName', label: 'Nome Caposquadra', type: 'string', required: false, aliases: ['caposquadra', 'responsabile', 'leader'] },
    { key: 'vehicleId', label: 'ID Mezzo', type: 'string', required: false, aliases: ['mezzo id', 'veicolo id'] },
    { key: 'vehicleName', label: 'Nome Mezzo', type: 'string', required: false, aliases: ['mezzo', 'veicolo', 'targa'] },
    { key: 'notes', label: 'Note', type: 'string', required: false, aliases: ['note', 'annotazioni'] }
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
        const explicitId = String(row.id || '').trim();
        const code = String(row.code || '').trim();
        const name = String(row.name || '').trim();
        
        const legacyId = code || name;
        const targetId = explicitId || ((conflictStrategy === 'upsert' && legacyId) ? legacyId : uuidv7());

        const docRef = doc(collection(db, 'teams'), targetId);
        
        // Generazione di un codice di default se non fornito
        const finalCode = code || `SQD-${targetId.substring(targetId.length - 6).toUpperCase()}`;
        const status = row.status || 'attiva';

        const teamDoc: any = {
          id: targetId,
          code: finalCode,
          name: name,
          members: [], // Le risorse verranno aggiunte dall'importazione del personale se abilitata
          status: status,
          notes: row.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (row.evaluationType) teamDoc.evaluationType = row.evaluationType;
        if (row.leaderId) teamDoc.leaderId = row.leaderId;
        if (row.leaderName) teamDoc.leaderName = row.leaderName;
        if (row.vehicleId) teamDoc.vehicleId = row.vehicleId;
        if (row.vehicleName) teamDoc.vehicleName = row.vehicleName;

        batch.set(docRef, teamDoc, { merge: conflictStrategy === 'upsert' });
        succeeded++;

        if (explicitId || legacyId) {
          createdMap[explicitId || legacyId] = targetId;
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: idx, error: err.message || 'Errore di salvataggio record' });
      }
    });

    await batch.commit();

    return { succeeded, failed, errors, createdMap };
  }
};
