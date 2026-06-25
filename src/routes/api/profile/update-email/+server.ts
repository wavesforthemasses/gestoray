import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminAuth, adminDb } from '$lib/firebase-admin';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { uid, newEmail } = await request.json();
    
    if (!uid || !newEmail) {
      return json({ message: 'UID ed email sono campi obbligatori.' }, { status: 400 });
    }

    const cleanEmail = newEmail.trim().toLowerCase();

    const userDocRef = adminDb.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return json({ message: 'Utente non trovato nel database.' }, { status: 404 });
    }

    const userData = userDoc.data();

    if (userData.email === cleanEmail) {
      return json({ message: 'Il nuovo indirizzo email deve essere diverso da quello attuale.' }, { status: 400 });
    }

    const duplicateQuery = await adminDb.collection('users').where('email', '==', cleanEmail).get();
    
    if (!duplicateQuery.empty) {
      return json({ message: 'L\'indirizzo email inserito è già registrato da un altro account.' }, { status: 400 });
    }

    await userDocRef.set({
      ...userData,
      email: cleanEmail,
      updatedAt: new Date().toISOString()
    });

    await adminAuth.updateUser(uid, { email: cleanEmail });

    console.log(`[PROFILE] Email updated for UID ${uid}: ${userData.email} -> ${cleanEmail}`);

    return json({ success: true, email: cleanEmail });
  } catch (error: any) {
    console.error('Error during update-email API:', error);
    return json({ message: error.message || 'Errore interno del server.' }, { status: 500 });
  }
};
