import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminAuth, adminDb } from '$lib/firebase-admin';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { uid, email, roles, nome, cognome } = await request.json();
    
    if (!uid || !email || !roles || !nome || !cognome) {
      return json({ message: 'UID, email, ruoli, nome e cognome sono obbligatori.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    const userDocRef = adminDb.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return json({ message: 'Utente non trovato nel database.' }, { status: 404 });
    }

    const userData = userDoc.data();

    if (userData.email !== cleanEmail) {
      const duplicateQuery = await adminDb.collection('users').where('email', '==', cleanEmail).get();
      if (!duplicateQuery.empty) {
        return json({ message: 'L\'indirizzo email inserito è già registrato da un altro account.' }, { status: 400 });
      }
      
      await adminAuth.updateUser(uid, { email: cleanEmail });
    }

    await userDocRef.set({
      ...userData,
      nome: nome.trim(),
      cognome: cognome.trim(),
      email: cleanEmail,
      roles: roles,
      updatedAt: new Date().toISOString()
    });

    console.log(`[USER UPDATE] Account updated for UID ${uid}: ${cleanEmail} (Roles: ${roles.join(', ')})`);

    return json({ success: true, email: cleanEmail, roles });
  } catch (error: any) {
    console.error('Error during users/update API:', error);
    return json({ message: error.message || 'Errore interno del server.' }, { status: 500 });
  }
};
