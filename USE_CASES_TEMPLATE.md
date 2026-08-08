# 📋 Gestoray ERP — Catalogo Ufficiale dei 100 Use Cases & Flussi UX ("IL NUOVO ODOO")

> **Obiettivo**: Questo documento catalogherà **100 Use Cases Reali e Flussi Operativi** coprendo 100% dell'esperienza utente in Gestoray ERP. Dimostra come l'architettura modulare agnostica risponda con semplicità, velocità e zero fronzoli a qualsiasi scenario aziendale, definendo i criteri di misurazione dell'efficienza dei click, della chiarezza visiva e delle prestazioni UX.

---

## 👤 User Personas & Matrice dei Ruoli (RBAC)

| Ruolo | Codice | Descrizione Operativa |
|:---|:---:|:---|
| **Superadmin / Direzione** | `superadmin` | Accesso completo a tutti i moduli, impostazioni di sistema, configurazione dinamica del menu e gestione utenti. |
| **Amministrazione** | `amministrazione` | Gestione finanziaria, consuntivi, fatturazione, contratti, scadenze e pianificazione globale. |
| **Commerciale / Agente** | `commerciale` | Gestione anagrafica clienti, opportunità, contratti/preventivi e tracciamento delle proprie attività. |
| **Tecnico / Caposquadra** | `tecnico` | Gestione operativa degli interventi, coordinamento membri del team, compilazione delle bolle/consuntivi sul campo. |
| **Operaio / Operatore** | `operaio` | Visualizzazione delle proprie assegnazioni giornaliere (luoghi, mezzi, orari) e consuntivazione delle ore/materiali. |

---

## 🏬 Scenari Applicativi di Riferimento

### Scenario A: Servizi Edili, Sottofondi & Cantieri ("Massetti")
- **Cantieri (`places`)**: *Cantiere* | **Squadre (`teams`)**: *Squadra* | **Mezzi (`vehicles`)**: *Parco Furgoni* | **Pratiche (`projects`)**: *Commessa* | **Interventi (`interventi`)**: *Bolla (mq/mc)*

### Scenario B: Vendita, Installazione & Manutenzione Macchinari ("Frantoi")
- **Cantieri (`places`)**: *Sede Operativa* | **Squadre (`teams`)**: *Gruppo Tecnico* | **Mezzi (`vehicles`)**: *Attrezzatura* | **Pratiche (`projects`)**: *Pratica* | **Interventi (`interventi`)**: *Rapporto (pz/ore)*

---

## 💯 Catalogo dei 100 Use Cases Operativi (UC-001 ➔ UC-100)

### 📌 1. Anagrafica Clienti & Contatti (UC-001 ➔ UC-010)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-001** | Creazione Cliente Persona Giuridica (P.IVA/SDI) | `/dashboard/clients/add` (2 click) | `commerciale`, `amministrazione` | 10/10 | Form guidato full-width, autocompilazione maiuscolo, 0 scroll eccessivo. |
| **UC-002** | Inserimento Cliente Persona Fisica (Codice Fiscale) | `/dashboard/clients/add` (2 click) | `commerciale`, `amministrazione` | 9/10 | Toggle istantaneo tra Azienda e Privato, campi fiscali validati. |
| **UC-003** | Modifica Recapiti & Indirizzo Cliente | `/dashboard/clients/[id]/edit` (2 click) | `commerciale`, `amministrazione` | 8/10 | Precompilazione dati esistenti, salvataggio reattivo con toast. |
| **UC-004** | Ricerca Rapida Cliente via SearchToolbar | `/dashboard/clients` (1 click + digitazione) | Tutti i ruoli | 10/10 | Ricerca parziale istantanea su `derived.textSearch`, reset con `(X)`. |
| **UC-005** | Collegamento Referente ad un Cliente | `/dashboard/contacts` (2 click) | `commerciale`, `amministrazione` | 8/10 | Selezione cliente via autocomplete `linkedClientIds`, salvataggio atomico. |
| **UC-006** | Impostazione Privacy GDPR "Non Contattare" | `/dashboard/contacts` (2 click) | `commerciale`, `amministrazione` | 9/10 | Flag evidente con badge visivo di avvertimento rosso. |
| **UC-007** | Consultazione Scheda 360° Cliente | `/dashboard/clients/[id]` (1 click da lista) | Tutti i ruoli | 10/10 | Tab collegate (Cantieri, Contratti, Attività) senza ricaricare la pagina. |
| **UC-008** | Cambio Stato Cliente (Prospect ➔ Attivo) | `/dashboard/clients/[id]` (1 click) | `commerciale`, `amministrazione` | 8/10 | Badge di stato interattivo con cambio di colore immediato. |
| **UC-009** | Consultazione Storico Modifiche Cliente | `/dashboard/clients/[id]` (2 click) | `superadmin`, `amministrazione` | 7/10 | Audit log temporale pulito indicante utente e campo modificato. |
| **UC-010** | Eliminazione o Archiviazione Sicura Cliente | `/dashboard/clients/[id]` (2 click + confirm) | `superadmin` | 8/10 | Modale di conferma con controllo bloccante in caso di contratti pendenti. |

