import { db, collection, writeBatch, doc, getDocs } from '$lib/firebase';
import type { ImportModuleSpec, ConflictStrategy, ImportFieldDef } from '$lib/types/importTypes';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib';
import modulesRegistry from '$lib/config/modules.registry.json';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import type { TeamItem } from '../../../../routes/dashboard/teams/schema';

const isTeamsEnabled = (modulesRegistry.modules || []).some((m: any) => m.id === 'teams' && m.enabled);

const userFields: ImportFieldDef[] = [
  { key: 'nome', label: 'Nome', type: 'string', required: true, aliases: ['nome'] },
  { key: 'cognome', label: 'Cognome', type: 'string', required: true, aliases: ['cognome'] },
  { key: 'email', label: 'Email', type: 'string', required: false, aliases: ['e-mail', 'mail'] },
  { 
    key: 'roles', 
    label: 'Ruoli (Separati da virgola)', 
    type: 'string', 
    required: false, 
    defaultValue: 'operaio',
    aliases: ['ruolo', 'ruoli', 'role', 'roles'],
    description: 'Inserisci uno o più ruoli separati da virgola. (es. operaio, tecnico)'
  },
  { key: 'qualification', label: 'Qualifica', type: 'string', required: false, aliases: ['qualifica', 'mansione'] },
  { key: 'evaluationType', label: 'Unità di Misura (Squadra)', type: 'string', required: false, aliases: ['unità di misura', 'misura', 'valutazione', 'evaluationType'] }
];

if (isTeamsEnabled) {
  userFields.push({
    key: 'squadra',
    label: 'Squadra (Nome o Codice)',
    type: 'string',
    required: false,
    description: 'Permette di assegnare l\'utente ad una squadra esistente (o di crearne una nuova al volo).',
    aliases: ['team', 'squadra', 'gruppo']
  });
}

export const usersImportSpec: ImportModuleSpec = {
  entityType: 'users',
  label: 'Anagrafica Personale (Utenti)',
  collectionName: 'users',
  prerequisites: isTeamsEnabled ? ['teams'] : [],
  lookupKeys: ['email'],
  fields: userFields,

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

    // Se il bridge squadre è attivo, carichiamo le squadre esistenti per poter fare il match
    let existingTeams: Record<string, TeamItem> = {};
    if (isTeamsEnabled) {
      const teamsSnap = await getDocs(collection(db, 'teams'));
      teamsSnap.forEach(tDoc => {
        const tData = tDoc.data() as TeamItem;
        const searchKeyName = (tData.name || '').toLowerCase().trim();
        const searchKeyCode = (tData.code || '').toLowerCase().trim();
        if (searchKeyName) existingTeams[searchKeyName] = tData;
        if (searchKeyCode) existingTeams[searchKeyCode] = tData;
      });
    }

    // Carichiamo le email esistenti per non duplicare
    const usersSnap = await getDocs(collection(db, 'users'));
    const existingEmails = new Set<string>();
    const existingUsersByEmail: Record<string, any> = {};
    usersSnap.forEach(uDoc => {
      const uData = uDoc.data();
      const email = (uData.original?.email || uData.email || '').toLowerCase().trim();
      if (email) {
        existingEmails.add(email);
        existingUsersByEmail[email] = { uid: uDoc.id, ...uData };
      }
    });

    // Mappa per tener traccia delle modifiche alle squadre nello stesso batch
    const pendingTeamsUpdate: Record<string, TeamItem> = {};

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      try {
        const nome = String(row.nome || '').trim();
        const cognome = String(row.cognome || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        
        if (!nome || !cognome) {
          throw new Error('Nome e cognome sono obbligatori.');
        }

        // Parsing ruoli
        let rawRoles = String(row.roles || '').trim();
        if (!rawRoles) rawRoles = 'operaio'; // Default value come richiesto
        const roles = rawRoles.split(',').map(r => r.trim().toLowerCase()).filter(r => r.length > 0);
        
        if (roles.length === 0) roles.push('operaio');

        const legacyId = email;
        let targetId = '';
        let isUpdate = false;

        if (existingEmails.has(email)) {
          if (conflictStrategy === 'skip') {
            throw new Error(`Utente con email ${email} già esistente (skip).`);
          } else if (conflictStrategy === 'upsert') {
            targetId = existingUsersByEmail[email].uid;
            isUpdate = true;
          } else {
            // create_new su email esistente non ha molto senso per auth, ma se forzato generiamo nuovo id
            // Attenzione: firebase auth necessita email univoche, ma qui creiamo solo il doc a db
            targetId = generateId('uid');
          }
        } else {
          targetId = generateId('uid');
        }

        const docRef = doc(collection(db, 'users'), targetId);
        
        const fullUserName = `${nome} ${cognome}`;
        const chunkId = await CacheLookupService.updateEntityCache('users', targetId, fullUserName);

        const userDoc = {
          original: {
            nome: nome,
            cognome: cognome,
            email: email,
            roles: roles,
            qualification: row.qualification || '',
            isActive: true
          },
          derived: {
            totalClientsCreated: 0,
            textSearch: generateSearchTerms(`${nome} ${cognome} ${email}`),
            ...(chunkId ? { cacheChunkId: chunkId } : {})
          },
          edits: {
            createdAt: isUpdate ? existingUsersByEmail[email]?.edits?.createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system_import'
          }
        };

        batch.set(docRef, userDoc, { merge: true });

        // Gestione Bridge Squadre
        if (isTeamsEnabled && row.squadra) {
          const squadraVal = String(row.squadra).trim().toLowerCase();
          
          if (squadraVal) {
            // Cerchiamo la squadra tra quelle esistenti o nei pending update
            let teamObj = pendingTeamsUpdate[squadraVal] || existingTeams[squadraVal];
            
            if (!teamObj) {
              // La squadra non esiste, la creiamo al volo (magic!)
              const newTeamId = generateId('uid'); // o uuidv7
              teamObj = {
                id: newTeamId,
                code: `SQD-${newTeamId.substring(newTeamId.length - 6).toUpperCase()}`,
                name: String(row.squadra).trim(),
                members: [],
                status: 'attiva',
                createdAt: new Date().toISOString()
              };
              existingTeams[squadraVal] = teamObj;
            }

            // Aggiungiamo il membro se non c'è
            const alreadyInTeam = teamObj.members.some(m => m.userId === targetId);
            if (!alreadyInTeam) {
              const newMember: any = {
                userId: targetId,
                userName: fullUserName,
                roleInTeam: roles[0] || 'membro',
                isLeader: false
              };
              if (row.evaluationType) {
                newMember.evaluationType = row.evaluationType;
              }
              teamObj.members.push(newMember);
              pendingTeamsUpdate[teamObj.id] = teamObj; // indicizziamo per id per l'aggiornamento batch
            }
          }
        }

        succeeded++;

        if (legacyId) {
          createdMap[legacyId] = targetId;
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: idx, error: err.message || 'Errore record' });
      }
    }

    // Aggiungiamo al batch le squadre da aggiornare/creare
    Object.values(pendingTeamsUpdate).forEach(team => {
      const tRef = doc(collection(db, 'teams'), team.id);
      batch.set(tRef, {
        id: team.id,
        code: team.code,
        name: team.name,
        members: team.members,
        status: team.status || 'attiva',
        createdAt: team.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    await batch.commit();

    return { succeeded, failed, errors, createdMap };
  }
};
