import { writable } from 'svelte/store';

class MockAuth {
  currentUser: any = null;
  private listeners: any[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('mock_firebase_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    }
  }

  onAuthStateChanged(callback: any) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signInWithCustomToken(token: string) {
    const uid = token.replace('mock-token-', '');
    
    const response = await fetch('/api/mock-db');
    const dbData = await response.json();
    const userProfile = dbData.users?.[uid];

    if (!userProfile) {
      throw new Error('Profilo utente non trovato nel database simulato.');
    }

    this.currentUser = {
      uid,
      email: userProfile.email
    };

    localStorage.setItem('mock_firebase_user', JSON.stringify(this.currentUser));
    this.listeners.forEach(l => l(this.currentUser));
    return { user: this.currentUser };
  }

  async updateEmail(newEmail: string) {
    if (!this.currentUser) throw new Error('Utente non autenticato.');
    const uid = this.currentUser.uid;

    const response = await fetch('/api/profile/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, newEmail })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Errore durante la modifica dell\'email.');
    }

    this.currentUser.email = newEmail;
    localStorage.setItem('mock_firebase_user', JSON.stringify(this.currentUser));
    this.listeners.forEach(l => l(this.currentUser));
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('mock_firebase_user');
    this.listeners.forEach(l => l(null));
  }
}

class MockFirestore {
  async getDoc(docRef: any) {
    const { path } = docRef;
    const parts = path.split('/');
    const collection = parts[0];
    const id = parts[1];

    const response = await fetch('/api/mock-db');
    const dbData = await response.json();
    const docData = dbData[collection]?.[id];

    return {
      exists: () => docData !== undefined,
      data: () => docData
    };
  }

  async setDoc(docRef: any, data: any) {
    const { path } = docRef;
    const parts = path.split('/');
    const collection = parts[0];
    const id = parts[1];

    await fetch('/api/mock-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set',
        collection,
        id,
        data
      })
    });
  }

  async getDocs(colRef: any) {
    const { path } = colRef;
    const response = await fetch('/api/mock-db');
    const dbData = await response.json();
    const collectionData = dbData[path] || {};
    
    const docs = Object.keys(collectionData).map(id => ({
      id,
      data: () => collectionData[id]
    }));

    return {
      forEach: (callback: any) => docs.forEach(callback)
    };
  }
}

export const auth = new MockAuth();
export const db = new MockFirestore();

export function doc(dbInstance: any, collection: string, id: string) {
  return { path: `${collection}/${id}` };
}

export function collection(dbInstance: any, path: string) {
  return { path };
}

export async function getDoc(docRef: any) {
  return db.getDoc(docRef);
}

export async function setDoc(docRef: any, data: any) {
  return db.setDoc(docRef, data);
}

export async function getDocs(colRef: any) {
  return db.getDocs(colRef);
}

export function onAuthStateChanged(authInstance: any, callback: any) {
  return authInstance.onAuthStateChanged(callback);
}

export async function signInWithCustomToken(authInstance: any, token: string) {
  return authInstance.signInWithCustomToken(token);
}

export async function signOut(authInstance: any) {
  return authInstance.signOut();
}

export async function updateEmail(userInstance: any, newEmail: string) {
  return auth.updateEmail(newEmail);
}
