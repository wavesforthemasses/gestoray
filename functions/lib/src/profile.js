"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileEmail = exports.updateProfile = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const search_utils_1 = require("./search-utils");
const REGION = 'europe-west3';
/**
 * updateProfile
 * Modifies the user's own profile details.
 */
exports.updateProfile = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Devi essere autenticato.');
    }
    const { uid, email, nome, cognome } = request.data;
    if (!uid || !email || !nome || !cognome) {
        throw new https_1.HttpsError('invalid-argument', 'UID, email, nome e cognome sono obbligatori.');
    }
    // Ensure user can only update their own profile
    if (request.auth.uid !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Non sei autorizzato a modificare questo profilo.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    const cleanCognome = cognome.trim();
    if (!cleanNome || !cleanCognome) {
        throw new https_1.HttpsError('invalid-argument', 'Nome e cognome non possono essere vuoti.');
    }
    const db = admin.firestore();
    const auth = admin.auth();
    try {
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Profilo utente non trovato.');
        }
        const userData = userDoc.data() || {};
        const userOriginal = userData.original || userData || {};
        // Check email uniqueness if email is changed
        if (userOriginal.email !== cleanEmail) {
            const duplicateQuery = await db.collection('users').where('original.email', '==', cleanEmail).get();
            if (!duplicateQuery.empty) {
                throw new https_1.HttpsError('already-exists', "L'indirizzo email inserito è già registrato da un altro account.");
            }
            await auth.updateUser(uid, { email: cleanEmail });
        }
        const existingDerived = userData.derived || {};
        // Save profile update
        await userDocRef.set({
            original: {
                nome: cleanNome,
                cognome: cleanCognome,
                email: cleanEmail,
                roles: userOriginal.roles || [],
                qualification: userOriginal.qualification || 'junior'
            },
            derived: {
                totalContractsCount: existingDerived.totalContractsCount || 0,
                totalApprovedSales: existingDerived.totalApprovedSales || 0,
                totalPendingSales: existingDerived.totalPendingSales || 0,
                totalCommissionEarned: existingDerived.totalCommissionEarned || 0,
                totalCommissionPending: existingDerived.totalCommissionPending || 0,
                totalClientsCreated: existingDerived.totalClientsCreated || 0,
                totalNNCF: existingDerived.totalNNCF || 0,
                textSearch: (0, search_utils_1.generateSearchTerms)(cleanNome, cleanCognome, cleanEmail)
            },
            edits: {
                createdAt: userData.edits?.createdAt || userData.createdAt || new Date().toISOString(),
                createdBy: userData.edits?.createdBy || 'system',
                modifiedAt: new Date().toISOString(),
                modifiedBy: request.auth.uid
            }
        });
        logger.info(`[PROFILE UPDATE] Profile updated for UID ${uid}: ${cleanNome} ${cleanCognome} (${cleanEmail})`);
        return { success: true, email: cleanEmail, nome: cleanNome, cognome: cleanCognome };
    }
    catch (error) {
        logger.error('Error in updateProfile:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message || 'Errore interno durante la modifica del profilo.');
    }
});
/**
 * updateProfileEmail
 * Modifies user's profile email.
 */
exports.updateProfileEmail = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Devi essere autenticato.');
    }
    const { uid, newEmail } = request.data;
    if (!uid || !newEmail) {
        throw new https_1.HttpsError('invalid-argument', 'UID ed email sono campi obbligatori.');
    }
    if (request.auth.uid !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Non sei autorizzato a modificare questa email.');
    }
    const cleanEmail = newEmail.trim().toLowerCase();
    const db = admin.firestore();
    const auth = admin.auth();
    try {
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Profilo utente non trovato.');
        }
        const userData = userDoc.data() || {};
        const userOriginal = userData.original || userData || {};
        if (userOriginal.email === cleanEmail) {
            throw new https_1.HttpsError('invalid-argument', 'Il nuovo indirizzo email deve essere diverso da quello attuale.');
        }
        const duplicateQuery = await db.collection('users').where('original.email', '==', cleanEmail).get();
        if (!duplicateQuery.empty) {
            throw new https_1.HttpsError('already-exists', "L'indirizzo email inserito è già registrato da un altro account.");
        }
        await userDocRef.set({
            original: {
                ...userOriginal,
                email: cleanEmail
            },
            derived: userData.derived || {
                totalContractsCount: 0,
                totalApprovedSales: 0,
                totalPendingSales: 0,
                totalCommissionEarned: 0,
                totalCommissionPending: 0,
                totalClientsCreated: 0,
                totalNNCF: 0
            },
            edits: {
                createdAt: userData.edits?.createdAt || userData.createdAt || new Date().toISOString(),
                createdBy: userData.edits?.createdBy || 'system',
                modifiedAt: new Date().toISOString(),
                modifiedBy: request.auth.uid
            }
        });
        await auth.updateUser(uid, { email: cleanEmail });
        logger.info(`[PROFILE EMAIL UPDATE] Updated UID ${uid}: ${userOriginal.email} -> ${cleanEmail}`);
        return { success: true, email: cleanEmail };
    }
    catch (error) {
        logger.error('Error in updateProfileEmail:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message || 'Errore interno durante la modifica dell\'email.');
    }
});
//# sourceMappingURL=profile.js.map