---

### 🏗️ 2. Cantieri & Sedi Operative (`places`) (UC-011 ➔ UC-020)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-011** | Creazione Cantiere da Scheda Cliente | Tab Cantieri Cliente ➔ `+ Nuovo` (2 click) | `commerciale`, `amministrazione` | 10/10 | Cliente intestatario autocompilato da URL param `clientId`. |
| **UC-012** | Creazione Cantiere Autonomo con Selezione Cliente | `/dashboard/places/add` (2 click) | `commerciale`, `amministrazione` | 9/10 | Autocomplete clienti con inserimento indirizzo e persona di riferimento. |
| **UC-013** | Navigazione da Bottone Cantiere a Nuova Attività | Scheda Cantiere ➔ `+ Nuova Attività` (1 click) | `commerciale`, `amministrazione` | 10/10 | Passaggio URL params `placeId` & `clientId` per compilazione zero-click. |
| **UC-014** | Mappa Ubicazione & Link Google Maps | `/dashboard/places/[id]` (1 click) | `tecnico`, `operaio` | 9/10 | Mappa embed nel side column e bottone "Apri in Google Maps" per navigatore. |
| **UC-015** | Cronoprogramma Lavori & Avanzamento Mini-Gantt | `/dashboard/places/[id]` (0 click, visibile) | `direzione`, `tecnico` | 10/10 | Card `PlaceTeamsInsights` con barra progresso % e badge stato squadre. |
| **UC-016** | Scheda Agenti di Riferimento (Top Sales & Primo) | `/dashboard/places/[id]` (0 click, visibile) | `direzione`, `commerciale` | 9/10 | Card `PlaceCommercialInsights` con Primo Commerciale e Top Seller (€). |
| **UC-017** | Consultazione Tab "Attività & Task" del Cantiere | `/dashboard/places/[id]` ➔ Tab Attività (1 click) | `tecnico`, `operaio` | 10/10 | Tab bridge dinamica con filtro rapide tra attive e completate. |
| **UC-018** | Consultazione Tab "Preventivi & Contratti" Cantiere | `/dashboard/places/[id]` ➔ Tab Contratti (1 click) | `amministrazione`, `commerciale` | 9/10 | Tab bridge dinamica con elenco contratti e totale economico. |
| **UC-019** | Modifica Istruzioni d'Accesso e Note Cantiere | `/dashboard/places/[id]/edit` (2 click) | `tecnico`, `commerciale` | 8/10 | TextArea prominente per indicazioni cancello, custode o DPI obbligatori. |
| **UC-020** | Cambio Stato Cantiere (Attivo ➔ Inattivo) | `/dashboard/places/[id]` (1 click) | `amministrazione`, `tecnico` | 8/10 | Toggle stato istantaneo con aggiornamento contatore e badge. |

---

