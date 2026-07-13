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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app) as any;
export const db = getFirestore(app) as any;
export const storage = getStorage(app) as any;
export const functions = getFunctions(app, 'europe-west3') as any;

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export function doc(dbInstance: any, collectionName: string, id: string, ...moreSegments: string[]): any {
  return fbDoc(dbInstance, collectionName, id, ...moreSegments) as any;
}

export function collection(dbInstance: any, path: string, ...moreSegments: string[]): any {
  return fbCollection(dbInstance, path, ...moreSegments) as any;
}

export async function getDoc(docRef: any): Promise<any> {
  return fbGetDoc(docRef) as any;
}

export async function setDoc(docRef: any, data: any, options?: any): Promise<any> {
  return options ? fbSetDoc(docRef, data, options) as any : fbSetDoc(docRef, data) as any;
}

export async function getDocs(colRef: any): Promise<any> {
  return fbGetDocs(colRef) as any;
}

export async function updateDoc(docRef: any, data: any): Promise<any> {
  return fbUpdateDoc(docRef, data) as any;
}

export async function deleteDoc(docRef: any): Promise<any> {
  return fbDeleteDoc(docRef) as any;
}

export function query(colRef: any, ...constraints: any[]): any {
  return fbQuery(colRef, ...constraints) as any;
}

export function where(field: string, opStr: any, value: any): any {
  return fbWhere(field, opStr, value) as any;
}

export function ref(storageInstance: any, path: string): any {
  return fbRef(storageInstance, path) as any;
}

export async function uploadBytes(refInstance: any, data: any): Promise<any> {
  return fbUploadBytes(refInstance, data) as any;
}

export async function getDownloadURL(refInstance: any): Promise<any> {
  return fbGetDownloadURL(refInstance) as any;
}

export async function deleteObject(refInstance: any): Promise<any> {
  return fbDeleteObject(refInstance) as any;
}

export function onAuthStateChanged(authInstance: any, callback: any): any {
  return fbOnAuthStateChanged(authInstance, callback) as any;
}

export async function signInWithCustomToken(authInstance: any, token: string): Promise<any> {
  return fbSignInWithCustomToken(authInstance, token) as any;
}

export async function signOut(authInstance: any): Promise<any> {
  return fbSignOut(authInstance) as any;
}

export function httpsCallable(functionsInstance: any, name: string): any {
  return fbHttpsCallable(functionsInstance, name) as any;
}

export async function updateEmail(userInstance: any, newEmail: string): Promise<any> {
  // Use Cloud Function for updating email
  const updateEmailCallable = httpsCallable(functions, 'updateProfileEmail');
  const result = await updateEmailCallable({ uid: userInstance.uid, newEmail });
  
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
  or
} from 'firebase/firestore';
