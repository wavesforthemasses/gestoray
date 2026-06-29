# Preventivo Commerciale: Piattaforma CRM Gestoray

Benvenuto nella proposta commerciale per l'acquisizione della piattaforma **Gestoray**, una soluzione software CRM ed ERP di ultima generazione sviluppata su misura per ottimizzare le reti di vendita e automatizzare la gestione amministrativa, contabile e provvigionale delle imprese.

---

## 1. Descrizione Generale della Piattaforma
**Gestoray** è un'applicazione web altamente performante, progettata per operare in tempo reale. Unisce le funzionalità di un CRM commerciale con quelle di un sistema di tracciamento contratti, pianificazione delle rate, riconciliazione degli incassi e calcolo delle provvigioni. 

Grazie a un'architettura moderna basata su **Svelte 5** e **Firebase**, la piattaforma garantisce un'esperienza d'uso fluida, con aggiornamenti istantanei sui dispositivi di tutti i collaboratori senza necessità di ricaricare le pagine.

---

## 2. Caratteristiche Dettagliate e Moduli Funzionali

La piattaforma si suddivide in moduli integrati che coprono l'intero ciclo di vita del cliente e della vendita:

### A. Gestione Anagrafica Clienti e Pipeline Commerciale (CRM)
*   **Funnel dei Lead**: Gestione dei contatti attraverso quattro stati progressivi (*Prospect*, *Lead Caldo*, *Proposta Inviata*, *Customer*).
*   **Sicurezza dei Dati Fiscali**: Memorizzazione di Partita IVA, Codice Fiscale e dati di fatturazione con validazione automatica client-side per impedire la creazione di anagrafiche duplicate.
*   **Timeline delle Attività**: Tracciamento cronologico e collaborativo di ogni interazione (*Telefonate*, *Incontri di persona*, *Email inviate*) con aggiornamento automatico della data dell'ultimo contatto.
*   **Audit Log**: Storico di modifica anagrafica integrato per monitorare quali operatori hanno variato i dati aziendali.

### B. Preventivatore Rapido e Workflow dei Contratti
*   **Quotazioni Istantanee**: Modulo interno che permette ai commerciali di selezionare prodotti dal catalogo, impostare quantità e sconti, e generare un preventivo in tempo reale salvabile in bozza.
*   **Controllo di Soglia Prezzo (Warning)**: Sistema di allerta visiva qualora un prodotto venga venduto a un prezzo inferiore al limite minimo stabilito a catalogo. Il superadmin può forzare o autorizzare l'override di questo warning.
*   **Ripartizione Co-Selling**: Possibilità di dividere la vendita e le relative provvigioni tra due commerciali diversi (es. segnalatore e chiuditore), configurando la percentuale di split.
*   **Stato del Contratto**: Gestione dello stato dei contratti (*Pending*, *Approved*, *Cancelled*).

### C. Gestione Amministrativa, Scadenziari e Rateizzazioni
*   **Pianificazione Rate**: Suddivisione flessibile del valore contrattuale in una o più scadenze di pagamento (*Installments*).
*   **Allerta Ritardi (Sollecito)**: Evidenziazione visiva immediata (in rosso con la dicitura `SOLLECITARE CLIENTE!`) per le rate non saldate che superano la data di scadenza.
*   **Gestione Date di Scadenza**: Possibilità per l'amministrazione di posticipare le scadenze delle rate (con registrazione automatica del promemoria di chiamata nel diario del cliente) o di inserire nuove rate intermedie.

### D. Registro Incassi, Scorpora IVA e Riconciliazione
*   **Allocazione dei Pagamenti**: Possibilità di registrare un singolo incasso di cassa e allocarlo a uno o più contratti attivi del cliente.
*   **Calcolo IVA Intelligente (Scorpora IVA)**: Strumento rapido a un clic per lo scorporo automatico dell'IVA italiana al 22% (calcolo dell'imponibile netto al centesimo) per facilitare la contabilità aziendale.
*   **Riconciliazione Provvigionale**: Al saldo totale del contratto, il sistema cambia lo stato del contratto in *Approved*, porta il cliente a *Customer* e sposta lo stato delle provvigioni del commerciale da *Sospese* (in attesa di incasso) ad *Effettive* (pronte per la liquidazione).