### 📋 3. Attività, Task & Interventi (`activities`) (UC-021 ➔ UC-030)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-021** | Programmazione Nuova Attività Singola | `/dashboard/activities/add` (2 click) | `amministrazione`, `tecnico` | 10/10 | Form pulito con selezione data, titolo, priorità e cantiere. |
| **UC-022** | Selezione Vincolata Cliente ➔ Cantiere | `/dashboard/activities/add` (interazione form) | Tutti i ruoli | 10/10 | Scegliendo il cliente, il menu dei cantieri mostra solo ed esclusivamente i suoi. |
| **UC-023** | Autocompilazione Inversa Cliente da Cantiere | `/dashboard/activities/add` (interazione form) | Tutti i ruoli | 10/10 | Scegliendo prima il cantiere, il cliente titolare viene impostato subito. |
| **UC-024** | Schedulazione su Intervallo Date Multiple (`groupId`) | `/dashboard/activities/add` (interazione form) | `amministrazione`, `tecnico` | 9/10 | Generazione automatica di N attività giornaliere collegate dallo stesso gruppo. |
| **UC-025** | Assegnazione Multipla Utenti, Squadre e Mezzi | `/dashboard/activities/add` (interazione form) | `tecnico`, `amministrazione` | 10/10 | Componente tag multiselezione con supporto `type` ed `entityType`. |
| **UC-026** | Modifica in Cascata Gruppo Date (`updateAllGroup`) | `/dashboard/activities/[id]/edit` (2 click) | `tecnico`, `amministrazione` | 9/10 | Checkbox "Aggiorna tutte le date del gruppo" per ri-programmazione rapida. |
| **UC-027** | Avanzamento Stato Attività (Da Fare ➔ In Corso ➔ Fatto)| `/dashboard/activities` o Scheda (1 click) | `tecnico`, `operaio` | 10/10 | Cambio stato diretto con un solo click per l'operatore sul campo. |
| **UC-028** | Registrazione Consuntivo Ore & Materiali | Scheda Attività (2 click) | `tecnico`, `operaio` | 9/10 | Input numerici veloci con UdM predefinita (`ore`, `mq`, `pz`). |
| **UC-029** | Raccolta Firma Digitale del Cliente | Scheda Attività / Bolla (2 click) | `tecnico` | 9/10 | Canvas touch responsive per firma autografa cliente sul tablet. |
| **UC-030** | Filtraggio Attività in SearchToolbar | `/dashboard/activities` (1 click + digitazione) | Tutti i ruoli | 10/10 | Filtri combinati per operatore, cantiere, priorità e data. |

---

### 📄 4. Preventivi, Contratti & Ordini (`contracts`) (UC-031 ➔ UC-040)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-031** | Creazione Nuovo Preventivo/Contratto | `/dashboard/contracts/add` (2 click) | `commerciale`, `amministrazione` | 10/10 | Form commerciale guidato con selezione cliente, agente e scadenze. |
| **UC-032** | Selezione Prodotti da Catalogo & Prezzo | `/dashboard/contracts/add` (interazione righe) | `commerciale`, `amministrazione` | 10/10 | Autocomplete prodotti con lettura `price`, quantificatore ed sconti. |
| **UC-033** | Calcolo Automatico Imponibile, IVA e Totale | `/dashboard/contracts/add` (0 click, reattivo) | `commerciale`, `amministrazione` | 10/10 | Reattività `$derived` immediata senza ricaricare o premere "Calcola". |
| **UC-034** | Generazione Piano Rateale Scadenze Pagamento | `/dashboard/contracts/add` (1 click) | `amministrazione` | 9/10 | Calcolo automatico rate (es. 30/60/90 gg) con date ed importi suddivisi. |
| **UC-035** | Cambio Stato Contratto (Bozza ➔ Inviato ➔ Attivo) | `/dashboard/contracts/[id]` (1 click) | `amministrazione`, `commerciale` | 10/10 | Pulsante d'azione rapida per avanzamento stato e sblocco lavori. |
| **UC-036** | Rettifica Voci Contratto & Ricalcolo Rate | `/dashboard/contracts/[id]/edit` (2 click) | `amministrazione` | 8/10 | Modifica righe preventivo con aggiornamento automatico rate scadenze. |
| **UC-037** | Generazione & Download PDF Preventivo/Contratto | `/dashboard/contracts/[id]` (1 click) | `commerciale`, `amministrazione` | 9/10 | Layout Typst architect impeccabile scaricabile o inviabile via mail. |
| **UC-038** | Collegamento Contratto a Cantiere Specifico | `/dashboard/contracts/add` (interazione form) | `commerciale`, `amministrazione` | 9/10 | Dropdown cantieri filtrato sul cliente intestatario del contratto. |
| **UC-039** | Maturazione Provvigioni Agente su Incassi Reali | Automazione di sistema (0 click) | `amministrazione`, `commerciale` | 10/10 | Calcolo provvigionale attivato solo all'incasso effettivo delle rate. |
| **UC-040** | Consultazione Storico Contratti Cliente | Scheda Cliente ➔ Tab Contratti (1 click) | `commerciale`, `amministrazione` | 9/10 | Elenco contratti storici con totale cumulato (€) e stato approvazione. |

