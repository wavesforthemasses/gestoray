import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { generateSearchTerms } from './search-utils';

const REGION = 'europe-west3';

/**
 * Helper: checkAdminPermissions
 * Verifies if the authenticated caller has administrative rights (superadmin or amministrazione)
 */
async function checkAdminPermissions(callerUid: string, db: admin.firestore.Firestore) {
  const callerDoc = await db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new HttpsError('permission-denied', 'Utente chiamante non trovato.');
  }
  const callerData = callerDoc.data() || {};
  const callerOriginal = callerData.original || callerData || {};
  const roles = callerOriginal.roles || [];
  if (!roles.includes('superadmin') && !roles.includes('amministrazione')) {
    throw new HttpsError('permission-denied', 'Permesso negato: diritti amministrativi richiesti.');
  }
  return callerData;
}

/**
 * initSuperAdmin
 * Seeds the initial superadmin user: wavesforthemasses@gmail.com
 */
export const initSuperAdmin = onCall({ region: REGION }, async (request) => {
  const email = 'wavesforthemasses@gmail.com';
  const db = admin.firestore();
  const auth = admin.auth();

  try {
    // Check if user already exists in Firestore
    const usersCollection = db.collection('users');
    const querySnapshot = await usersCollection.where('original.email', '==', email).get();

    if (!querySnapshot.empty) {
      throw new HttpsError('already-exists', `L'utente amministratore ${email} è già presente nel database.`);
    }

    // Get or create Auth user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      logger.info(`Found existing Auth user for ${email} with UID: ${userRecord.uid}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: email,
          emailVerified: true
        });
        logger.info(`Created new Auth user for ${email} with UID: ${userRecord.uid}`);
      } else {
        throw new HttpsError('internal', authError.message);
      }
    }

    // Write profile to Firestore with namespaces
    await usersCollection.doc(userRecord.uid).set({
      original: {
        email: email,
        nome: 'Super',
        cognome: 'Admin',
        roles: ['superadmin'],
        qualification: 'junior'
      },
      derived: {
        totalContractsCount: 0,
        totalApprovedSales: 0,
        totalPendingSales: 0,
        totalCommissionEarned: 0,
        totalCommissionPending: 0,
        totalClientsCreated: 0,
        totalNNCF: 0,
        textSearch: generateSearchTerms('Super Admin wavesforthemasses@gmail.com')
      },
      edits: {
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      }
    });

    return {
      status: 'success',
      message: `Utente amministratore ${email} inizializzato con successo.`,
      uid: userRecord.uid
    };
  } catch (error: any) {
    logger.error('Error during initSuperAdmin:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Errore interno del server.');
  }
});

/**
 * updateUser
 * Modifies user details and roles (admin-only).
 */
export const updateUser = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Devi essere autenticato.');
  }

  const { uid, email, roles, nome, cognome, qualification, supervisorUid } = request.data;
  if (!uid || !email || !roles || !nome || !cognome) {
    throw new HttpsError('invalid-argument', 'Parametri mancanti per la modifica utente.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = admin.firestore();
  const auth = admin.auth();

  try {
    // 1. Verify caller has admin rights
    await checkAdminPermissions(request.auth.uid, db);

    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Utente da modificare non trovato.');
    }

    const userData = userDoc.data() || {};
    const userOriginal = userData.original || userData || {};

    // 2. If email changed, check uniqueness and update in Auth
    if (userOriginal.email !== cleanEmail) {
      const duplicateQuery = await db.collection('users').where('original.email', '==', cleanEmail).get();
      if (!duplicateQuery.empty) {
        throw new HttpsError('already-exists', "L'indirizzo email inserito è già registrato da un altro account.");
      }
      await auth.updateUser(uid, { email: cleanEmail });
    }

    // 3. Save profile changes to Firestore
    await userDocRef.set({
      original: {
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: cleanEmail,
        roles: roles,
        qualification: qualification || userOriginal.qualification || '',
        supervisorUid: supervisorUid || userOriginal.supervisorUid || ''
      },
      derived: {
        ...(userData.derived || {
          totalContractsCount: 0,
          totalApprovedSales: 0,
          totalPendingSales: 0,
          totalCommissionEarned: 0,
          totalCommissionPending: 0,
          totalClientsCreated: 0,
          totalNNCF: 0
        }),
        textSearch: generateSearchTerms(nome.trim() + ' ' + cognome.trim() + ' ' + cleanEmail)
      },
      edits: {
        createdAt: userData.edits?.createdAt || userData.createdAt || new Date().toISOString(),
        createdBy: userData.edits?.createdBy || 'system',
        modifiedAt: new Date().toISOString(),
        modifiedBy: request.auth.uid
      }
    });

    logger.info(`[ADMIN USER UPDATE] Updated UID ${uid}: ${cleanEmail} (Roles: ${roles.join(', ')})`);
    return { success: true, email: cleanEmail, roles };
  } catch (error: any) {
    logger.error('Error in updateUser:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Errore interno durante la modifica utente.');
  }
});
