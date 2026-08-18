# Registro delle Decisioni & Lezioni Architetturali: Gestoray

> **Scopo del Registro**: Questo documento raccoglie la memoria storica delle decisioni di progettazione, delle lezioni apprese e delle linee guida di sviluppo per il gestionale **Gestoray**. Tutti gli sviluppatori ed agenti AI devono fare riferimento a queste regole per garantire coerenza, robustezza e modularità.

---

## 🏛️ Principi Architetturali Fondamentali (Scolpiti)

### 1. 100% Pure JSON Modular Engine (Zero TS String Slicing)
- **Lezione**: Manipolare direttamente i file di codice TypeScript (`.ts`) o generare file con frammenti di stringhe per menu, ruoli, feature flag o anonimizzazioni crea disallineamenti tra build ed espone a bug di sintassi.
- **Regola**: Tutta la configurazione dinamica dei moduli installati (voci di menu, permessi per ruolo, feature flag, regole d'anonimizzazione GDPR, indici e bridge) deve essere conservata esclusivamente in un registro JSON strutturato e validato (`modules.registry.json`).
- **Funzionamento**: I servizi frontend (`menu.ts`, `roles.service.ts`, `tenantFeaturesService.ts`) ed i trigger backend importano direttamente `modules.registry.json`. Gli script CLI (`install-module.js` e `uninstall-module.js`) operano in modo nativo ed esclusivo via JSON puro (`JSON.parse` e `JSON.stringify`), rendendo l'installazione e la disinstallazione dinamica delle feature a prova di bomba al 100%.

---

### 2. Backend Atomic Cascade for GDPR & Data Integrity
- **Lezione**: Le operazioni di pulizia o anonimizzazione in cascata (es. quando un cliente richiede l'oblìo GDPR ed occorre bonificare ticket, note e contratti collegati) non devono mai essere affidate a cicli o chiamate client-side trasversali. Se l'utente chiude il browser o perde la connessione a metà processo, si ottiene un'anonimizzazione parziale con violazione delle norme privacy.
- **Regola**: Le cascate critiche si eseguono in modo atomico nel Backend via Cloud Functions/Batch. Il client si limita a impostare il flag di richiesta, e il trigger backend completa l'operazione in modo infallibile.

---

### 3. Smart Dirty-Period Nightly Reconciliation (Self-Healing)
- **Lezione**: Eseguire ogni notte un ricalcolo cieco ed esaustivo di tutto il database storico (scansionando migliaia di documenti da anni fa) consuma risorse e letture Firestore inutilmente.
- **Regola**: I ricalcoli si eseguono solo sui mesi o sulle entità contrassegnati da log di errore o modifiche fuori data (`system_dirty_periods`). Se una modifica storica o un errore si verifica in maggio 2024, la Cloud Function notturna delle 03:00 ricalcola ed allinea **esclusivamente** quel periodo per poi cancellare il flag.

---

### 4. Schema Namespacing Rigoroso (`original/derived/edits`)
- **Lezione**: Interrogare il DB cercando campi a livello root (es. `where('clientId', '==', id)`) quando l'architettura usa il namespacing porta a query che restituiscono 0 risultati.
- **Regola**: Rispettare sempre l'incapsulamento `original.` per i dati sorgente, `derived.` per i calcolati e `edits.` per i metadata. Per garantire la retrocompatibilità con eventuali vecchi dati flat, implementare helper di fallback trasparenti.

---

### 5. Modularità Agnostica e Template First
- **Lezione**: I componenti ed i trigger core non devono mai contenere nomi di collezione o logiche rigide di moduli opzionali (es. `tickets`, `activities`, `contracts`, `products`).
- **Regola**: Modifiche ai moduli si scrivono sempre prima in `scripts/templates/modules/<modulo>/`. I file core iterano sui registri generati o installati, garantendo che l'aggiunta o rimozione di un modulo non richieda mai modifiche manuali ai file del core.

---

### 6. Riflessione Profonda & Approccio Sistemico (No Pezze Superficiali)
- **Lezione**: Quando si riscontra un'inesattezza o un tipo dato non ottimale (es. il formato di una data o la struttura di una query), correggere il singolo sintomo in fretta e furia è un errore grave. Se un difetto è visibile ad occhio nudo in un punto, esistono decine di pattern analoghi nell'intera codebase.
- **Regola**: Prima di toccare il codice, porsi sempre le domande fondamentali: *"Come otteniamo questa informazione? È il tipo dato ottimale per gli indici Firestore? Quali sono le implicazioni sul futuro?"*. Formalizzare prima la lezioni ed la regola architetturale nel notebook `decisions_and_lessons.md`, per poi condurre un audit sistemico su tutte le entità collegate.

---

### 7. Reversibilità e Ciclo di Vita Simmetrico dello Stato `derived` (`Azione ➔ Reversione = Stato 0`)
- **Lezione**: Ogni mutazione di uno stato calcolato (`derived.*`) deve avere un ciclo di vita completo e simmetrico. Se un'azione incrementa o aggiorna un contatore o uno stato (es. creazione di un'attività o di una rata), l'azione opposta (eliminazione o annullamento) deve riportare lo stato calcolato esattamente allo stato iniziale zero, senza lasciare residui orfani.
- **Regola**: Tutti i trigger di sincronizzazione dati devono gestire la scrittura completa via `onDocumentWritten` e ricalcolare gli aggregati in modo simmetrico (es. alla cancellazione dell'ultima attività, `activitiesCount` torna a 0 e `lastActivityDate` viene azzerato o ripristinato alla data precedente).

---

### 8. Scritture System Cache Esclusivamente Server-Side (Zero Cache Poisoning)
- **Lezione**: Consentire al client frontend di scrivere direttamente nella collezione di cache di sistema (`system_cache`) espone l'infrastruttura al rischio di *Cache Poisoning*, ovvero alla manomissione maliziosa o accidentale delle mappe di lookup (es. ID/Nomi clienti) condivise tra utenti.
- **Regola**: Le raccolte di cache di sistema (`system_cache`) sono in sola lettura per il client frontend (`allow read: if isAuth(); allow write: if false;`). L'aggiornamento dei chunk di cache viene guidato dai trigger backend o da ruoli Admin autorizzati.

---

### 9. Maturazione Provvigionale Basata su Incassi Reali (`Realized Payments`)
- **Lezione**: Calcolare o maturare provvigioni su contratti puramente teorici o non ancora incassati espone la PMI al rischio di pagare commissioni su crediti inesigibili o contratti successivamente annullati.
- **Regola**: Il calcolo ed il ricalcolo delle provvigioni si esegue in tempo reale al salvataggio o incasso effettivo delle rate (`onContractCreated` e `onInstallmentWrite`), tracciando la maturazione provvigionale in modo coerente tra incassi effettivi e liquidazione commissioni.

---

### 10. Guardia Anti-Loop Infinito Obbligatoria per Trigger Firestore (`isDerivedOnlyChange`)
- **Lezione**: I trigger `onDocumentWritten` che aggiornano i campi calcolati (`derived.*`) sullo stesso documento o su entità collegate rischiano di riattivare sé stessi all'infinito se non verificano che le modifiche riguardino solo lo stato `derived`.
- **Regola**: Tutti i trigger di scrittura (`onDocumentWritten`) devono includere tassativamente la guardia `if (before && after && isDerivedOnlyChange(before, after)) return;` prima di effettuare qualsiasi aggiornamento. Ogni piano d'implementazione e suite di test deve contenere un test unitario/di integrazione che certifichi l'assenza di loop infiniti.

---

### 11. Divieto Assoluto di Hardcoding di Regole o Trigger di Moduli Non Installati (Template-First)
- **Lezione**: Inserire manualmente nel codice core (es. `firestore.rules` o `functions/index.ts`) regole o export riferiti a moduli opzionali non ancora installati (es. `contracts`, `tickets`, `interventi`) viola l'architettura modulare agnostica di Gestoray ed altera lo stato dei moduli non attivi.
- **Regola**: Le regole Firestore, le Cloud Functions ed i componenti dei moduli opzionali devono risiedere **esclusivamente** nella directory dei loro template (`scripts/templates/modules/<modulo>/`). L'iniezione nei file core deve avvenire **unicamente** all'atto dell'installazione del modulo tramite CLI (`npm run module:install -- --name <modulo>`).

---

### 12. Standardizzazione UX Inviolabile della Gerarchia Visuale dei Moduli (`Page Top Actions ➔ SearchToolbar ➔ Data Card`)
- **Lezione**: Consentire che le diverse pagine dell'applicazione (Clienti, Contatti, Utenti, Qualifiche) posizionino la barra di ricerca, i filtri o i pulsanti di azione in posti diversi (es. alcune barre dentro la Card, altre sopra senza titolo, altre con formattazioni grafiche eterogenee) distrugge la consistenza UX. Gli utenti sono costretti a "riimparare" il layout ogni volta che cambiano sezione.
- **Regola**: Tutte le pagine elenco di Gestoray DEVONO seguire la stessa identica gerarchia e struttura visuale a 3 livelli:
  1. **Page Top Actions Bar (`page-top-actions`)**: In alto, Titolo con Icona + Sottotitolo descrittivo a sinistra, ed il Pulsante d'Azione Primario (es. `+ Nuovo Utente`, `+ Aggiungi Cliente`) a destra.
  2. **Centralized Search Toolbar (`SearchToolbar.svelte`)**: Posizionata sempre SUBITO SOTTO il titolo della pagina e PRIMA dei dati, composta da Input di ricerca a sinistra con icona integrata e reset `(X)`, e Filtri dinamici a tendina a destra.
  3. **Data Card (Table o Cards Grid)**: Contiene solo l'elenco/tabella dei dati e gli eventuali pulsanti di esportazione (CSV/Excel/PDF).

---

### 13. CacheLookupService Restituisce Solo `{ id, name }` — Mai Usare per Dati Completi (Dynamic Bridges)
- **Lezione**: `CacheLookupService.getLookup('products')` è un cache leggero chunked che restituisce esclusivamente `{ id: string; name: string }`. **Non contiene** campi come `price`, `unit`, `description`, `minimoFatturabile`, `sku`, ecc. Usarlo per popolare form di selezione prodotti con prezzo causa campi a `0` o vuoti.
- **Regola**: Quando un modulo necessita dei dati completi di un'entità di un altro modulo opzionale (es. `contracts` necessita dei prodotti completi con prezzo da `products`), utilizzare un **Dynamic Plugin Bridge** che importa condizionalmente il service del modulo sorgente:
  ```ts
  if ($menuConfigStore.some(m => m.id === 'products')) {
    const { ProductsService } = await import('../../products/products.service');
    productsCatalog = await ProductsService.getProducts();
  }
  ```
  Con fallback a `CacheLookupService.getLookup('products')` nel blocco `catch` per massima resilienza.

---

### 14. Il Campo Prezzo nei Prodotti si Chiama `price` (Non `listPrice` né `unitPrice`)
- **Lezione**: Lo schema `ProductItem` definisce il prezzo come `price: number`. Accedere a `found.listPrice` o `found.unitPrice` restituisce `undefined`, causando prezzo `0` nel form.
- **Regola**: Quando si legge il prezzo di un prodotto, utilizzare sempre la catena di fallback con `price` in prima posizione:
  ```ts
  const priceVal = parsePriceNumber(found.price ?? found.listPrice ?? found.unitPrice ?? 0);
  ```

---

### 15. Standardizzazione Inviolabile della Larghezza Form & Schede (100% Full-Width Standard)
- **Lezione**: Impostare limitazioni artificiali di larghezza massima (es. `max-width: 800px`, `max-width: 900px`) sulle schede di inserimento/modifica dati o sulle impostazioni genera disallineamenti sgradevoli tra le varie sezioni della piattaforma (es. form di Clienti, Qualifiche ed Utenti che occupano il 100% della pagina vs form di Contratti rimpiccioliti al centro con vistosi margini vuoti).
- **Regola**: TUTTE le pagine e schede di form/inserimento/dettaglio/impostazioni in Gestoray DEVONO occupare il **100% della larghezza disponibile** (`width: 100%`). È fatto **divieto assoluto** di impostare `max-width` o `margin: 0 auto` sui contenitori principali di pagina delle schede form. La distribuzione visiva dei campi deve essere gestita esclusivamente dal sistema interno di grid flessibile (`.form-group-row` / `.fields-grid`).

---

### 16. Contratti di Schema TypeScript & Prevenzione Disallineamento Chiavi (Zero Arbitrary Strings)
- **Lezione**: Accedere a nomi di proprietà liberi in stringhe o presupporre strutture annidate arbitrarie (es. `original.totalPrice` o `edits.createdAt`) quando un modulo definisce uno schema tipo `ContractItem` con campi a livello root (`totalAmount`, `createdAt`, `status`, `agentId`) crea silenziosamente disallineamenti in cui le query restituiscono `0` o array vuoti.
- **Regola**: 
  1. Ogni modulo deve definire ed esportare la propria interfaccia TypeScript di riferimento per i documenti Firestore (es. `ContractItem`, `ClientItem`, `ProductItem`).
  2. I servizi di dashboard, aggregazione ed analytics (sia client-side che Cloud Functions) DEVONO importare ed utilizzare i tipi ed helper di estrazione oppure supportare esplicitamente la lettura resiliente dei campi dichiarati negli schemi di modulo.
  3. È fatto divieto di scrivere query aggregate Firestore o filtri su stringhe rigide non verificate contro lo schema ufficiale del modulo. In fase di sviluppo, verificare sempre che i nomi campo nelle query coincidano esattamente con le chiavi salvate dal `Service.create` del modulo.

---

### 17. Dynamic KPI Bridges & Schema Field Registry (Agnostic Core Dashboard Standard)
- **Lezione**: Inserire `if (hasContracts)` o query hardcodate su collezioni di moduli opzionali (es. `contracts`, `payments`, `commissions_closings`) direttamente dentro il file Core `dashboard.service.ts` viola gravemente la modularità pura. Se un modulo viene disinstallato via CLI (`npm run module:uninstall`), il codice del Core rischia di rimanere sporco di riferimenti a collezioni morte.
- **Regola**:
  1. **Agnostic Core Dashboard**: `dashboard.service.ts` non deve contenere NESSUN riferimento cablato a collezioni di moduli opzionali. Deve agire esclusivamente come un orchestratore agnostico che interroga `modules.registry.json`.
  2. **Module KPI Bridge**: Ogni modulo opzionale che fornisce metriche o dati di aggregazione deve definire ed esportare un bridge dedicato (`<modulo>.kpi.bridge.ts`) collocato dentro il modulo stesso.
  3. **Schema Field Registry**: Ogni modulo deve definire nel proprio `module.json` la mappa dei metadati dei propri campi (`schema.fields`) indicando per ciascuna chiave il tipo, la descrizione e i tag di ruolo (`kpi:vss`, `filter:date`, `search`, ecc.).
  4. **Dynamic Import**: Il Core Dashboard carica ed invoca i KPI Bridges unicamente tramite `import()` dinamici in base ai moduli attualmente attivi in `modules.registry.json`. All'atto della disinstallazione di un modulo, il bridge viene rimosso ed il Core rimane pulito al 100%.

---

### 18. Dynamic Service Delegation across Core Services (Zero Optional Query Leaks in Core)
- **Lezione**: Inserire interrogazioni dirette a collezioni di moduli opzionali dentro servizi trasversali del Core come `client-detail.service.ts` (scheda cliente) o `todo.service.ts` (cose da fare) provoca errori di esecuzione e letture fallite se i moduli non sono installati.
- **Regola**: Servizi trasversali del Core NON devono interrogare direttamente le collezioni dei moduli opzionali. Devono sempre verificare che il modulo sia attivo in `$menuConfigStore` / `modules.registry.json` ed importare condizionalmente il bridge o il service fornito dal modulo medesimo via `import()` dinamici con blocco `try/catch`.

---

### 19. Unificazione Architetturale del Sistema KPI a Lato & Tooltip Glassmorfici (Zero Discrepanze UI)
- **Lezione**: Creare snippet ad-hoc o componenti separati (es. `AdminKPIs`, `CommercialKPIs`) per renderizzare i KPI a lato del grafico nella homepage con `titleAttr` o layout duplicati ha generato discrepanze visive, spaziatura non sincronizzata e la comparsa di tooltip nativi sgradevoli del browser invece dell'overlay custom.
- **Regola**:
  1. **Single Source of Truth**: Tutte le pagine (homepage `/dashboard` e tutte le sottopagine di modulo come `places`, `contracts`, `products`, `tickets`) DEVONO utilizzare il medesimo componente centralizzato `UniversalAnalyticsChart` e `KPITile`.
  2. **Tooltip Glassmorfico Unificato**: È severamente vietato l'uso di tooltip nativi HTML (`title` attribute) che confliggono con l'interfaccia. Tutte le etichette, bottoni tab e tessere KPI utilizzano il componente centralizzato Svelte 5 `$lib/components/Tooltip.svelte` con tema scuro glassmorfico, freccia geometrica di puntamento e ritardo controllato.
  3. **Zero Snippet Duplicati**: La colonna laterale dei KPI in `UniversalAnalyticsChart` calcola e visualizza automaticamente le metriche passate tramite `metrics`, ereditando `isActive`, `icon`, `title`, `value`, `subtitle` e `description` in modo identico e coerente in tutta l'applicazione.

---

### 20. Active KPI Tile Inverted Theme Switch (Zero Ring/Border Outlines)
- **Lezione**: L'uso di contorni o anelli di selezione netti (`box-shadow: 0 0 0 2px ...`) per identificare la tessera KPI attiva/selezionata risulta visivamente pesante e poco elegante. Inoltre, un'inversione di colori statica fallisce se l'utente cambia la palette di colori del brand.
- **Regola**:
  1. **Zero Border Ring Outlines**: Le card KPI selezionate non devono avere bordi o anelli spessi evidenziatori.
  2. **Inverted Dynamic Theme Switch**: Nello stato attivo, la tessera effettua un'inversione elegante dei colori:
     - Il background passa da bianco traslucido al gradiente dinamico del tema della tessera (`--color-primary-500` / `--color-primary-600`, `--color-secondary-400` / `--color-secondary-600`, ecc.).
     - La striscia superiore decorativa (`::before`) viene disattivata (`opacity: 0`).
     - I testi (etichetta, valore numerico e sottotitolo) passano a bianco ad alto contrasto (`#ffffff` / `rgba(255, 255, 255, 0.92)`).
     - L'icona passa ad un contenitore in vetro smerigliato translucido (`rgba(255, 255, 255, 0.24)`) con icona Lucide bianca.
     - L'elevazione visiva è gestita tramite uno spostamento tridimensionale morbido (`translateY(-4px)`) e un'ombra d'ambiente profonda.

---

### 21. Standardizzazione Iconografia Vettoriale (MANDATORY LUCIDE ICONS, Zero Raw Emojis)
- **Lezione**: L'uso di emoji Unicode di sistema (es. 📋, 🔄, 📌, 🛠️, 🎫, 📄, 🌐, ➕, ✏️, 🗑️, 📱, 🖨️) genera incongruenze grafiche evidenti tra piattaforme (Windows, macOS, Linux, iOS, Android), non supporta l'ereditarietà cromatica CSS (`currentColor` / `--color-primary`) e degrada l'esperienza visiva premium dell'ERP.
- **Regola**:
  1. **Solo Icone Vettoriali Lucide**: Tutti i pulsanti, badge, intestazioni di navigazione, placeholder di stato vuoto, indicatori di stato e metriche KPI devono utilizzare esclusivamente icone vettoriali da `@lucide/svelte`.
  2. **Divieto Assoluto di Emojis Raw**: È tassativamente vietato l'uso di emoji testuali OS all'interno dei template Svelte per elementi di interfaccia utente.

---

### 22. Invarianti Inviolabili di Versioning Transazionale & Audit Trail Immutabile (I1–I10)
- **Lezione**: Tracciare le modifiche tramite trigger asincroni (Cloud Functions v2) o permettere toggle UI per disabilitare l'audit trail crea falle critiche: perdita del contesto utente autenticato (`auth.uid`), race conditions senza Optimistic Concurrency Control (OCC) e buchi irreparabili nella tracciabilità legale (GDPR / ISO 27001).
- **Regola (10 Invarianti Formali)**:
  1. **I1 (Monotonic Version Numbering)**: Ogni mutazione incrementa `aggregateVersion` esattamente di `+1` rispetto a `baseVersion`. Versioni non contigue o backward sono respinte dalle Firestore Security Rules.
  2. **I2 (Identity & Hash Parity)**: Il documento dell'entità (`edits.lastLedgerId`) e la voce di ledger (`system_ledger/{id}`) mantengono un puntamento bidirezionale atomico immutabile.
  3. **I3 (Optimistic Concurrency Control - OCC)**: Ogni mutazione verifica transazionalmente che `currentAggregateVersion === expectedBaseVersion`. In caso di conflitto concorrente, la transazione fallisce immediatamente con `OptimisticConcurrencyError`.
  4. **I4 (Transactional ACID Dual-Write)**: L'aggiornamento dell'entità e la creazione della voce di ledger avvengono nella stessa `runTransaction(db, ...)` Firestore con garanzia ACID totale (entrambi scrivono o entrambi falliscono).
  5. **I5 (Dual-Semantic Rollback Engine)**: I rollback supportano sia campi assoluti (`ABSOLUTE`, con rilevamento atomico transazionale dei conflitti a valle `currentVal === mutation.new`) sia grandezze cumulative (`ADDITIVE`, delta compensativo `delta = old - new`).
  6. **I6 (Deep Value-Equality Differencing)**: Il diff engine calcola le variazioni reali tramite ricorsione strutturale (`deepEqual`), ignorando metadati tecnici e garantendo integrità su oggetti annidati e array.
  7. **I7 (Multi-Tenant Fail-Closed Isolation)**: Tutte le voci di ledger sono vincolate a `tenantId`. Letture e scritture cross-tenant sono bloccate a livello di Firestore Rules.
  8. **I8 (GDPR Right to be Forgotten with Legal Audit Preservation)**: In caso di oblìo GDPR, i dati identificativi dell'entità vengono anonimizzati, mentre le voci di ledger storiche conservano la traccia dell'evento con payload oscurato (`[CONTENUTO ANONIMIZZATO GDPR]`) in conformità all'Art. 17(3)(b) GDPR.
  9. **I9 (Server-Enforced Immutability)**: Le collezioni `system_ledger` e `system_ledger_reversals` hanno `allow update, delete: if false;` a livello di Firestore Rules. Nessun client (nemmeno Superadmin) può alterare o cancellare voci storiche.
  10. **I10 (Always-On Enterprise Audit Trail)**: L'audit trail è sempre attivo su tutte le entità di business (`clients`, `products`, `contracts`, `tickets`, `places`, `activities`). È vietata qualsiasi opzione UI o backdoor per disabilitare la registrazione.

---

### 23. Architettura Navigazione Globale (Core Back Navigation vs. Module List Action)
- **Lezione**: L'uso improprio di frecce a sinistra (`ArrowLeft`) con etichetta "Torna indietro" all'interno dei singoli moduli (schede di dettaglio o form) per reindirizzare all'elenco catalogo creava ambiguità semantica: l'utente arrivato su una pagina tramite un link contestuale (es. da un'attività a un cliente) cliccando "Torna indietro" si aspettava di tornare all'attività precedente, non di essere forzato all'elenco generale dei clienti.
- **Regola**:
  1. **Navigazione Storica di Competenza Esclusiva del Core**: La funzione di andare indietro nella cronologia (`NavigationService.goBack()`, `navigationHistory.ts`) appartiene unicamente alla Shell Core (`+layout.svelte`). È presente come pulsante globale persistente (sidebar desktop, header flottante desktop e mobile) e viene disabilitato dinamicamente alla radice (`/dashboard`) o quando non esiste cronologia.
  2. **Disaccoppiamento Azione Modulo ("Vai alla Lista")**: I moduli non implementano pulsanti di cronologia storica. I link di ritorno al catalogo o elenco del modulo utilizzano la classe `.btn-module-list`, l'icona vettoriale `<List size={16} />` (oppure `<Settings size={14} />` nelle configurazioni) ed etichette esplicite (es. *"Elenco Luoghi"*, *"Elenco Clienti"*, *"Catalogo Prodotti"*).