---

### 👥 5. Squadre Operative & Gestione Risorse (`teams`) (UC-041 ➔ UC-050)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-041** | Creazione Nuova Squadra & Nomina Caposquadra | `/dashboard/teams` ➔ `+ Nuova Squadra` (2 click) | `direzione`, `tecnico` | 9/10 | Nomina `leaderUid` e selezione colore/badge identificativo squadra. |
| **UC-042** | Assegnazione Drag-and-Drop Operatori Unassigned | `/dashboard/teams` (1 drag) | `tecnico`, `direzione` | 10/10 | Trascostamento intuitivo delle schede lavoratori nella squadra di destinazione. |
| **UC-043** | Impostazione Tariffa Giornaliera Predefinita | `/dashboard/teams` (interazione card) | `amministrazione`, `direzione` | 8/10 | Input costo/giornata per lavoratore usato nei consuntivi cantiere. |
| **UC-044** | Rimozione o Spostamento Lavoratore tra Squadre | `/dashboard/teams` (1 click / drag) | `tecnico` | 8/10 | Spostamento immediato con aggiornamento in tempo reale dei membri. |
| **UC-045** | Consultazione Scheda Dettaglio Squadra | `/dashboard/teams/[id]` (1 click) | Tutti i ruoli | 8/10 | Visualizzazione caposquadra, elenco membri e cantieri correntemente assegnati. |
| **UC-046** | Assegnazione Squadra ad Attività di Cantiere | Form Attività ➔ Sezione Squadre (1 click) | `tecnico`, `amministrazione` | 10/10 | Selezione squadra con inclusione automatica nel Cronoprogramma Gantt. |
| **UC-047** | Controllo Carico Lavoro Giornaliero Squadre | `/dashboard/scheduling` (1 click) | `direzione`, `tecnico` | 9/10 | Vista matrice per squadra indicante sovrapposizioni o giornate libere. |
| **UC-048** | Modifica Nome o Note Operative Squadra | `/dashboard/teams/[id]/edit` (2 click) | `tecnico` | 7/10 | Aggiornamento rapido denominazione (es. "Squadra Sottofondi Alpha"). |
| **UC-049** | Disattivazione o Archiviazione Squadra | `/dashboard/teams/[id]` (2 click) | `direzione` | 7/10 | Disattivazione pulita senza perdita dello storico attività svolte. |
| **UC-050** | Calcolo Totale Ore/Giornate Lavorate per Squadra | `/dashboard/places/[id]` (0 click) | `amministrazione`, `tecnico` | 9/10 | Riconciliazione automatica delle giornate operative nel cantiere. |

---

