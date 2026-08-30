---
name: codebase-test
description: Framework di testing e audit architetturale e filosofico per l'intera codebase di Gestoray. Valuta modularità, agnosticismo, assenza di hardcoding, robustezza SSOT, sincronizzazione template e idoneità multi-settore per PMI (Edilizia, Consulenza, Retail/Food, Assistenza Tecnica, Servizi).
---

# SKILL: FRAMEWORK DI AUDIT FORENSE ARCHITETTURALE E MULTI-SETTORIALE (GESTORAY)

## 1. RUOLO & PRINCIPIO CARDINE: "ZERO-ANCHORING" DA CTO

Questo framework è la guida esecutiva e filosofica vincolante per l'ispezione della codebase di **Gestoray**.
È fatto divieto assoluto all'agente di:
1. **Emettere giudizi qualitativi sommari o valutazioni a memoria in pochi secondi.**
2. **Lasciarsi influenzare dal "Context Anchoring Bias"** (riutilizzare riassunti, voti o conclusioni presenti nei messaggi precedenti della chat).
3. **Fidarsi ciecamente di un numero o di uno script senza leggere i file**: gli script servono per mappare oggettivamente il filesystem e le dipendenze, ma **la perizia critica, filosofica e semantica spetta all'AI che ispeziona il codice sorgente riga per riga**.

Ogni audit deve essere una **perizia tecnica e filosofica forense da tabula rasa**, condotta tramite scansioni concrete del codice sorgente, verifiche di accoppiamento, diff tra template e sorgenti attivi, e simulazione reale dei processi di business delle PMI.

---

## 2. I 7 PILASTRI DELL'AUDIT ARCHITETTURALE

Ogni modulo, vista o servizio del sistema viene sottoposto a scrutinio secondo 7 dimensioni fondamentali:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   I 7 PILASTRI DELL'AUDIT ARCHITETTURALE GESTORAY                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. AGNOSTICISMO & ZERO-HARDCODING (Labels, prefissi e termini personalizzabili)  │
│ 2. MODULARITÀ PURA & ZERO-COUPLING (Nessun import statico di moduli in Core)    │
│ 3. SINGLE SOURCE OF TRUTH (SSOT) (Formule di calcolo e KPI uniche nel Bridge)    │
│ 4. TEMPLATE-FIRST IDEMPOTENCY (Sorgenti attivi speculari a scripts/templates/)   │
│ 5. DUAL-SCHEMA RESILIENCE & SAFE NUMERICS (Protezione crash toFixed/null/NaN)   │
│ 6. SECURITY RULES & RBAC (Regole Firestore per ogni collezione + GDPR 1-click)   │
│ 7. UI/UX VECTOR STANDARDS (100% Lucide Icons, zero emoji raw, Runes Svelte 5)    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. PROTOCOLLO ESECUTIVO FORENSE IN 5 SOTTOSISTEMI

Quando viene avviato l'audit, l'agente esegue il runner unificato deterministico:
```bash
node .agent/skills/codebase-test/scripts/run-audit.js
```
Questo script genera in modo deterministico l'albero dei 5 sottosistemi, mappa i file live vs template, verifica le regole Firestore e scansiona la sicurezza numerica, salvando il report dettagliato in `.agent/skills/codebase-test/audit-manifest.json` e `audit_report_full.json`.

---

L'agente procede poi all'ispezione critica leggendo i file chiave dei 5 sottosistemi aziendali:

### Sottosistema 1: Core CRM, Identity & Tenant Foundation
* **Moduli**: `clients`, `users`, `contacts`, `profile`, `qualifications`, `settings`.
* **Verifiche Chiave**:
  * Anagrafica universale (B2B, B2C, PA, SDI, PEC).
  * Tab dinamici isolati nel dettaglio cliente (`ClientQuotesTab`, `ClientInvoicesTab`, `ClientPlacesTab`).
  * Motore di anonimizzazione GDPR 1-click (`anonymizationService.ts`).

### Sottosistema 2: Commercial Pipelines & Financial Reconciliation
* **Moduli**: `contracts`, `payments`, `commissions`.
* **Verifiche Chiave**:
  * Riconciliazione incassi su rate contrattuali con allocazione flessibile (`payments.contracts.bridge.ts`).
  * Scorporo IVA multi-aliquota (4%, 10%, 22%) e supporto a cassa libera senza contratti.
  * SSOT dei totalizzatori finanziari in `PaymentsKPIBridge` e `ContractsKPIBridge`.

### Sottosistema 3: Field Operations, Resources & Logistics
* **Moduli**: `places`, `teams`, `vehicles`, `scheduling`, `interventi`.
* **Verifiche Chiave**:
  * Gestione luoghi e cantieri gerarchici ad albero e tracciamento presenze.
  * Tariffe operatore flessibili (a giornata, a ora, a mc, a mq).
  * Parco mezzi e scadenze revisione/bollo con bridge disaccoppiato.
  * Copertura di sicurezza su `interventions` in `firestore.rules`.

### Sottosistema 4: Products Catalog, Service Desk & Tasks
* **Moduli**: `products`, `tickets`, `activities`, `deadlines`, `todo`.
* **Verifiche Chiave**:
  * Catalogo prodotti con unità di misura configurabili e controllo prezzo minimo agente.
  * Helpdesk con calcolo del Tempo Medio Risoluzione (TMR) e gestione priorità SLA.
  * Disaccoppiamento dello scadenziario e log attività multi-ruolo.

### Sottosistema 5: Analytics Intelligence & Dynamic KPI Dispatcher
* **Moduli**: `chart`, `UniversalAnalyticsChart.svelte`, `DashboardService`.
* **Verifiche Chiave**:
  * Caricamento dinamico dei bridge via `import.meta.glob('./**/*.kpi.bridge.ts')`.
  * Rispetto rigoroso di zero import statici tra moduli opzionali e Core.

---

## 4. VALIDAZIONE MATRICE MULTI-SETTORIALE PER PMI

L'audit deve certificare l'idoneità della piattaforma su **5 archetipi reali di PMI**:
1. 🏗️ **Edilizia & Impianti**: Cantieri multilivello, tariffe operatore multiple, parco mezzi, SAL contrattuali e ritenute.
2. 📐 **Studi Professionali & Architettura**: Lettere d'incarico, log ore consulenza, notule con cassa previdenza e ritenuta, zero cantieri.
3. 🍨 **Food, Gelaterie & Retail**: Unità di misura libere (kg, lt, pz), chiusure cassa giornaliere contanti/POS, assenza forzata di contratti.
4. 🛠️ **Manutenzioni & Riparazioni**: Tracciamento guasti, calcolo TMR in ore, associazione impianti e contratti manutenzione.
5. 📦 **Commercio B2B & Distribuzione**: Listini con soglia minima di vendita, acconti e riconciliazione su scadenze multiple.

---

## 5. EMISSIONE DEL REPORT FINALE

Al termine dell'ispezione, l'agente emette la **Relazione di Perizia Forense** con:
* Punteggio ponderato per ogni sottosistema.
* Lista esatta di ogni anomalia o debito tecnico con percorso file e riga di codice.
* Piano di bonifica prioritarizzato per portare la codebase al 100% oggettivo.
