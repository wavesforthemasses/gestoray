---
name: test-ux-ui
description: Autonomous Headless Browser Visual Inspection & UX/UI Testing Engine. Allows agents to navigate routes, simulate user actions, test responsive viewports (mobile, tablet, desktop), capture full-page or element-clipped screenshots, inspect rendered DOM and console errors, and cleanly purge temporary captures.
---

# SKILL: GESTORAY UX/UI TEST ENGINE & VISUAL INSPECTOR (`test-ux-ui`)

## 1. OBIETTIVO & FILOSOFIA ARCHITETTURALE

La Skill **`test-ux-ui`** è il motore autonomo di ispezione visiva e collaudo UX/UI dell'agente.
È stata progettata con tre principi non negoziabili:

1. **Isolamento Totale dal Codice di Produzione**:
   - Risiede interamente nella directory degli agenti (`.agent/skills/test-ux-ui/`).
   - Non tocca né inquina la codebase dell'applicazione (`src/`), le dipendenze di build o il runtime di SvelteKit.
2. **Immunità da Connessioni Esterne**:
   - Esegue Chromium in locale tramite Playwright, interfacciandosi direttamente con il server di sviluppo attivo (`localhost:5174` o `5173`) e con gli emulatori locali.
   - Non dipende da subagent cloud esterni o endpoint di streaming di terze parti.
3. **Flusso "Inspect & Clean" con Zero Inquinamento**:
   - Gli screenshot vengono salvati in un percorso scratch dedicato (`.agent/skills/test-ux-ui/screenshots/`).
   - L'agente li ispeziona visivamente (`view_file`), documenta i riscontri nei propri walkthrough o audit report, e può ripulire all'istante i file temporanei tramite l'opzione `--clean`.

---

## 2. ARCHITETTURA DEL TESTER (`ux-tester.js`)

L'engine principale si trova in:
```bash
node .agent/skills/test-ux-ui/scripts/ux-tester.js [OPZIONI]
```

### Funzionalità Chiave dell'Engine:
- **Auto-Discovery della Porta**: Se non specificato l'host, il tester scansiona automaticamente le porte `5174`, `5173`, `4173`, `3000` per agganciarsi al dev server Vite attivo.
- **Auto-Authentication Fail-Safe**: Se rileva la schermata di login (`#email`), esegue l'autenticazione automatica con `test-super@app.local`, legge il PIN generato e naviga alla destinazione richiesta.
- **Rilevamento Intelligente del Ready State**: Attende il completamento del caricamento DOM e la scomparsa degli spinner di caricamento (`.loading-state .spinner`), garantendo che lo screenshot contenga la pagina completamente idratata.
- **Cattura Console Alerts**: Raccoglie tutti gli errori o warning JavaScript emessi dalla console del browser nel file di metadata JSON di accompagnamento.

---

## 3. GUIDA ALL'USO DELLA CLI

### A. Screenshot Semplice di una Rotta
```bash
node .agent/skills/test-ux-ui/scripts/ux-tester.js --route /dashboard/job_costing --name job_costing_view
```

### B. Screenshot con Risoluzione Mobile o Tablet
```bash
# Mobile (iPhone 14 - 390x844)
node .agent/skills/test-ux-ui/scripts/ux-tester.js --route /dashboard/job_costing --preset mobile --name mobile_view

# Tablet (iPad - 768x1024)
node .agent/skills/test-ux-ui/scripts/ux-tester.js --route /dashboard/places --preset tablet --name tablet_view
```

### C. Modalità di Cattura (`--mode`)
1. **Full Page (Default)**: Cattura l'intera altezza scorrevole della pagina.
   ```bash
   node .agent/skills/test-ux-ui/scripts/ux-tester.js --route /dashboard/invoices --mode full
   ```
2. **Viewport**: Cattura solo l'area visibile nello schermo (above the fold).
   ```bash
   node .agent/skills/test-ux-ui/scripts/ux-tester.js --route /dashboard/invoices --mode viewport
   ```
3. **Elemento Singolo / Ritaglio Selettore (`--selector`)**: Cattura e ritaglia un singolo nodo DOM.
   ```bash
   node .agent/skills/test-ux-ui/scripts/ux-tester.js --route /dashboard/job_costing --selector ".kpi-grid-row" --name kpi_cards
   ```

