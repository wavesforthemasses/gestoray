import { db, doc, getDoc, getDocs, collection, functions, httpsCallable } from '$lib/firebase';

export interface UserDetailPayload {
  email: string;
  nome: string;
  cognome: string;
  roles: string[];
  qualification: string;
  supervisorUid: string;
  createdAt: string;
}

export class UserDetailService {
  static async fetchUserDetails(uid: string): Promise<UserDetailPayload> {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      throw new Error("Impossibile trovare l'utente specificato nel database.");
    }
    const data = userDoc.data() || {};
    const original = data.original || data || {};
    
    return {
      email: original.email || '',
      nome: original.nome || '',
      cognome: original.cognome || '',
      roles: original.roles || [],
      qualification: original.qualification || '',
      supervisorUid: original.supervisorUid || '',
      createdAt: data.edits?.createdAt || data.createdAt || ''
    };
  }

  static async fetchQualificationsAndSupervisors(): Promise<{ qualificationsList: any[], supervisorsList: any[] }> {
    const qSnap = await getDocs(collection(db, 'qualifications'));
    const qList: any[] = [];
    qSnap.forEach((d: any) => qList.push({ id: d.id, ...d.data() }));
    const qualificationsList = qList.sort((a, b) => a.percentage - b.percentage);

    const uSnap = await getDocs(collection(db, 'users'));
    const uList: any[] = [];
    uSnap.forEach((d: any) => {
      const u = d.data().original || d.data() || {};
      uList.push({ uid: d.id, name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email });
    });
    const supervisorsList = uList.sort((a, b) => a.name.localeCompare(b.name));

    return { qualificationsList, supervisorsList };
  }

  static async updateUser(payload: { uid: string, email: string, nome: string, cognome: string, roles: string[], qualification: string, supervisorUid: string }): Promise<void> {
    if (payload.roles.length === 0) {
      throw new Error("Seleziona almeno un ruolo per l'utente.");
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanNome = payload.nome.trim();
    const cleanCognome = payload.cognome.trim();

    const updateUserFn = httpsCallable(functions, 'updateUser');
    await updateUserFn({
      uid: payload.uid,
      email: cleanEmail,
      nome: cleanNome,
      cognome: cleanCognome,
      roles: payload.roles,
      qualification: payload.qualification,
      supervisorUid: payload.supervisorUid
    });
  }
}
