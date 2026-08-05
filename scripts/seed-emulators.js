// Node.js v18+ native fetch is used

const AUTH_URL = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
const FIRESTORE_URL = 'http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents';

const TEST_USERS = [
  { email: 'test-admin@app.local', role: 'amministrazione', nome: 'Admin', cognome: 'Amministrazione' },
  { email: 'test-super@app.local', role: 'superadmin', nome: 'Super', cognome: 'Admin' },
  { email: 'test-comm@app.local', role: 'commerciale', nome: 'Mario', cognome: 'Rossi' },
  { email: 'test-direzione@app.local', role: 'direzione', nome: 'Elena', cognome: 'Verdi' }
];

async function seedUser(user) {
  const { email, role, nome, cognome } = user;
  let uid = '';

  // 1. Create in Auth Emulator
  try {
    const res = await fetch(`${AUTH_URL}:signUp?key=fake-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', returnSecureToken: true })
    });
    
    if (res.ok) {
      const data = await res.json();
      uid = data.localId;
    } else {
      // If user exists, fetch UID via signIn
      const signInRes = await fetch(`${AUTH_URL}:signInWithPassword?key=fake-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123', returnSecureToken: true })
      });
      if (signInRes.ok) {
        const signInData = await signInRes.json();
        uid = signInData.localId;
      }
    }
  } catch (err) {
    console.error(`❌ Errore durante l'autenticazione per ${email}:`, err.message);
    return;
  }

  if (!uid) {
    console.error(`❌ Impossibile ottenere UID per ${email}`);
    return;
  }

  // 2. Create/Update in Firestore Emulator
  const docUrl = `${FIRESTORE_URL}/users/${uid}`;
  const firestoreRes = await fetch(docUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner'
    },
    body: JSON.stringify({
      fields: {
        original: {
          mapValue: {
            fields: {
              email: { stringValue: email },
              nome: { stringValue: nome },
              cognome: { stringValue: cognome },
              roles: {
                arrayValue: {
                  values: [{ stringValue: role }]
                }
              }
            }
          }
        }
      }
    })
  });

  if (firestoreRes.ok) {
    console.log(`  ✅ Utente popolato: ${email} (Ruolo: ${role})`);
  } else {
    const errText = await firestoreRes.text();
    console.error(`  ❌ Errore popolamento Firestore per ${email}:`, errText);
  }
}

async function seedSettings() {
  const url = `${FIRESTORE_URL}/settings/project`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner'
    },
    body: JSON.stringify({
      fields: {
        projectName: { stringValue: 'ERP Dev' },
        projectEmail: { stringValue: 'admin@app.local' }
      }
    })
  });
  console.log('  ✅ Impostazioni di progetto inizializzate');
}

async function main() {
  console.log('');
  console.log('🌱 Popolamento Dati Iniziali negli Emulatori Firebase...');
  console.log('─'.repeat(50));

  try {
    for (const user of TEST_USERS) {
      await seedUser(user);
    }
    await seedSettings();
    console.log('─'.repeat(50));
    console.log('✨ Popolamento completato con successo!');
    console.log('');
  } catch (err) {
    console.error('❌ Errore durante il popolamento:', err);
  }
}

main();
