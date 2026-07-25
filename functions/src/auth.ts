import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { sendEmailViaResend } from './email';

const REGION = 'europe-west3';

/**
 * sendLoginPin
 * Generates and writes the verification PIN to Firestore.
 */
export const sendLoginPin = onCall({ region: REGION }, async (request) => {
  const { email } = request.data;
  if (!email) {
    throw new HttpsError('invalid-argument', "L'email è un parametro obbligatorio.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = admin.firestore();

  try {
    // Verify that the user exists in the Firestore database
    const usersCollection = db.collection('users');
    const querySnapshot = await usersCollection.where('original.email', '==', cleanEmail).get();

    if (querySnapshot.empty) {
      throw new HttpsError('not-found', 'Questo indirizzo email non è registrato.');
    }

    // Generate 6-digit PIN and expiry date (5 minutes)
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await db.collection('login_pins').doc(cleanEmail).set({
      pin,
      expiresAt
    });

    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

    // Check if API key exists in settings or config
    let hasApiKey = false;
    try {
      const projectSnap = await db.collection('settings').doc('project').get();
      const resendApiKey = projectSnap.exists ? projectSnap.data()?.resendApiKey : null;
      hasApiKey = !!resendApiKey || (!!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_YOUR_KEY_HERE');
    } catch (e) {
      logger.error('Error fetching project settings for API Key', e);
    }
    
    if (isEmulator || !hasApiKey) {
      logger.info(`[LOGIN PIN FOR ${cleanEmail}]: ${pin}`);
    }
    
    if (!isEmulator) {
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Codice di Accesso</h2>
          <p>Il tuo codice PIN per accedere è:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #2563eb;">${pin}</h1>
          <p>Questo codice scadrà tra 5 minuti.</p>
        </div>
      `;
      await sendEmailViaResend(cleanEmail, 'Codice di Accesso', html);
    }

    // If running in local emulator or debug mode, return the PIN directly to the client
    return {
      success: true,
      email: cleanEmail,
      debugPin: isEmulator ? pin : null
    };
  } catch (error: any) {
    logger.error('Error in sendLoginPin:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Errore interno durante la generazione del PIN.');
  }
});

/**
 * verifyLoginPin
 * Verifies the PIN and returns a secure Custom Token.
 */
export const verifyLoginPin = onCall({ region: REGION }, async (request) => {
  const { email, pin } = request.data;
  if (!email || !pin) {
    throw new HttpsError('invalid-argument', 'Email e PIN sono parametri obbligatori.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();
  const db = admin.firestore();
  const auth = admin.auth();

  try {
    const pinDoc = await db.collection('login_pins').doc(cleanEmail).get();

    if (!pinDoc.exists) {
      throw new HttpsError('failed-precondition', 'Nessun PIN richiesto per questa email.');
    }

    const pinData = pinDoc.data();
    const currentAttempts = pinData?.attempts || 0;

    if (currentAttempts >= 5) {
      await db.collection('login_pins').doc(cleanEmail).delete();
      throw new HttpsError('resource-exhausted', 'Troppi tentativi errati. Il PIN è stato annullato, richiedine uno nuovo.');
    }

    if (Date.now() > pinData?.expiresAt) {
      await db.collection('login_pins').doc(cleanEmail).delete();
      throw new HttpsError('deadline-exceeded', 'Il PIN è scaduto. Richiedine uno nuovo.');
    }

    if (pinData?.pin !== cleanPin) {
      const newAttempts = currentAttempts + 1;
      if (newAttempts >= 5) {
        await db.collection('login_pins').doc(cleanEmail).delete();
        throw new HttpsError('resource-exhausted', 'Troppi tentativi errati. Il PIN è stato annullato, richiedine uno nuovo.');
      } else {
        await db.collection('login_pins').doc(cleanEmail).update({ attempts: newAttempts });
        throw new HttpsError('invalid-argument', `PIN non corretto. Tentativi rimasti: ${5 - newAttempts}.`);
      }
    }

    // Delete the verified PIN immediately to prevent replay attacks
    await db.collection('login_pins').doc(cleanEmail).delete();

    // Fetch user UID from Firestore
    const usersCollection = db.collection('users');
    const querySnapshot = await usersCollection.where('original.email', '==', cleanEmail).get();

    if (querySnapshot.empty) {
      throw new HttpsError('not-found', "Impossibile trovare l'utente nel database.");
    }

    const uid = querySnapshot.docs[0].id;

    // Generate Custom Auth Token
    const customToken = await auth.createCustomToken(uid);

    return {
      success: true,
      customToken
    };
  } catch (error: any) {
    logger.error('Error in verifyLoginPin:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Errore durante la verifica del PIN.');
  }
});
