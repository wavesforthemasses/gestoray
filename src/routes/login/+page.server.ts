import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { adminAuth, adminDb } from '$lib/firebase-admin';

export const actions: Actions = {
  sendPin: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim().toLowerCase();

    if (!email) {
      return fail(400, { error: 'L\'email è obbligatoria.' });
    }

    try {
      const usersCollection = adminDb.collection('users');
      const querySnapshot = await usersCollection.where('email', '==', email).get();

      if (querySnapshot.empty) {
        return fail(404, { error: 'Questo indirizzo email non è registrato.' });
      }

      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000;

      await adminDb.collection('login_pins').doc(email).set({
        pin,
        expiresAt
      });

      console.log('\n=============================================');
      console.log(`[LOCAL LOGIN PIN FOR ${email}]: ${pin}`);
      console.log('=============================================\n');

      return { success: true, email, debugPin: pin };
    } catch (error: any) {
      console.error('Error in sendPin action:', error);
      return fail(500, { error: error.message });
    }
  },

  verifyPin: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim().toLowerCase();
    const pin = data.get('pin')?.toString().trim();

    if (!email || !pin) {
      return fail(400, { error: 'Campi mancanti.' });
    }

    try {
      const pinDoc = await adminDb.collection('login_pins').doc(email).get();

      if (!pinDoc.exists) {
        return fail(400, { error: 'Nessun PIN richiesto per questa email.' });
      }

      const pinData = pinDoc.data();

      if (pinData?.pin !== pin) {
        return fail(400, { error: 'Il PIN inserito non è corretto.' });
      }

      if (Date.now() > pinData?.expiresAt) {
        return fail(400, { error: 'Il PIN è scaduto. Richiedine uno nuovo.' });
      }

      await adminDb.collection('login_pins').doc(email).delete();

      const usersCollection = adminDb.collection('users');
      const querySnapshot = await usersCollection.where('email', '==', email).get();
      
      if (querySnapshot.empty) {
        return fail(404, { error: 'Impossibile trovare l\'utente in Firestore.' });
      }

      const uid = querySnapshot.docs[0].id;
      const customToken = await adminAuth.createCustomToken(uid);

      return { success: true, customToken };
    } catch (error: any) {
      console.error('Error in verifyPin action:', error);
      return fail(500, { error: error.message });
    }
  }
};