### 🚚 6. Mezzi Aziendali & Attrezzature (`vehicles`) (UC-051 ➔ UC-060)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-051** | Inserimento Nuovo Mezzo/Furgone con Targa | `/dashboard/vehicles/add` (2 click) | `amministrazione`, `tecnico` | 9/10 | Form con targa `licensePlate`, modello, anno e categoria mezzo. |
| **UC-052** | Nomina Conducente / Responsabile Principale | `/dashboard/vehicles/add` (1 click) | `tecnico` | 8/10 | Dropdown utenti per assegnazione `assignedDriverUid`. |
| **UC-053** | Impostazione Scadenze Revisione & Assicurazione | `/dashboard/vehicles/[id]` (2 click) | `amministrazione` | 9/10 | Inserimento date scadenza con integrazione nello Scadenzario Allarmi. |
| **UC-054** | Assegnazione Mezzo a Cantiere/Attività | Form Attività ➔ Mezzi (1 click) | `tecnico`, `operaio` | 10/10 | Selezione rapida mezzo usata dall'operaio per sapere quale guida usare. |
| **UC-055** | Cambio Stato Mezzo (Disponibile ➔ Manutenzione)| `/dashboard/vehicles/[id]` (1 click) | `tecnico` | 9/10 | Badge di stato evidente con inibizione assegnazione ad altre attività. |
| **UC-056** | Scheda Dettaglio Mezzo con Storico Assegnazioni | `/dashboard/vehicles/[id]` (1 click) | Tutti i ruoli | 8/10 | Elenco storico cantieri e tecnici che hanno utilizzato il furgone. |
| **UC-057** | Filtraggio Parco Mezzi per Categoria | `/dashboard/vehicles` (1 click) | Tutti i ruoli | 8/10 | Pillole filtro per Furgoni, Macchinari, Silos ed Attrezzatura. |
| **UC-058** | Aggiornamento Chilometraggio / Ore Lavoro | `/dashboard/vehicles/[id]` (1 click) | `tecnico`, `operaio` | 8/10 | Input numerico rapido per aggiornamento contatore usura. |
| **UC-059** | Dismissione o Archiviazione Mezzo | `/dashboard/vehicles/[id]` (2 click) | `amministrazione` | 7/10 | Archiviazione mezzo mantenendo inalterati i consuntivi storici. |
| **UC-060** | Allarme Visivo Scadenza Revisione Imminente | Top Header / Dashboard (0 click) | `amministrazione`, `tecnico` | 10/10 | Banner/badge di avviso rosso per revisione o assicurazione in scadenza. |

---

### 📦 7. Catalogo Prodotti, Servizi & Listini (`products`) (UC-061 ➔ UC-070)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-061** | Inserimento Articolo Catalogo con SKU & Prezzo | `/dashboard/products/add` (2 click) | `amministrazione`, `commerciale` | 10/10 | Form con codice SKU, denominazione e prezzo unitario `price`. |
| **UC-062** | Assegnazione Unità di Misura (`mq`, `mc`, `pz`, `ora`) | `/dashboard/products/add` (1 click) | `amministrazione` | 10/10 | Dropdown integrato con le unità validate da `UnitsOfMeasureService`. |
| **UC-063** | Ricerca Articolo per Codice SKU o Categoria | `/dashboard/products` (1 click + digitazione) | Tutti i ruoli | 10/10 | SearchToolbar con filtraggio istantaneo su codice e nome. |
| **UC-064** | Modifica Prezzo di Listino o Prezzo Minimo | `/dashboard/products/[id]/edit` (2 click) | `amministrazione`, `direzione` | 9/10 | Input valuta con formattazione Euro `€` ed aggiornamento listini. |
| **UC-065** | Descrizione Tecnica Estesa & Specifiche | `/dashboard/products/[id]/edit` (2 click) | `commerciale`, `tecnico` | 8/10 | TextArea per schede tecniche usate nelle stampe preventivo. |
| **UC-066** | Disattivazione Articolo dal Catalogo | `/dashboard/products/[id]` (1 click) | `amministrazione` | 8/10 | Toggle stato che nasconde l'articolo dalle nuove selezioni contrattuali. |
| **UC-067** | Autocompilazione Prezzo su Preventivi/Contratti | Form Contratto ➔ Selezione Prodotto (1 click) | `commerciale` | 10/10 | Inserimento automatico del prezzo unitario predefinito con modifica eventuale. |
| **UC-068** | Importazione Massiva Catalogo Prodotti CSV | `/dashboard/settings/import` (3 click) | `superadmin`, `amministrazione` | 8/10 | Procedura wizard di caricamento file CSV con mappatura colonne. |
| **UC-069** | Esportazione Elenco Prodotti CSV / Excel | `/dashboard/products` (1 click) | `amministrazione` | 8/10 | Bottone `Esporta CSV` che scarica la lista filtrata corrente. |
| **UC-070** | KPI Prodotti Più Venduti in Dashboard | Home Dashboard (0 click) | `direzione`, `amministrazione` | 9/10 | Matrice KPI alimentata da `products.kpi.bridge.ts`. |

---

