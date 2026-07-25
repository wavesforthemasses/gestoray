import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged as fbOnAuthStateChanged, 
  signInWithCustomToken as fbSignInWithCustomToken, 
  signOut as fbSignOut,
  reload,
  connectAuthEmulator
} from 'firebase/auth';
import { 
  getFirestore, 
  doc as fbDoc, 
  collection as fbCollection, 
  getDoc as fbGetDoc, 
  setDoc as fbSetDoc, 
  getDocs as fbGetDocs, 
  updateDoc as fbUpdateDoc, 
  deleteDoc as fbDeleteDoc,
  connectFirestoreEmulator,
  query as fbQuery,
  where as fbWhere
} from 'firebase/firestore';
import { 
  getStorage, 
  ref as fbRef, 
  uploadBytes as fbUploadBytes, 
  getDownloadURL as fbGetDownloadURL,
  deleteObject as fbDeleteObject
} from 'firebase/storage';
import { 
  getFunctions, 
  httpsCallable as fbHttpsCallable,
  connectFunctionsEmulator
} from 'firebase/functions';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {}) as Record<string, any>;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'fake-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'fake-domain',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'fake-project',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'fake-bucket',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '12345678',
  appId: env.VITE_FIREBASE_APP_ID || '1:1234:web:1234'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west3');

if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { 
  fbDoc as doc, 
  fbCollection as collection, 
  fbGetDoc as getDoc, 
  fbSetDoc as setDoc, 
  fbGetDocs as getDocs, 
  fbUpdateDoc as updateDoc, 
  fbDeleteDoc as deleteDoc, 
  fbQuery as query, 
  fbWhere as where,
  fbRef as ref,
  fbUploadBytes as uploadBytes,
  fbGetDownloadURL as getDownloadURL,
  fbDeleteObject as deleteObject,
  fbOnAuthStateChanged as onAuthStateChanged,
  fbSignInWithCustomToken as signInWithCustomToken,
  fbSignOut as signOut,
  fbHttpsCallable as httpsCallable
};

export async function updateEmail(userInstance: any, newEmail: string): Promise<any> {
  // Use Cloud Function for updating email
  const updateEmailCallable = fbHttpsCallable(functions, 'updateProfileEmail');
  const result = (await updateEmailCallable({ uid: userInstance.uid, newEmail })) as any;
  
  // Reload client auth session to reflect email update
  await reload(userInstance);
  return result.data;
}

export { 
  getCountFromServer, 
  getAggregateFromServer, 
  sum, 
  count, 
  orderBy, 
  limit, 
  startAfter, 
  collectionGroup, 
  addDoc, 
  Timestamp,
  deleteField,
  increment,
  or,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
