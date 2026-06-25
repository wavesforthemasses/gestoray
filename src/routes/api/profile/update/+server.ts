import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminAuth, adminDb } from '$lib/firebase-admin';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { uid, email, nome, cognome } = await request.json();
    
    if (!uid || !email || !nome || !cognome) {
      return json({ message: 'UID, email, nome e cognome sono campi obbligatori.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    const cleanCognome = cognome.trim();

    if (!cleanNome || !cleanCognome) {
      return json({ message: 'Nome e cognome non possono essere vuoti.' }, { status: 400 });
    }

    const userDocRef = adminDb.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return json({ message: 'Utente non trovato nel database.' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Check email uniqueness if email is being updated
    if (userData.email !== cleanEmail) {
      const duplicateQuery = await adminDb.collection('users').where('email', '==', cleanEmail).get();
      if (!duplicateQuery.empty) {
        return json({ message: 'L\'indirizzo email inserito è già registrato da un altro account.' }, { status: 400 });
      }
      
      await adminAuth.updateUser(uid, { email: cleanEmail });
    }

    await userDocRef.set({
      ...userData,
      email: cleanEmail,
      nome: cleanNome,
      cognome: cleanCognome,
      updatedAt: new Date().toISOString()
    });

    console.log(`[PROFILE UPDATE] Profile updated for UID ${uid}: ${cleanNome} ${cleanCognome} (${cleanEmail})`);

    return json({ success: true, email: cleanEmail, nome: cleanNome, cognome: cleanCognome });
  } catch (error: any) {
    console.error('Error during profile update API:', error);
    return json({ message: error.message || 'Errore interno del server.' }, { status: 500 });
  }
};
