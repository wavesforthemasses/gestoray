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

## 2. GLI 8 PILASTRI DELL'AUDIT ARCHITETTURALE

Ogni modulo, vista o servizio del sistema viene sottoposto a scrutinio secondo 8 dimensioni fondamentali:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   GLI 8 PILASTRI DELL'AUDIT ARCHITETTURALE GESTORAY              │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. AGNOSTICISMO & ZERO-HARDCODING (Labels, prefissi e termini personalizzabili)  │
│ 2. MODULARITÀ PURA & ZERO-COUPLING (Nessun import statico di moduli in Core)    │
│ 3. SINGLE SOURCE OF TRUTH (SSOT) (Formule di calcolo e KPI uniche nel Bridge)    │
│ 4. TEMPLATE-FIRST IDEMPOTENCY (Sorgenti attivi speculari a scripts/templates/)   │
│ 5. DUAL-SCHEMA RESILIENCE & SAFE NUMERICS (Protezione crash toFixed/null/NaN)   │
│ 6. SECURITY RULES & RBAC (Regole Firestore per ogni collezione + GDPR 1-click)   │
│ 7. UI/UX VECTOR STANDARDS (100% Lucide Icons, zero emoji raw, Runes Svelte 5)    │
│ 8. DYNAMIC AUTOCOMPLETE VS STATIC SELECT (Ricerca predittiva per entità aperte)  │
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

## 4. MATRICE COMPLETA CAPABILITY & REQUISITI DI BUSINESS (SEZIONI A-G & ROADMAP)

L'audit verifica la conformità della piattaforma rispetto a tutte le macro-aree funzionali:

| Sezione | Ambito Funzionale | Feature Chiave | Stato Attuale | Test Agnostico Dedicato |
|---|---|---|---|---|
| **A** | **CRM & Anagrafica** | Anti-duplicati (CF/P.IVA), required fields, diario multi-azione (chiamate, email, incontri, note), promozione prospect->cliente | ✅ Attivo & Collaudato | `clients.service.test.ts`, `activities.service.test.ts` |
| **B** | **Preventivi & Contratti** | Creazione preventivo, listini, alert prezzo minimo (`minPrice`), salvataggio bozza, co-venditore con ripartizione %, approvazione workflow | ✅ Attivo & Collaudato | `contracts.service.test.ts`, `multiSectorAgnostic.test.ts` |
| **C** | **Scadenziari & Rate** | Rateizzazione flessibile, solleciti visivi scaduti, posticipo date, inserimento rate intermedie | ✅ Attivo & Collaudato | `contracts.service.test.ts`, `deadlines.service.test.ts` |
| **D** | **Incassi, IVA & Provvigioni** | Allocazione incasso singolo a multi-contratti, scorporo IVA (4%, 10%, 22%), provvigioni su incassato reale (`Realized Payments`) | ✅ Attivo & Collaudato | `payments.service.test.ts`, `multiSectorAgnostic.test.ts` |
| **E** | **Target Commerciali** | Impostazione target mensili per venditore a inizio mese, monitoraggio avanzamento KPI real-time | ⏳ **Pianificato in Roadmap** | *Da implementare con modulo targets* |
| **F** | **Collaboratori & Ruoli** | Matrice RBAC (superadmin, amministrazione, direzione, commerciale), provvigioni per qualifica (Junior, Senior, DV) | ✅ Attivo & Collaudato | `authCheck.test.ts`, `business-logic.test.ts` |
| **G** | **Business Intelligence** | Grafico interattivo dinamico (`UniversalAnalyticsChart`), filtri al click, export CSV/XLS, print layout | ✅ Attivo & Collaudato | `dashboard.service.test.ts`, `multiSectorAgnostic.test.ts` |
| **OPS** | **Field Operations** | Cantieri gerarchici georeferenziati (`places`), Squadre & Risorse (`teams`), Parco Mezzi (`vehicles`), Pianificazione a calendario (`scheduling`) | ✅ Attivo & Collaudato | `places.*.test.ts`, `teams.*.test.ts`, `vehicles.*.test.ts` |
| **OPS** | **Assistenza & Ticket** | Gestione ticket/reclami, assegnazione tecnici, calcolo TMR in ore, monitoraggio SLA | ✅ Attivo & Collaudato | `tickets.service.test.ts`, `multiSectorAgnostic.test.ts` |
| **FASE 1** | **Magazzino & Acquisti** | Fornitori, ordini d'acquisto, lotti/ricezione e scarico FIFO | ✅ Attivo & Collaudato | `warehouse.domain.test.ts`, `warehouse.service.ts` |
| **FASE 2** | **Fatture in Cloud SDI** | Integrazione API v2 Fatture in Cloud, emissione fatture acconto/saldo, sync SDI, riconciliazione fatture ricevute | ⏳ **Pianificato in Roadmap (Fase 2 ott-nov)** | *Da implementare* |
| **FASE 2** | **Job Costing Cantiere** | Imputazione costi cantiere (ore bolle + ammortamento mezzi + materiali FIFO) | ⏳ **Pianificato in Roadmap (Fase 2 nov)** | *Da implementare* |

---

## 5. VALIDAZIONE MATRICE MULTI-SETTORIALE PER PMI (`multiSectorAgnostic.test.ts`)

L'audit certifica l'idoneità della piattaforma su **5 archetipi reali di PMI** sia tramite stress simulation nello script di audit sia tramite la suite ufficiale Vitest `src/lib/services/multiSectorAgnostic.test.ts`:
1. 🏗️ **Edilizia & Impianti**: Calcolo multi-tariffa manodopera (giornata, oraria, mc, mq), SAL contrattuali progressivi con IVA agevolata 10% e ritenute di garanzia, cantieri gerarchici con geofencing.
2. 📐 **Studi Professionali & Consulenza**: Tariffazione oraria, calcolo notula con cassa previdenza 4%, IVA 22% e ritenuta d'acconto 20%, disaccoppiamento totale da cantieri e mezzi fisici.
3. 🍨 **Food, Gelaterie & Retail**: Unità di misura libere (kg, lt, pz), scontrini/chiusure cassa giornaliere contanti/POS/Satispay con scorporo IVA multi-aliquota (4%, 10%, 22%), assenza forzata di contratti.
4. 🛠️ **Manutenzioni & Riparazioni**: Tracciamento ticket guasti, calcolo Tempo Medio di Risoluzione (TMR) in ore, monitoraggio violazioni SLA (urgente/alta/media).
5. 📦 **Commercio B2B & Distribuzione**: Cataloghi con prezzo minimo e soglia alert per agenti, ripartizione provvigionale co-venditore (es. 70/30), acconti con riconciliazione automatica su rate multiple e provvigioni liquidate solo su incassato reale.

---

## 6. EMISSIONE DEL REPORT FINALE

Al termine dell'ispezione, l'agente emette la **Relazione di Perizia Forense da Principal Architect & CTO** con:
* Tabella dello stato di avanzamento per ciascun punto del preventivo/specifica (Gestito vs Non Gestito vs In Roadmap).
* Dettaglio dell'esistenza e robustezza dei test agnostici per ciascun settore PMI.
* Punteggio di salute complessivo calcolato in modo deterministico.
* Roadmap esecutiva chiara e azionabile per i rilasci successivi.
