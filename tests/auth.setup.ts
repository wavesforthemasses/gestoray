import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';

const authEmulatorUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key';
const firestoreEmulatorUrl = 'http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/users';

async function seedUser(email: string, role: string) {
  // 1. Create User in Auth Emulator
  const authRes = await fetch(authEmulatorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'password123',
      returnSecureToken: true
    })
  });
  
  if (!authRes.ok) {
    const errorText = await authRes.text();
    // Ignore if user already exists
    if (!errorText.includes('EMAIL_EXISTS')) {
      throw new Error(`Failed to create user in Auth Emulator: ${errorText}`);
    }
  }

  // Get UID. If they already existed, we need to sign in to get the localId, 
  // but it's easier to just sign in since signUp acts as signIn if user exists? No, signUp fails.
  // Let's use signInWithPassword to get the UID if exists.
  const signInUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key';
  const signInRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'password123',
      returnSecureToken: true
    })
  });
  
  const { localId } = await signInRes.json();

  // 2. Set Role in Firestore Emulator (Bearer owner bypasses security rules)
  const docUrl = `${firestoreEmulatorUrl}/${localId}`;
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
  
  if (!firestoreRes.ok) {
    const errText = await firestoreRes.text();
    throw new Error(`Failed to seed Firestore user doc: ${errText}`);
  }
  
  return localId;
}

// ---------------------------------------------------------
// WARMUP TEST
// ---------------------------------------------------------
// Questo test serve solo a "svegliare" il server Vite (cold start) 
// e a far compilare le pagine SvelteKit, assorbendo il ritardo iniziale.
setup('warmup vite server', async ({ page }) => {
  setup.setTimeout(120000);
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
});


setup('authenticate as amministrazione', async ({ page }) => {
  setup.setTimeout(120000); // 120 seconds to allow Vite cold start and Cloud Function cold start
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const email = 'test-admin@gestoray.local';
  await seedUser(email, 'amministrazione');
  
  await page.goto('/login');
  
  // Attendi che SvelteKit abbia terminato l'idratazione senza usare networkidle (che fallisce a causa dei WebSocket di Firebase)
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500); // Wait for Svelte 5 to attach the onsubmit handler
  
  await page.fill('input[type="email"]', email);
  const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
  
  // Pulisci eventuale PIN vecchio per evitare race conditions tra i test
  await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });

  await page.click('button[type="submit"]'); // Invia codice PIN
  
  // Leggi il NUOVO PIN direttamente dal Firestore Emulator
  let pin = '';
  for (let i = 0; i < 30; i++) {
    const res = await fetch(pinDocUrl, { headers: { 'Authorization': 'Bearer owner' } });
    if (res.ok) {
      const data = await res.json();
      if (data.fields?.pin?.stringValue) {
        pin = data.fields.pin.stringValue;
        break;
      }
    }
    await page.waitForTimeout(500);
  }
  
  if (!pin) throw new Error("PIN non trovato nel Firestore Emulator!");

  // Attendi che il campo PIN sia visibile nella UI (Step 2)
  await expect(page.locator('input[name="pin"]')).toBeVisible({ timeout: 5000 });
  
  // Inserisci il PIN
  await page.fill('input[name="pin"]', pin);
  await page.click('button[type="submit"]'); // Accedi
  
  await page.waitForURL('/dashboard');
  await expect(page.locator('.loader-box')).toBeHidden();
  
  if (!fs.existsSync('playwright/.auth')) {
    fs.mkdirSync('playwright/.auth', { recursive: true });
  }
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});

setup('authenticate as commerciale', async ({ page }) => {
  setup.setTimeout(120000);

  const email = 'test-comm@gestoray.local';
  await seedUser(email, 'commerciale');
  
  await page.goto('/login');
  
  // Attendi idratazione Svelte senza usare networkidle
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  
  await page.fill('input[type="email"]', email);
  const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
  
  // Pulisci eventuale PIN vecchio per evitare race conditions tra i test
  await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });

  await page.click('button[type="submit"]'); // Invia codice PIN
  
  // Leggi il PIN direttamente dal Firestore Emulator
  let pin = '';
  for (let i = 0; i < 30; i++) {
    const res = await fetch(pinDocUrl, { headers: { 'Authorization': 'Bearer owner' } });
    if (res.ok) {
      const data = await res.json();
      if (data.fields?.pin?.stringValue) {
        pin = data.fields.pin.stringValue;
        break;
      }
    }
    await page.waitForTimeout(500);
  }
  
  if (!pin) throw new Error("PIN non trovato nel Firestore Emulator!");

  // Attendi che il campo PIN sia visibile nella UI (Step 2)
  await expect(page.locator('input[name="pin"]')).toBeVisible({ timeout: 5000 });
  
  // Inserisci il PIN
  await page.fill('input[name="pin"]', pin);
  await page.click('button[type="submit"]'); // Accedi
  
  await page.waitForURL('/dashboard');
  await expect(page.locator('.loader-box')).toBeHidden();
  
  await page.context().storageState({ path: 'playwright/.auth/comm.json' });
});
