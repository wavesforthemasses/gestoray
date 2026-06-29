"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLoginPin = exports.sendLoginPin = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const REGION = 'europe-west3';
/**
 * sendLoginPin
 * Generates and writes the verification PIN to Firestore.
 */
exports.sendLoginPin = (0, https_1.onCall)({ region: REGION }, async (request) => {
    const { email } = request.data;
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', "L'email è un parametro obbligatorio.");
    }
    const cleanEmail = email.trim().toLowerCase();
    const db = admin.firestore();
    try {
        // Verify that the user exists in the Firestore database
        const usersCollection = db.collection('users');
        const querySnapshot = await usersCollection.where('original.email', '==', cleanEmail).get();
        if (querySnapshot.empty) {
            throw new https_1.HttpsError('not-found', 'Questo indirizzo email non è registrato.');
        }
        // Generate 6-digit PIN and expiry date (5 minutes)
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        await db.collection('login_pins').doc(cleanEmail).set({
            pin,
            expiresAt
        });
        logger.info(`[LOGIN PIN FOR ${cleanEmail}]: ${pin}`);
        // If running in local emulator or debug mode, return the PIN directly to the client
        const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
        return {
            success: true,
            email: cleanEmail,
            debugPin: isEmulator ? pin : null
        };
    }
    catch (error) {
        logger.error('Error in sendLoginPin:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message || 'Errore interno durante la generazione del PIN.');
    }
});
/**
 * verifyLoginPin
 * Verifies the PIN and returns a secure Custom Token.
 */
exports.verifyLoginPin = (0, https_1.onCall)({ region: REGION }, async (request) => {
    const { email, pin } = request.data;
    if (!email || !pin) {
        throw new https_1.HttpsError('invalid-argument', 'Email e PIN sono parametri obbligatori.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();
    const db = admin.firestore();
    const auth = admin.auth();
    try {
        const pinDoc = await db.collection('login_pins').doc(cleanEmail).get();
        if (!pinDoc.exists) {
            throw new https_1.HttpsError('failed-precondition', 'Nessun PIN richiesto per questa email.');
        }
        const pinData = pinDoc.data();
        if (pinData?.pin !== cleanPin) {
            throw new https_1.HttpsError('invalid-argument', 'Il PIN inserito non è corretto.');
        }
        if (Date.now() > pinData?.expiresAt) {
            throw new https_1.HttpsError('deadline-exceeded', 'Il PIN è scaduto. Richiedine uno nuovo.');
        }
        // Delete the verified PIN
        await db.collection('login_pins').doc(cleanEmail).delete();
        // Fetch user UID from Firestore
        const usersCollection = db.collection('users');
        const querySnapshot = await usersCollection.where('original.email', '==', cleanEmail).get();
        if (querySnapshot.empty) {
            throw new https_1.HttpsError('not-found', "Impossibile trovare l'utente nel database.");
        }
        const uid = querySnapshot.docs[0].id;
        // Generate Custom Auth Token
        const customToken = await auth.createCustomToken(uid);
        return {
            success: true,
            customToken
        };
    }
    catch (error) {
        logger.error('Error in verifyLoginPin:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message || 'Errore durante la verifica del PIN.');
    }
});
//# sourceMappingURL=auth.js.map