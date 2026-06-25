import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminAuth, adminDb } from '$lib/firebase-admin';

export const GET: RequestHandler = async () => {
  try {
    const email = 'wavesforthemasses@gmail.com';
    const usersCollection = adminDb.collection('users');
    
    const querySnapshot = await usersCollection.where('email', '==', email).get();
    
    if (!querySnapshot.empty) {
      return json({
        status: 'already_exists',
        message: `Admin user ${email} already exists in Firestore.`
      });
    }
    
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      console.log(`Found existing Auth user for ${email} with UID: ${userRecord.uid}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: email,
          emailVerified: true
        });
        console.log(`Created new Auth user for ${email} with UID: ${userRecord.uid}`);
      } else {
        throw authError;
      }
    }
    await usersCollection.doc(userRecord.uid).set({
      email: email,
      nome: 'Super',
      cognome: 'Admin',
      roles: ['superadmin'],
      createdAt: new Date().toISOString()
    });
    
    return json({
      status: 'success',
      message: `Admin user ${email} successfully created in Auth and Firestore.`,
      uid: userRecord.uid
    });
  } catch (error: any) {
    console.error('Error during /init:', error);
    return json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
};