### D. Pipeline di Azioni Interattive (`--action`)
È possibile simulare interazioni utente prima di scattare lo screenshot concatenando più flag `--action`:

| Sintassi Azione | Esempio | Descrizione |
| :--- | :--- | :--- |
| `click:<selector>` | `--action "click:button:has-text('Nuova Commessa')"` | Clicca su un pulsante o link |
| `fill:<selector>:<testo>` | `--action "fill:#pTitle:Cantiere Torre Nord"` | Digita testo in un input |
| `wait:<ms>` | `--action "wait:1500"` | Attende un intervallo in ms |
| `waitForSelector:<selector>` | `--action "waitForSelector:.data-table"` | Attende la comparsa di un elemento |
| `hover:<selector>` | `--action "hover:.menu-item"` | Simula passaggio del mouse |
| `press:<tasto>` | `--action "press:Enter"` | Preme un tasto della tastiera |

**Esempio di Pipeline Completa**:
```bash
node .agent/skills/test-ux-ui/scripts/ux-tester.js \
  --route /dashboard/job_costing \
  --action "click:a[href='/dashboard/job_costing/add']" \
  --action "waitForSelector:#pTitle" \
  --action "fill:#pTitle:Ristrutturazione Facciate" \
  --name wizard_filled_state
```

### E. Pulizia degli Screenshot Temporanei (`--clean`)
Per rimuovere tutti gli screenshot temporanei e mantenere il repository pulito:
```bash
node .agent/skills/test-ux-ui/scripts/ux-tester.js --clean
```

---

## 4. MATRICE DEI DISPOSITIVI & RISOLUZIONI SUPPORTATE

| Preset | Dimensioni (WxH) | Device Scale | Tipo Dispositivo | Flag CLI |
| :--- | :--- | :--- | :--- | :--- |
| `desktop` (Default) | 1440 x 900 | 1.0x | Monitor Desktop standard | `--preset desktop` |
| `desktop-wide` | 1920 x 1080 | 1.0x | Monitor Full HD 1080p | `--preset desktop-wide` |
| `laptop` | 1280 x 800 | 1.0x | Schermo compatto 13" | `--preset laptop` |
| `tablet` | 768 x 1024 | 2.0x | Tablet portrait / iPad | `--preset tablet` |
| `mobile` | 390 x 844 | 3.0x | Smartphone moderno (iPhone 14) | `--preset mobile` |
| `mobile-small` | 360 x 640 | 2.0x | Smartphone compatto Android | `--preset mobile-small` |
| *Custom* | Personalizzato | Configurabile | Qualsiasi risoluzione specifica | `--width 1024 --height 600` |

---

## 5. BATCH SCENARIOS AUDIT RUNNER

Per eseguire una suite di test visivi su tutte le schermate del sistema:
```bash
node .agent/skills/test-ux-ui/scripts/test-scenarios.js
```
Questo script testa in sequenza:
1. `/dashboard` (Panoramica aziendale)
2. `/dashboard/clients` (Elenco anagrafiche)
3. `/dashboard/contracts` (Contratti e preventivi)
4. `/dashboard/invoices` (Fatturazione SDI)
5. `/dashboard/places` (Cantieri e luoghi)
6. `/dashboard/job_costing` (Controllo di gestione)
7. `/dashboard/job_costing/add` (Wizard commessa)
8. `/dashboard/job_costing` su Mobile (390x844)
9. `/dashboard/warehouse` (Magazzino FIFO)
10. `/dashboard/tickets` (Service desk & SLA)

---

## 6. INTEGRAZIONE CON `codebase-test` & FACTUAL VERIFICATION

Come stabilito in `AGENTS.md` (Principio di Fact-Based Verification):
> *Ogni volta che si effettua una modifica al frontend o alla UX, l'agente DEVE verificare il risultato tramite strumenti visuali prima di considerare concluso il task.*

Grazie alla Skill `test-ux-ui`, l'agente può:
1. Lanciare `node .agent/skills/test-ux-ui/scripts/ux-tester.js --route <rotta>`.
2. Verificare l'immagine risultante tramite `view_file` con analisi critica della resa cromatica, del contrasto e dell'allineamento.
3. Se necessario allegare l'evidenza nell'artifact `walkthrough.md`.
4. Eseguire `node .agent/skills/test-ux-ui/scripts/ux-tester.js --clean` per rimuovere gli screenshot temporanei se non destinati al rilascio permanente.