### 💳 8. Scadenzario, Incassi & Allarmi (`deadlines`, `payments`) (UC-071 ➔ UC-080)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-071** | Consultazione Scadenzario Rate del Mese | `/dashboard/deadlines` (1 click) | `amministrazione`, `direzione` | 10/10 | Vista tabellare con evidenziatori cromatici per rate scadute/in scadenza. |
| **UC-072** | Registrazione Saldo Rata Contratto | `/dashboard/deadlines` ➔ `Salda` (1 click) | `amministrazione` | 10/10 | Modale rapido d'incasso con data e metodo di pagamento. |
| **UC-073** | Inserimento Allarme Scadenza Personalizzato | `/dashboard/deadlines/add` (2 click) | Tutti i ruoli | 9/10 | Form con data scadenza, entità collegata e preavviso giorni. |
| **UC-074** | Configurazione Preavviso Promemoria (es. 30/15 gg)| Form Scadenza (interazione) | `amministrazione` | 8/10 | Pillole selezioni preavviso giorni per avvisi preventivi. |
| **UC-075** | Riconciliazione Parziale Rata Insoluta | `/dashboard/deadlines` (2 click) | `amministrazione` | 9/10 | Registrazione importo parziale incassato con ricalcolo residuo. |
| **UC-076** | Filtraggio Rate per Stato (Scadute / Saldate) | `/dashboard/deadlines` (1 click) | `amministrazione` | 10/10 | Pillole filtro stato per immediato controllo crediti insoluti. |
| **UC-077** | Avviso Visivo Rate Insolute in Dashboard | Home Dashboard (0 click) | `amministrazione`, `direzione` | 10/10 | Card `adminOverdueInstallments` con totale € da incassare. |
| **UC-078** | Consultazione Liquidazione Provvigioni Agenti | `/dashboard/commissions` (1 click) | `amministrazione`, `commerciale` | 9/10 | Prospetto provvigionale maturato sugli incassi reali. |
| **UC-079** | Chiusura & Saldo Provvigione al Commerciale | `/dashboard/commissions` (2 click) | `amministrazione` | 9/10 | Registrazione liquidazione provvigioni con aggiornamento stato. |
| **UC-080** | Esportazione Report Flussi d'Incasso in Excel | `/dashboard/deadlines` (1 click) | `amministrazione` | 8/10 | Download file XLS/CSV per riconciliazione bancaria. |

---

### 📅 9. Scheduling & Agenda Pianificazione Operativa (UC-081 ➔ UC-090)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-081** | Consultazione Agenda Globale Mese/Settimana | `/dashboard/scheduling` (1 click) | `amministrazione`, `tecnico` | 10/10 | Calendario interattivo responsive con viste Mese, Settimana e Giorno. |
| **UC-082** | Filtraggio Eventi per Tipologia (Attività/Scadenze)| `/dashboard/scheduling` (1 click) | Tutti i ruoli | 9/10 | Toggle filtri per mostrare/nascondere interventi, task o scadenze. |
| **UC-083** | Assegnazione Slot Orario (Mattina/Pomeriggio) | Form Scheduling (1 click) | `tecnico`, `amministrazione` | 9/10 | Selettore slot orario predefinito o orario custom HH:mm. |
| **UC-084** | Spostamento Evento in Agenda via Drag-and-Drop | `/dashboard/scheduling` (1 drag) | `tecnico`, `amministrazione` | 10/10 | Trascostamento evento con aggiornamento automatico data su Firestore. |
| **UC-085** | Vista Calendario Filtrata per Singola Squadra | `/dashboard/scheduling` (1 click) | `tecnico` | 9/10 | Filtro squadra per verificare la saturazione lavorativa del team. |
| **UC-086** | Accesso Mobile all'Agenda Personale Operatore | `/dashboard/scheduling` (1 click) | `operaio`, `tecnico` | 10/10 | Vista smartphone ottimizzata con indicazione cantiere, orario e furgone. |
| **UC-087** | Click Evento Calendario ➔ Apertura Dettaglio | `/dashboard/scheduling` (1 click su evento) | Tutti i ruoli | 10/10 | Modale/drawer informativo con link diretto alla scheda cantiere/attività. |
| **UC-088** | Rilevamento Visivo Conflitti Assegnazione Mezzi | `/dashboard/scheduling` (0 click, visibile) | `tecnico` | 9/10 | Evidenziatore rosso in caso di doppio impegno dello stesso mezzo/operatore. |
| **UC-089** | Stampa / Esportazione Programma Giornaliero | `/dashboard/scheduling` (1 click) | `tecnico` | 8/10 | Layout di stampa sintetico da consegnare alle squadre la mattina. |
| **UC-090** | Aggiornamento Reattivo Stato Eventi in Agenda | `/dashboard/scheduling` (0 click, live) | Tutti i ruoli | 10/10 | Cambiamento colore evento al completamento dell'attività sul campo. |

