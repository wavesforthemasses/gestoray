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

### 5. Modolarità Agnostica e Template First
- **Lezione**: I componenti ed i trigger core non devono mai contenere nomi di collezione o logiche rigide di moduli opzionali (es. `tickets`, `activities`, `contracts`).
- **Regola**: Modifiche ai moduli si scrivono sempre prima in `scripts/templates/modules/<modulo>/`. I file core iterano sui registri generati o installati, garantendo che l'aggiunta o rimozione di un modulo non richieda mai modifiche manuali ai file del core.

---

### 6. Riflessione Profonda & Approccio Sistemico (No Pezze Superficiali)
- **Lezione**: Quando si riscontra un'inesattezza o un tipo dato non ottimale (es. il formato di una data o la struttura di una query), correggere il singolo sintomo in fretta e furia è un errore grave. Se un difetto è visibile ad occhio nudo in un punto, esistono decine di pattern analoghi nell'intera codebase.
- **Regola**: Prima di toccare il codice, porsi sempre le domande fondamentali: *"Come otteniamo questa informazione? È il tipo dato ottimale per gli indici Firestore? Quali sono le implicazioni sul futuro?"*. Formalizzare prima la lezioni ed la regola architetturale nel notebook `decisions_and_lessons.md`, per poi condurre un audit sistemico su tutte le entità collegate.

---

---

### 8. Reversibilità e Ciclo di Vita Simmetrico dello Stato `derived` (`Azione ➔ Reversione = Stato 0`)
- **Lezione**: Ogni mutazione di uno stato calcolato (`derived.*`) deve avere un ciclo di vita completo e simmetrico. Se un'azione incrementa o aggiorna un contatore o uno stato (es. creazione di un'attività o di una rata), l'azione opposta (eliminazione o annullamento) deve riportare lo stato calcolato esattamente allo stato iniziale zero, senza lasciare residui orfani.
- **Regola**: Tutti i trigger di sincronizzazione dati devono gestire la scrittura completa via `onDocumentWritten` e ricalcolare gli aggregati in modo simmetrico (es. alla cancellazione dell'ultima attività, `activitiesCount` torna a 0 e `lastActivityDate` viene azzerato o ripristinato alla data precedente).

---

### 9. Scritture System Cache Esclusivamente Server-Side (Zero Cache Poisoning)
- **Lezione**: Consentire al client frontend di scrivere direttamente nella collezione di cache di sistema (`system_cache`) espone l'infrastruttura al rischio di *Cache Poisoning*, ovvero alla manomissione maliziosa o accidentale delle mappe di lookup (es. ID/Nomi clienti) condivise tra utenti.
- **Regola**: Le raccolte di cache di sistema (`system_cache`) sono in sola lettura per il client frontend (`allow read: if isAuth(); allow write: if false;`). L'aggiornamento dei chunk di cache viene guidato dai trigger backend o da ruoli Admin autorizzati.

---

### 10. Maturazione Provvigionale Basata su Incassi Reali (`Realized Payments`)
- **Lezione**: Calcolare o maturare provvigioni su contratti puramente teorici o non ancora incassati espone la PMI al rischio di pagare commissioni su crediti inesigibili o contratti successivamente annullati.
- **Regola**: Il calcolo ed il ricalcolo delle provvigioni si esegue in tempo reale al salvataggio o incasso effettivo delle rate (`onContractCreated` e `onInstallmentWrite`), tracciando la maturazione provvigionale in modo coerente tra incassi effettivi e liquidazione commissioni.

---

### 11. Guardia Anti-Loop Infinito Obbligatoria per Trigger Firestore (`isDerivedOnlyChange`)
- **Lezione**: I trigger `onDocumentWritten` che aggiornano i campi calcolati (`derived.*`) sullo stesso documento o su entità collegate rischiano di riattivare sé stessi all'infinito se non verificano che le modifiche riguardino solo lo stato `derived`.
- **Regola**: Tutti i trigger di scrittura (`onDocumentWritten`) devono includere tassativamente la guardia `if (before && after && isDerivedOnlyChange(before, after)) return;` prima di effettuare qualsiasi aggiornamento. Ogni piano d'implementazione e suite di test deve contenere un test unitario/di integrazione che certifichi l'assenza di loop infiniti.

---

### 12. Divieto Assoluto di Hardcoding di Regole o Trigger di Moduli Non Installati (Template-First)
- **Lezione**: Inserire manualmente nel codice core (es. `firestore.rules` o `functions/index.ts`) regole o export riferiti a moduli opzionali non ancora installati (es. `contracts`, `tickets`, `interventi`) viola l'architettura modulare agnostica di Gestoray ed altera lo stato dei moduli non attivi.
- **Regola**: Le regole Firestore, le Cloud Functions ed i componenti dei moduli opzionali devono risiedere **esclusivamente** nella directory dei loro template (`scripts/templates/modules/<modulo>/`). L'iniezione nei file core deve avvenire **unicamente** all'atto dell'installazione del modulo tramite CLI (`npm run module:install -- --name <modulo>`).

---

---

### 12. Standardizzazione UX Inviolabile della Gerarchia Visuale dei Moduli (`Page Top Actions ➔ SearchToolbar ➔ Data Card`)
- **Lezione**: Consentire che le diverse pagine dell'applicazione (Clienti, Contatti, Utenti, Qualifiche) posizionino la barra di ricerca, i filtri o i pulsanti di azione in posti diversi (es. alcune barre dentro la Card, altre sopra senza titolo, altre con formattazioni grafiche eterogenee) distrugge la consistenza UX. Gli utenti sono costretti a "riimparare" il layout ogni volta che cambiano sezione.
- **Regola**: Tutte le pagine elenco di Gestoray DEVONO seguire la stessa identica gerarchia e struttura visuale a 3 livelli:
  1. **Page Top Actions Bar (`page-top-actions`)**: In alto, Titolo con Icona + Sottotitolo descrittivo a sinistra, ed il Pulsante d'Azione Primario (es. `+ Nuovo Utente`, `+ Aggiungi Cliente`) a destra.
  2. **Centralized Search Toolbar (`SearchToolbar.svelte`)**: Posizionata sempre SUBITO SOTTO il titolo della pagina e PRIMA dei dati, composta da Input di ricerca a sinistra con icona integrata e reset `(X)`, e Filtri dinamici a tendina a destra.
  3. **Data Card (Table o Cards Grid)**: Contiene solo l'elenco/tabella dei dati e gli eventuali pulsanti di esportazione (CSV/Excel/PDF).

### 13. CacheLookupService Restituisce Solo `{ id, name }` — Mai Usare per Dati Completi
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



