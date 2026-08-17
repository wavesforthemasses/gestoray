# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/auth.setup.ts >> authenticate as commerciale
- Location: tests/auth.setup.ts:153:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.fill: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - heading "404" [level=1] [ref=e4]
  - paragraph [ref=e5]: Not Found
```

# Test source

```ts
  65  |         }
  66  |       }
  67  |     })
  68  |   });
  69  |   
  70  |   if (!firestoreRes.ok) {
  71  |     const errText = await firestoreRes.text();
  72  |     throw new Error(`Failed to seed Firestore user doc: ${errText}`);
  73  |   }
  74  |   
  75  |   return localId;
  76  | }
  77  | 
  78  | // ---------------------------------------------------------
  79  | // WARMUP TEST
  80  | // ---------------------------------------------------------
  81  | // Questo test serve solo a "svegliare" il server Vite (cold start) 
  82  | // e a far compilare le pagine SvelteKit, assorbendo il ritardo iniziale.
  83  | setup('warmup vite server', async ({ page }) => {
  84  |   setup.setTimeout(120000);
  85  |   await page.goto('/login');
  86  |   await seedUser('test-admin@app.local', 'amministrazione');
  87  |   await seedUser('test-comm@app.local', 'commerciale');
  88  |   await seedUser('test-super@app.local', 'superadmin');
  89  | 
  90  |   // Configura i settings di progetto per evitare che ProjectSetupBlocker blocchi la UI agli admin
  91  |   await seedFirestoreDoc('settings', 'project', {
  92  |     projectName: { stringValue: 'Test CRM' },
  93  |     projectEmail: { stringValue: 'test@app.local' }
  94  |   });
  95  | });
  96  | 
  97  | 
  98  | setup('authenticate as amministrazione', async ({ page }) => {
  99  |   setup.setTimeout(120000); // 120 seconds to allow Vite cold start and Cloud Function cold start
  100 |   
  101 |   page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  102 |   page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  103 | 
  104 |   const email = 'test-admin@app.local';
  105 |   await seedUser(email, 'amministrazione');
  106 |   
  107 |   await page.goto('/login');
  108 |   
  109 |   // Attendi che SvelteKit abbia terminato l'idratazione senza usare networkidle (che fallisce a causa dei WebSocket di Firebase)
  110 |   await page.waitForLoadState('domcontentloaded');
  111 |   await page.waitForTimeout(1500); // Wait for Svelte 5 to attach the onsubmit handler
  112 |   
  113 |   await page.fill('input[type="email"]', email);
  114 |   const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
  115 |   
  116 |   // Pulisci eventuale PIN vecchio per evitare race conditions tra i test
  117 |   await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });
  118 | 
  119 |   await page.click('button[type="submit"]'); // Invia codice PIN
  120 |   
  121 |   // Leggi il NUOVO PIN direttamente dal Firestore Emulator
  122 |   let pin = '';
  123 |   for (let i = 0; i < 30; i++) {
  124 |     const res = await fetch(pinDocUrl, { headers: { 'Authorization': 'Bearer owner' } });
  125 |     if (res.ok) {
  126 |       const data = await res.json();
  127 |       if (data.fields?.pin?.stringValue) {
  128 |         pin = data.fields.pin.stringValue;
  129 |         break;
  130 |       }
  131 |     }
  132 |     await page.waitForTimeout(500);
  133 |   }
  134 |   
  135 |   if (!pin) throw new Error("PIN non trovato nel Firestore Emulator!");
  136 | 
  137 |   // Attendi che il campo PIN sia visibile nella UI (Step 2)
  138 |   await expect(page.locator('input[name="pin"]')).toBeVisible({ timeout: 5000 });
  139 |   
  140 |   // Inserisci il PIN
  141 |   await page.fill('input[name="pin"]', pin);
  142 |   await page.click('button[type="submit"]'); // Accedi
  143 |   
  144 |   await page.waitForURL('/dashboard');
  145 |   await expect(page.locator('.loader-box')).toBeHidden();
  146 |   
  147 |   if (!fs.existsSync('playwright/.auth')) {
  148 |     fs.mkdirSync('playwright/.auth', { recursive: true });
  149 |   }
  150 |   await page.context().storageState({ path: 'playwright/.auth/admin.json' });
  151 | });
  152 | 
  153 | setup('authenticate as commerciale', async ({ page }) => {
  154 |   setup.setTimeout(120000);
  155 | 
  156 |   const email = 'test-comm@app.local';
  157 |   await seedUser(email, 'commerciale');
  158 |   
  159 |   await page.goto('/login');
  160 |   
  161 |   // Attendi idratazione Svelte senza usare networkidle
  162 |   await page.waitForLoadState('domcontentloaded');
  163 |   await page.waitForTimeout(1500);
  164 |   
> 165 |   await page.fill('input[type="email"]', email);
      |              ^ Error: page.fill: Test timeout of 120000ms exceeded.
  166 |   const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
  167 |   
  168 |   // Pulisci eventuale PIN vecchio per evitare race conditions tra i test
  169 |   await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });
  170 | 
  171 |   await page.click('button[type="submit"]'); // Invia codice PIN
  172 |   
  173 |   // Leggi il PIN direttamente dal Firestore Emulator
  174 |   let pin = '';
  175 |   for (let i = 0; i < 30; i++) {
  176 |     const res = await fetch(pinDocUrl, { headers: { 'Authorization': 'Bearer owner' } });
  177 |     if (res.ok) {
  178 |       const data = await res.json();
  179 |       if (data.fields?.pin?.stringValue) {
  180 |         pin = data.fields.pin.stringValue;
  181 |         break;
  182 |       }
  183 |     }
  184 |     await page.waitForTimeout(500);
  185 |   }
  186 |   
  187 |   if (!pin) throw new Error("PIN non trovato nel Firestore Emulator!");
  188 | 
  189 |   // Attendi che il campo PIN sia visibile nella UI (Step 2)
  190 |   await expect(page.locator('input[name="pin"]')).toBeVisible({ timeout: 5000 });
  191 |   
  192 |   // Inserisci il PIN
  193 |   await page.fill('input[name="pin"]', pin);
  194 |   await page.click('button[type="submit"]'); // Accedi
  195 |   
  196 |   await page.waitForURL('/dashboard');
  197 |   await expect(page.locator('.loader-box')).toBeHidden();
  198 |   
  199 |   await page.context().storageState({ path: 'playwright/.auth/comm.json' });
  200 | });
  201 | 
  202 | setup('authenticate as superadmin', async ({ page }) => {
  203 |   setup.setTimeout(120000);
  204 | 
  205 |   const email = 'test-super@app.local';
  206 |   await seedUser(email, 'superadmin');
  207 |   
  208 |   await page.goto('/login');
  209 |   
  210 |   await page.waitForLoadState('domcontentloaded');
  211 |   await page.waitForTimeout(1500);
  212 |   
  213 |   await page.fill('input[type="email"]', email);
  214 |   const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
  215 |   
  216 |   await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });
  217 | 
  218 |   await page.click('button[type="submit"]');
  219 |   
  220 |   let pin = '';
  221 |   for (let i = 0; i < 30; i++) {
  222 |     const res = await fetch(pinDocUrl, { headers: { 'Authorization': 'Bearer owner' } });
  223 |     if (res.ok) {
  224 |       const data = await res.json();
  225 |       if (data.fields?.pin?.stringValue) {
  226 |         pin = data.fields.pin.stringValue;
  227 |         break;
  228 |       }
  229 |     }
  230 |     await page.waitForTimeout(500);
  231 |   }
  232 |   
  233 |   if (!pin) throw new Error("PIN non trovato nel Firestore Emulator!");
  234 | 
  235 |   await expect(page.locator('input[name="pin"]')).toBeVisible({ timeout: 5000 });
  236 |   
  237 |   await page.fill('input[name="pin"]', pin);
  238 |   await page.click('button[type="submit"]');
  239 |   
  240 |   await page.waitForURL('/dashboard');
  241 |   await expect(page.locator('.loader-box')).toBeHidden();
  242 |   
  243 |   await page.context().storageState({ path: 'playwright/.auth/super.json' });
  244 | });
  245 | 
```