### E. Collaboratori, Provvigioni e Ruoli
*   **Privilegi di Accesso (ACL)**: Gestione differenziata delle autorizzazioni per quattro ruoli principali:
    1.  `superadmin`: Accesso completo, gestione utenti, override delle soglie prezzo, eliminazione record.
    2.  `amministrazione`: Gestione finanziaria, approvazione contratti, pianificazione rate, inserimento incassi.
    3.  `direzione`: Visualizzazione analitica dei grafici e dei report in modalità di sola lettura.
    4.  `commerciale`: Inserimento anagrafiche, gestione delle proprie attività, emissione preventivi e tracciamento delle proprie provvigioni.
*   **Calcolo Provvigioni per Qualifica**: Il sistema applica automaticamente aliquote provvigionali differenti a seconda che il commerciale sia registrato come *Junior* o *Senior*.

### F. Business Intelligence, Export e Stampe
*   **Grafico di Andamento SVG**: Grafici interattivi e reattivi in SVG nativo per visualizzare l'andamento del fatturato mensile, con possibilità di filtrare le tabelle cliccando direttamente sui punti del grafico.
*   **Salvataggio Preferenze**: Salvataggio automatico delle preferenze di visualizzazione dell'utente (es. contrazione/espansione dei grafici) tramite memoria locale del browser.
*   **Esportazioni Professionali**: Download dei registri clienti, contratti e pagamenti nei formati standard CSV e Excel (.xls) con encoding UTF-8 BOM per garantire la perfetta leggibilità dei caratteri speciali e delle lettere accentate in Microsoft Excel.
*   **Stampa Ottimizzata**: CSS di stampa integrato per produrre copie cartacee o PDF pulite delle schede contratto, rimuovendo i menu di navigazione e i controlli interattivi.

---

## 3. Punti di Forza e Potenza Tecnologica
*   **Reattività Svelte 5 (Runes)**: Interfaccia utente fulminea grazie all'uso dei nuovi costrutti reattivi `$state` e `$derived`. Nessun ritardo di rendering.
*   **Database in Tempo Reale (Firestore)**: Sincronizzazione immediata dei dati tra tutti i dispositivi aziendali connessi. Se un commerciale inserisce un'attività o l'amministrazione registra un incasso, la dashboard si aggiorna istantaneamente per tutti gli altri utenti senza ricaricare.
*   **Zero Librerie Esterne per i Grafici**: Il modulo di grafici è renderizzato direttamente tramite vettori SVG generati dinamicamente da Svelte, mantenendo l'applicazione leggera e immune da problemi di compatibilità futuri.
*   **Automazione Backend (Cloud Functions Gen2)**: I calcoli finanziari, la sicurezza e la logica di transizione degli stati sono delegati a microservizi serverless (Node 20) che operano in ambienti protetti.

---

## 4. Limiti del Sistema e Requisiti di Esercizio
*   **Infrastruttura**: Richiede un progetto Google Firebase attivo (piano Blaze a consumo).
*   **Autenticazione senza Password**: La piattaforma utilizza codici PIN monouso inviati via email per l'accesso. L'invio delle email in produzione necessita dell'integrazione di un servizio SMTP di terze parti (es. SendGrid, Postmark, Mailgun) all'interno delle Cloud Functions.
*   **Ottimizzazioni per Grandi Volumi**: La visualizzazione delle liste attuali prevede il caricamento client-side. Per database con decine di migliaia di contratti, sarà opportuno implementare la paginazione server-side.

---

## 5. Valutazione Economica

La presente offerta prevede la fornitura della piattaforma software nello stato di fatto in cui si trova, con trasferimento completo del codice sorgente e supporto alla prima installazione sull'infrastruttura Firebase del cliente.

### Offerta Economica

*   **Licenza d'uso e Trasferimento Codice Sorgente**: Inclusa
*   **Configurazione Ambiente Cloud (Firebase)**: Inclusa
*   **Supporto al Collaudo e Deploy Iniziale**: Incluso

> [!IMPORTANT]
> **PREZZO OFFERTA**
> **€ 18.500,00** *(diciottomilacinquecento/00 euro)*
> *I prezzi si intendono IVA di legge esclusa. La manutenzione correttiva ed evolutiva successiva al collaudo sarà oggetto di eventuale contratto di assistenza separato.*
