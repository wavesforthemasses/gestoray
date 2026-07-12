import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib';

export interface UserData {
  uid: string;
  email: string;
  roles: string[];
  nome?: string;
  cognome?: string;
  createdAt?: string;
}

export class UsersService {
  static async getUsers(): Promise<UserData[]> {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const list: UserData[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() || {};
      const original = data.original || data || {};
      list.push({
        uid: doc.id,
        email: original.email,
        roles: original.roles || [],
        nome: original.nome,
        cognome: original.cognome,
        createdAt: data.edits?.createdAt || data.createdAt
      });
    });
    
    return list;
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

    await setDoc(doc(db, 'users', uid), {
      original: {
        nome: cleanNome,
        cognome: cleanCognome,
        email: cleanEmail,
        roles: roles,
        qualification: qualification
      },
      derived: {
        totalContractsCount: 0,
        totalApprovedSales: 0,
        totalPendingSales: 0,
        totalCommissionEarned: 0,
        totalCommissionPending: 0,
        totalClientsCreated: 0,
        totalNNCF: 0,
        textSearch: generateSearchTerms(cleanNome + ' ' + cleanCognome + ' ' + cleanEmail)
      },
      edits: {
        createdAt: new Date().toISOString(),
        createdBy: creatorUid || 'system'
      }
    });
  }
}
