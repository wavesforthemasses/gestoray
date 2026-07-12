import { functions, httpsCallable } from '$lib/firebase';

export class ProfileService {
  static async updateProfile(uid: string, email: string, nome: string, cognome: string): Promise<void> {
    const updateProfileFn = httpsCallable(functions, 'updateProfile');
    await updateProfileFn({
      uid: uid,
      email: email,
      nome: nome,
      cognome: cognome
    });
  }
}