---

### ⚙️ 10. Impostazioni, Ruoli, Profilo & System Operations (UC-091 ➔ UC-100)

| ID | Nome Use Case | Percorso & Click | Ruoli Chiave | Rilevanza (1-10) | Aspettativa UX & Ergonomia |
|:---|:---|:---|:---:|:---:|:---|
| **UC-091** | Personalizzazione Naming Agnostico Moduli | `/dashboard/settings/places` ecc. (2 click) | `superadmin` | 10/10 | Impostazione singolare/plurale (`cantiere`, `squadra`, `furgone`, `commessa`). |
| **UC-092** | Configurazione Numerazione & Prefissi Codici | `/dashboard/settings/[modulo]` (2 click) | `superadmin` | 9/10 | Impostazione prefisso (`LUG-`, `CON-`, `ACT-`) e padding cifre. |
| **UC-093** | Creazione Utente di Sistema & Assegnazione Ruoli | `/dashboard/users/add` (2 click) | `superadmin` | 10/10 | Form creazione utente con scelta ruoli (RBAC) e credenziali d'accesso. |
| **UC-094** | Assegnazione Qualifiche & Certificazioni Utente | `/dashboard/users/[id]` (2 click) | `superadmin` | 8/10 | Selezione qualifiche professionali (es. *Gruista*, *Patente C*, *PTP*). |
| **UC-095** | Personalizzazione Ordine Voci Menu Laterale | `/dashboard/settings/menu` (2 click) | `superadmin` | 9/10 | Drag-and-drop riordinamento voci di menu salvato in `settings/menu`. |
| **UC-096** | Attivazione / Disattivazione Feature Flag Modulo | `/dashboard/settings/modules` (2 click) | `superadmin` | 10/10 | Switch ON/OFF attivazione moduli a livello di tenant. |
| **UC-097** | Modifica Password & Profilo Utente Corrente | `/dashboard/profile` (2 click) | Tutti i ruoli | 9/10 | Form aggiornamento dati personali e credenziali. |
| **UC-098** | Gestione Cose da Fare Personali (`/todo`) | `/dashboard/todo` (1 click) | Tutti i ruoli | 9/10 | Lista task personali con spunta rapida e contatore in sidebar. |
| **UC-099** | Esecuzione Oblìo & Anonimizzazione GDPR | `/dashboard/settings/gdpr` (3 click + confirm) | `superadmin` | 9/10 | Bonifica atomica backend dei dati personali cliente/utente. |
| **UC-100** | Personalizzazione Palette Colori Brand (`app.css`)| `/dashboard/settings/project` (2 click) | `superadmin` | 9/10 | Cambio dinamico delle variabili HSL `--brand-h` e `--brand-s` in tempo reale. |

---

## 📈 Matrice di Valutazione UX & Click Efficiency

| Punteggio Click | Efficienza Ergonomica | Criterio di Valutazione |
|:---:|:---|:---|
| **5 / 5 (Eccellente)** | **1 - 2 Click** | L'azione principale si completa immediatamente, i dati chiave sono in prima vista senza scroll. |
| **4 / 5 (Ottimo)** | **3 Click** | Flusso fluido con form ben strutturati ed autocompilazione reattiva. |
| **3 / 5 (Sufficiente)** | **4 - 5 Click** | Richiede alcuni passaggi intermedi o modali secondari. |
| **< 3 / 5 (Da Ottimizzare)** | **> 5 Click / Eccessivo Scroll** | Flusso macchinoso che necessita di scorciatoie o riorganizzazione della gerarchia visiva. |
