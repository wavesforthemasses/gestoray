import { db, doc, getDoc, collection, getDocs, query, where, orderBy, setDoc, updateDoc } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib';
import { CacheLookupService } from '$lib/services/cacheLookupService';

export interface UserData {
  uid: string;
  email: string;
  roles: string[];
  nome?: string;
  cognome?: string;
  createdAt?: string;
  isActive?: boolean;
  qualification?: string;
  customCommissionPercentage?: number | null;
}

export class UsersService {
  static async getUser(uid: string): Promise<any | null> {
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (e) {
      console.error('Errore get user:', e);
      return null;
    }
  }
  static async getUsers(
    searchVal?: string,
    filterStatus?: 'all' | 'active' | 'inactive',
    filterRole?: string
  ): Promise<UserData[]> {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const list: UserData[] = [];
    
    querySnapshot.forEach((docSnap: any) => {
      const data = docSnap.data() || {};
      const original = data.original || data || {};
      const isActive = original.isActive !== false;
      const roles: string[] = original.roles || [];
      const nome = original.nome || '';
      const cognome = original.cognome || '';
      const email = original.email || '';

      // Status filter
      if (filterStatus === 'active' && !isActive) return;
      if (filterStatus === 'inactive' && isActive) return;

      // Role filter
      if (filterRole && !roles.includes(filterRole)) return;

      // Search filter
      if (searchVal && searchVal.trim()) {
        const term = searchVal.trim().toLowerCase();
        const full = `${nome} ${cognome} ${email}`.toLowerCase();
        if (!full.includes(term)) return;
      }

      list.push({
        uid: docSnap.id,
        email,
        roles,
        nome,
        cognome,
        createdAt: data.edits?.createdAt || data.createdAt,
        isActive,
        qualification: original.qualification,
        customCommissionPercentage: original.customCommissionPercentage ?? null
      });
    });
    
    return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }

  static async toggleUserActiveStatus(uid: string, isActive: boolean, modifierUid: string): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'original.isActive': isActive,
      'edits.modifiedAt': new Date().toISOString(),
      'edits.modifiedBy': modifierUid
    });
  }

  static async createUser(
    nome: string, 
    cognome: string, 
    email: string, 
    roles: string[], 
    qualification: string, 
    creatorUid: string, 
    existingUsers: UserData[]
  ): Promise<void> {
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    const cleanCognome = cognome.trim();

    if (!cleanEmail || !cleanNome || !cleanCognome) {
      throw new Error('Nome, cognome ed email sono obbligatori.');
    }

    if (roles.length === 0) {
      throw new Error('Seleziona almeno un ruolo per il nuovo utente.');
    }

    const emailExists = existingUsers.some(u => u.email === cleanEmail);
    if (emailExists) {
      throw new Error('L\'indirizzo email inserito è già registrato.');
    }

    const uid = generateId('uid');
    const fullUserName = `${cleanNome} ${cleanCognome}`.trim();
    const chunkId = await CacheLookupService.updateEntityCache('users', uid, fullUserName);

    await setDoc(doc(db, 'users', uid), {
      original: {
        nome: cleanNome,
        cognome: cleanCognome,
        email: cleanEmail,
        roles: roles,
        qualification: qualification,
        isActive: true
      },
      derived: {
        totalClientsCreated: 0,
        textSearch: generateSearchTerms(cleanNome + ' ' + cleanCognome + ' ' + cleanEmail),
        ...(chunkId ? { cacheChunkId: chunkId } : {})
      },
      edits: {
        createdAt: new Date().toISOString(),
        createdBy: creatorUid || 'system'
      }
    });
  }
}

