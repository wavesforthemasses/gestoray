# 🚀 Gestoray - Universal SaaS & CRM Boilerplate

**Gestoray** è un framework/boilerplate universale pronto all'uso per realizzare gestionale web, CRM e applicazioni SaaS avanzate. È sviluppato con la modernissima architettura di **Svelte 5 (Runes)**, **SvelteKit**, **Firebase (Auth & Firestore)** e **Playwright**.

Include un sistema di **Branding Dinamico (White-Labeling in tempo reale)** e un potente **Generatore CLI di moduli CRUD** automatico.

---

## 📋 Indice
1. [Prerequisiti](#-prerequisiti)
2. [Installazione da Zero](#-installazione-da-zero)
3. [Avvio in Ambiente Locale](#-avvio-in-ambiente-locale)
4. [Come Funziona il Login Locale](#-come-funziona-il-login-locale)
5. [Generatore di Moduli (Scaffolder CLI)](#-generatore-di-moduli-scaffolder-cli)
6. [Branding Dinamico e Personalizzazione Tema](#-branding-dinamico-e-personalizzazione-tema)
7. [Esecuzione dei Test E2E](#-esecuzione-dei-test-e2e)
8. [Riepilogo Comandi Utili](#-riepilogo-comandi-utili)
9. [Struttura del Progetto](#-struttura-del-progetto)

---

## 🛠️ Prerequisiti

Prima di iniziare, assicurati di avere installato sul tuo computer:

1. **Node.js** (versione 18 o superiore, **v20 consigliata**):
   - Verifica con: `node -v`
2. **Java Development Kit (JDK 11+)**:
   - Necessario per far girare la suite di **Firebase Emulators** sul tuo computer.
   - Verifica con: `java -version`
3. **Firebase CLI**:
   - Installa globalmente sul tuo sistema eseguendo:
     ```bash
     npm install -g firebase-tools
     ```

---

## 📥 Installazione da Zero

Segui questi passaggi nell'ordine per configurare il progetto per la prima volta:

### 1. Clona la repository o entra nella cartella
```bash
cd gestoray
```

### 2. Installa le dipendenze Node
```bash
npm install
```

### 3. Installa i browser per i test E2E (Playwright)
```bash
npx playwright install --with-deps chromium
```

---

## ⚡ Avvio in Ambiente Locale

Il progetto è configurato per lavorare localmente in sicurezza tramite **Firebase Emulators** (senza toccare database o credenziali di produzione).

### Opzione A: Comando Unico (Consigliato 🚀)
Puoi avviare **contemporaneamente** sia gli emulatori Firebase che il server di sviluppo in un unico terminale con:
```bash
npm run dev:all
# oppure: npm run dev:emulators
```

### Opzione B: 2 Terminali Separati

#### Terminale 1: Avvia gli Emulatori Firebase
```bash
npm run emulators
```
*Questo avvierà l'emulatore Auth (porta 9099) e Firestore (porta 8080). Risponderà anche la UI di controllo su `http://127.0.0.1:4000`.*

#### Terminale 2: Avvia il Server di Sviluppo SvelteKit
```bash
npm run dev
```
*Questo avvierà il server SvelteKit in locale.*

👉 Apri il tuo browser e vai all'indirizzo: **`http://localhost:5173`**

---

## 🔑 Come Funziona il Login Locale

Nella modalità con emulatore, all'avvio con `npm run dev:emulators` vengono **popolati automaticamente gli utenti di test** ed è attivo il sistema di **PIN di login sicuro di debug**:

### Utenti di Test Pre-configurati:
- **Amministrazione**: `test-admin@gestoray.local`
- **Superadmin**: `test-super@gestoray.local`
- **Commerciale**: `test-comm@gestoray.local`
- **Direzione**: `test-direzione@gestoray.local`

### Procedura di Login:
1. Vai su `http://localhost:5173/login`.
2. Inserisci una delle email di test di sopra (es. `test-admin@gestoray.local`).
3. Clicca su **"Invia PIN"**.
4. Guarda i log nel terminale o apri la console del browser (F12 -> Console): troverai il PIN di debug stampato (es: `Debug PIN: 123456`).
5. Inserisci il PIN per accedere alla Dashboard con il ruolo corrispondente!

---

---

## 🏛️ Architettura Modulare 3-Livelli (3-Tier Architecture)

Gestoray adotta un'architettura **completamente disaccoppiata e pura** suddivisa su 3 livelli:

1. **Tier 1 (Base Core Universale):** `clients` (Clienti), `users` (Utenti & Permessi), `custom-fields` (Campi Personalizzati PMI).
2. **Tier 2 (Moduli Puri Standalone - 100% Autonomi):**
   - `contracts` — Gestione Contratti, Scadenze e Canoni
   - `payments` — Incassi e Flussi di Cassa
   - `commissions` — Provvigioni Commerciali Agenti
   - `products` — Catalogo Prodotti & Ricambi
   - `activities` — Task & Attività Operative Interni
   - `tickets` — Ticket di Assistenza Clienti
   - `interventi` — Field Service, Squadre, Mezzi e Rapportini
3. **Tier 3 (Bridge Connectors Opzionali):** Moduli ponte dedicati (es. `bridge_contracts_interventi`, `bridge_contracts_payments`) che collegano due moduli puri **solo quando entrambi sono installati**, garantendo zero debito tecnico.

---

## 📦 Registro Moduli Portabili & Installazione On-Demand

Tutti i 7 moduli puri pronti all'uso risiedono nel **Registro Moduli (`scripts/templates/modules/`)** e possono essere sincronizzati o installati con un singolo comando:

### Opzione A: Sincronizzazione ed Installazione Automatica via CLI (1-Click)
```bash
# Sincronizza tutti i modelli CLI con la dashboard attiva
npm run template:sync

# Installazione di un qualsiasi modulo dal registro:
npm run module:install -- --name contracts
# Moduli disponibili: contracts, payments, commissions, products, activities, tickets, interventi
```

### Opzione B: Installazione Manuale Copy-Paste su Altre Codebase
Ogni cartella in `scripts/templates/modules/[modulo]/` contiene un file **`HOW_TO_INSTALL.md`** che fornisce le istruzioni passo-passo per prelevare manualmente i file ed incollarli in qualsiasi altra codebase custom (file fisici, voce in `menu.ts` e snippet in `firestore.rules`).

---

## 🏗️ Generatore di Moduli Custom (Scaffolder CLI)

Se vuoi creare un nuovo modulo **completamente nuovo da zero** (es. *Ordini*, *Fornitori*, *Magazzino*):

```bash
npm run generate -- --name Orders --collection orders
```

### Cosa fa lo script in automatico?
1. Crea l'intera struttura in `src/routes/dashboard/orders/`:
   - `+page.svelte` (Pagina Elenco)
   - `add/+page.svelte` (Pagina Creazione)
   - `[id]/+page.svelte` (Pagina Dettaglio & Modifica)
   - `orders.service.ts` (Servizio CRUD Firebase)
   - `orders.spec.ts` (Test E2E completi per Playwright)
   - `components/OrdersTable.svelte` (Componente Tabella)
   - `components/OrdersForm.svelte` (Componente Form)
2. Aggiunge automaticamente la voce nel menu di navigazione (`src/lib/stores/menu.ts`).
3. Aggiunge le regole di sicurezza nel file `firestore.rules`.

---

## 🎨 Branding Dinamico e Personalizzazione Tema

La piattaforma è predisposta per il **White-Labeling**. Puoi personalizzare l'aspetto visivo e i colori dell'applicazione direttamente dall'interfaccia:

1. Accedi alla Dashboard come **Superadmin**.
2. Vai su **Impostazioni** (`/dashboard/settings`).
3. Clicca sulla card **Tema e Branding** (`/dashboard/settings/theme`).
4. Utilizza gli slider per regolare:
   - **Colore Primario**: Tonalità (Hue), Saturazione e Luminosità.
   - **Colore Secondario**: Per gli accenti e i dettagli risaltati.
   - **Neutral Chroma**: Per dare un tocco di colore ai grigi di sfondo.
5. L'applicazione aggiornerà i colori **in tempo reale nell'interfaccia**. Clicca su **"Salva Tema"** per renderlo permanente per tutti gli utenti nel database.

---

## 🧪 Esecuzione dei Test E2E

Il progetto possiede una suite di test end-to-end completa scritta in **Playwright**.

Assicurati che gli emulatori Firebase siano in funzione o lancia il comando:
```bash
npm run test:e2e
```
Playwright avvierà i test headless controllando che tutte le rotte, le autorizzazioni dei ruoli, le operazioni CRUD e le esportazioni CSV/Excel funzionino perfettamente.

---

## 📜 Riepilogo Comandi Utili

| Comando | Descrizione |
| :--- | :--- |
| `npm run dev:all` (o `dev:emulators`) | **Comando unico**: avvia sia gli emulatori Firebase che SvelteKit contemporaneamente |
| `npm run dev` | Avvia il solo server di sviluppo SvelteKit su `http://localhost:5173` |
| `npm run emulators` | Avvia i soli emulatori locali di Firebase (Auth e Firestore) |
| `npm run generate -- --name <Nome> --collection <collezione>` | Genera un nuovo modulo CRUD completo da CLI |
| `npm run check` | Controlla la validità dei tipi TypeScript e i componenti Svelte |
| `npm run test:e2e` | Esegue la suite completa di test Playwright |
| `npm run build` | Compila l'applicazione per la produzione |
| `npm run preview` | Anteprima della build di produzione compilata |

---

## 📁 Struttura del Progetto

```text
gestoray/
├── .github/workflows/       # Workflow di CI/CD (GitHub Actions)
├── firestore.rules           # Regole di sicurezza Firestore
├── firebase.json             # Configurazione emulatori Firebase
├── scripts/                  # Script CLI (Scaffolder & Template)
│   ├── scaffold.js
│   └── templates/module/    # Template di generazione per i moduli
├── src/
│   ├── lib/                  # Librerie, componenti condivisi e store
│   │   ├── components/       # Card, Table, FormField, KPITile, Modals
│   │   ├── stores/           # Menu, Project, Toast, Activities, Page
│   │   └── utils/            # IconMap, AuthCheck, Search-utils
│   └── routes/               # Pagine dell'applicazione (SvelteKit)
│       ├── login/            # Flusso di autenticazione con PIN
│       └── dashboard/        # Area riservata della piattaforma
│           ├── activities/   # Gestione Attività
│           ├── clients/      # Anagrafica Clienti
│           ├── contracts/    # Gestione Contratti
│           ├── payments/     # Gestione Incassi e Rate
│           ├── products/     # Catalogo Prodotti
│           ├── settings/     # Impostazioni generali e Tema
│           ├── users/        # Gestione Utenti e Ruoli
│           └── ...
└── tests/                    # Script e setup di supporto per Playwright
```

---

*Progetto creato con ❤️ per la massima modularità, pulizia del codice e velocità di sviluppo.*
