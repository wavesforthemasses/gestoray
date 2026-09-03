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

async function seedSampleInvoice() {
  // 1. Seed Client
  await fetch(`${FIRESTORE_URL}/clients/cli_edilizia`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner'
    },
    body: JSON.stringify({
      fields: {
        name: { stringValue: 'Edil Costruzioni Srl' },
        ragioneSociale: { stringValue: 'Edil Costruzioni Srl' },
        piva: { stringValue: 'IT09876543210' },
        codiceSdi: { stringValue: 'M5UXCR1' },
        pec: { stringValue: 'edil@pec.it' },
        citta: { stringValue: 'Milano' },
        indirizzo: { stringValue: 'Via Garibaldi 10' },
        cap: { stringValue: '20100' },
        provincia: { stringValue: 'MI' }
      }
    })
  });

  // 2. Seed Invoice
  await fetch(`${FIRESTORE_URL}/invoices/inv_001`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner'
    },
    body: JSON.stringify({
      fields: {
        invoiceNumber: { stringValue: '1/2026' },
        number: { integerValue: '1' },
        year: { integerValue: '2026' },
        sezionaleId: { stringValue: 'default' },
        sezionaleCode: { stringValue: '' },
        type: { stringValue: 'TD01' },
        status: { stringValue: 'emessa' },
        date: { stringValue: '2026-09-03' },
        dueDate: { stringValue: '2026-10-03' },
        clientId: { stringValue: 'cli_edilizia' },
        clientName: { stringValue: 'Edil Costruzioni Srl' },
        clientVatNumber: { stringValue: 'IT09876543210' },
        clientSdiCode: { stringValue: 'M5UXCR1' },
        clientPec: { stringValue: 'edil@pec.it' },
        clientAddress: { stringValue: 'Via Garibaldi 10' },
        clientCap: { stringValue: '20100' },
        clientCity: { stringValue: 'Milano' },
        clientProvince: { stringValue: 'MI' },
        totalNet: { doubleValue: 2000.0 },
        totalVat: { doubleValue: 380.0 },
        totalGross: { doubleValue: 2380.0 },
        netToPay: { doubleValue: 2380.0 },
        paymentStatus: { stringValue: 'non_pagata' },
        paidAmount: { doubleValue: 0.0 },
        remainingAmount: { doubleValue: 2380.0 },
        paymentMethod: { stringValue: 'bonifico' },
        iban: { stringValue: 'IT02L0306909606100000012345' },
        notes: { stringValue: 'Pagamento 30 giorni data fattura.' },
        lines: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    id: { stringValue: 'l1' },
                    description: { stringValue: 'Manutenzione impianto elettrico cantiere' },
                    quantity: { doubleValue: 1.0 },
                    unitPrice: { doubleValue: 1500.0 },
                    vatRate: { doubleValue: 22.0 },
                    netAmount: { doubleValue: 1500.0 },
                    vatAmount: { doubleValue: 330.0 },
                    grossAmount: { doubleValue: 1830.0 }
                  }
                }
              },
              {
                mapValue: {
                  fields: {
                    id: { stringValue: 'l2' },
                    description: { stringValue: 'Fornitura cavi e quadri certificati' },
                    quantity: { doubleValue: 2.0 },
                    unitPrice: { doubleValue: 250.0 },
                    vatRate: { doubleValue: 10.0 },
                    netAmount: { doubleValue: 500.0 },
                    vatAmount: { doubleValue: 50.0 },
                    grossAmount: { doubleValue: 550.0 }
                  }
                }
              }
            ]
          }
        },
        castelletto: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    rate: { doubleValue: 22.0 },
                    taxableAmount: { doubleValue: 1500.0 },
                    vatAmount: { doubleValue: 330.0 }
                  }
                }
              },
              {
                mapValue: {
                  fields: {
                    rate: { doubleValue: 10.0 },
                    taxableAmount: { doubleValue: 500.0 },
                    vatAmount: { doubleValue: 50.0 }
                  }
                }
              }
            ]
          }
        }
      }
    })
  });
  console.log('  ✅ Cliente e Fattura di test inizializzati');
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
    await seedSampleInvoice();
    console.log('─'.repeat(50));
    console.log('✨ Popolamento completato con successo!');
    console.log('');
  } catch (err) {
    console.error('❌ Errore durante il popolamento:', err);
  }
}

main();
