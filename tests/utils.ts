import { expect, type Page } from '@playwright/test';

export async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  
  await page.fill('input[type="email"]', email);
  
  const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
  await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });

  await page.click('button[type="submit"]');
  
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
  
  if (!pin) throw new Error(`PIN non trovato per ${email}`);

  await expect(page.locator('input[name="pin"]')).toBeVisible({ timeout: 5000 });
  await page.fill('input[name="pin"]', pin);
  await page.click('button[type="submit"]');
  
  await page.waitForURL('/dashboard');
  await expect(page.locator('.loader-box')).toBeHidden();
}

const FIRESTORE_BASE = 'http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents';

/**
 * Create or update a document in the Firestore emulator.
 * `fields` must be in Firestore REST format (e.g. { name: { stringValue: 'foo' } }).
 */
export async function seedFirestoreDoc(
  collection: string,
  docId: string,
  fields: Record<string, any>
): Promise<void> {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`seedFirestoreDoc failed for ${collection}/${docId}: ${errText}`);
  }
}

/**
 * Delete a document from the Firestore emulator.
 */
export async function deleteFirestoreDoc(
  collection: string,
  docId: string
): Promise<void> {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer owner' }
  });
}
