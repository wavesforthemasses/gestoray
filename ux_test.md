# CRM Gestoray - Registro Completo delle 80 Micro-Azioni e Scenari d'Uso (UX Test)

Questo documento contiene l'elenco completo e dettagliato delle **80 micro-azioni** di utilizzo reale del CRM Gestoray, strutturate sotto forma di brevi scenari ("storielline"). Gli scenari coprono l'intero spettro di operazioni di lettura, scrittura, aggiornamento, eliminazione, correzione di errori di inserimento dati, e gestione delle eccezioni e permessi sui diversi ruoli della piattaforma.

---

## INDICE DEGLI SCENARI

*   [Sezione 1: Gestione Anagrafica Clienti (Azioni 1-15)](#sezione-1-gestione-anagrafica-clienti-azioni-1-15)
*   [Sezione 2: Gestione Attività e Contatti Commerciali (Azioni 16-25)](#sezione-2-gestione-attività-e-contatti-commerciali-azioni-16-25)
*   [Sezione 3: Emissione, Modifica e Override Contratti (Azioni 26-45)](#sezione-3-emissione-modifica-e-override-contratti-azioni-26-45)
*   [Sezione 4: Gestione Rate, Posticipazioni e Rientri (Azioni 46-55)](#sezione-4-gestione-rate-posticipazioni-e-rientri-azioni-46-55)
*   [Sezione 5: Registrazione, Allocazione e Storno Incassi (Azioni 56-70)](#sezione-5-registrazione-allocazione-e-storno-incassi-azioni-56-70)
*   [Sezione 6: Gestione Collaboratori, Ruoli e Provvigioni (Azioni 71-75)](#sezione-6-gestione-collaboratori-ruoli-e-provvigioni-azioni-71-75)
*   [Sezione 7: Dashboard, BI, Export e Stampe (Azioni 76-80)](#sezione-7-dashboard-bi-export-e-stampe-azioni-76-80)

---

### SEZIONE 1: Gestione Anagrafica Clienti (Azioni 1-15)

#### Azione 1: Creazione Lead Prospect
*   **Storia**: Il commerciale *Fabio* incontra un potenziale cliente in fiera e inserisce per la prima volta nel CRM l'azienda *"Alfa Group S.r.l."*. Compila solo nome e e-mail.
*   **Comportamento**: Viene creato un documento `/clients/{clientId}` con stato impostato su `prospect` e il campo `derived.contractsCount` a zero.

#### Azione 2: Correzione dell'Email Errata
*   **Storia**: *Fabio* si accorge di aver digitato `info@alfa.grup.it` anziché `info@alfagroup.it`. Entra nei dettagli del cliente, clicca su *"Modifica Anagrafica"*, corregge l'indirizzo e salva.
*   **Comportamento**: Il campo `original.email` viene aggiornato. La subcollection `history` registra il vecchio e il nuovo valore per l'audit log.

#### Azione 3: Inserimento P.IVA e Codice Fiscale
*   **Storia**: Per preparare il preventivo, l'amministratrice *Elena* richiede i dettagli fiscali di *"Alfa Group S.r.l."*. Li inserisce nei campi appositi salvando la scheda.
*   **Comportamento**: Vengono valorizzati `original.partitaIva` e `original.codiceFiscale`.

#### Azione 4: Aggiunta Numero di Telefono Principale
*   **Storia**: Il commerciale vuole avere a portata di mano il contatto telefonico. Aggiunge il telefono fisso dell'azienda nella scheda.
*   **Comportamento**: Viene aggiornato `original.phone`.

#### Azione 5: Inserimento Note Generali sul Cliente
*   **Storia**: *Fabio* scrive una nota libera: *"Cliente molto interessato a contratti pluriennali"*.
*   **Comportamento**: La nota viene aggiunta all'array `original.notes` con marcatore temporale e autore.

#### Azione 6: Tentativo di Creazione Duplicato (Blocco Visivo)
*   **Storia**: Un altro commerciale tenta di inserire *"Alfa Group S.r.l."* con lo stesso identificativo fiscale.
*   **Comportamento**: Il frontend intercetta la partita IVA identica e mostra un messaggio di avvertimento bloccando l'invio.

#### Azione 7: Cambio Stato Cliente in Lead Caldo
*   **Storia**: A seguito di un feedback positivo, *Fabio* cambia lo stato del cliente da `prospect` a `lead_caldo` per scopi di marketing.
*   **Comportamento**: Il campo `original.status` cambia. L'audit log cattura lo spostamento di stato.

#### Azione 8: Assegnazione di un Cliente a un Commerciale Specifico
*   **Storia**: Il superadmin riassegna il cliente *"Alfa Group S.r.l."* a *Commerciale 2* per bilanciare i carichi di lavoro.
*   **Comportamento**: Il campo `original.createdBy` o un campo dedicato di assegnazione viene aggiornato per tracciare il proprietario della provvigione.

#### Azione 9: Rimozione Note Obsolete
*   **Storia**: Una vecchia nota commerciale non è più rilevante. Il commerciale clicca sulla croce accanto alla nota per rimuoverla.
*   **Comportamento**: L'array `original.notes` viene sovrascritto escludendo l'elemento eliminato.

#### Azione 10: Visualizzazione Elenco Clienti con Filtro Prospect
*   **Storia**: La direzione vuole vedere quanti potenziali clienti non hanno ancora un contratto. Apre l'elenco clienti e imposta il filtro su `prospect`.
*   **Comportamento**: Viene eseguita una query Firestore filtrata per `original.status == 'prospect'`.

#### Azione 11: Ricerca Rapida Cliente e Scorciatoia Preventivo
*   **Storia**: Il commerciale incontra un cliente storico ("Alfa Group S.r.l.") e ha bisogno di redigere subito un nuovo preventivo. Apre l'elenco clienti, inserisce nel campo di ricerca la partita IVA (o una parte del nome), avvia la ricerca (limitata per prestazioni su database da 150k record) e clicca sul pulsante rapido "Nuovo Preventivo".
*   **Comportamento**: Viene eseguita una query lato server con filtro prefisso su `original.nome` o uguaglianza su `original.partitaIva` (con limite max 50/100 record). Facendo clic su "Nuovo Preventivo", il frontend reindirizza l'utente a `/dashboard/clients/{id}?tab=quotes` attivando direttamente la scheda del preventivatore pre-selezionata.

#### Azione 12: Lettura Scheda Cliente in Sola Lettura
*   **Storia**: L'utente *Direzione* apre la scheda di *"Alfa Group S.r.l."* per controllare lo storico delle attività.
*   **Comportamento**: L'interfaccia nasconde tutti i pulsanti di modifica/salvataggio in base al ruolo.

#### Azione 13: Tentativo di Eliminazione Cliente con Contratti Attivi (Blocco)
*   **Storia**: Il commerciale tenta di eliminare un cliente che ha già un contratto approvato a sistema.
*   **Comportamento**: Le regole di sicurezza Firestore o il client-side respingono la richiesta poiché `derived.contractsCount > 0`.

#### Azione 14: Eliminazione Fisica di un Cliente Errato (Senza Contratti)
*   **Storia**: Inserito un cliente di test per errore. Il Superadmin lo elimina fisicamente dal database.
*   **Comportamento**: Il documento `/clients/{clientId}` viene rimosso definitivamente.

#### Azione 15: Ripristino Logico del Cliente tramite Ricreazione
*   **Storia**: Rimosso erroneamente un lead, il commerciale lo ricrea reinserendo gli stessi dati.
*   **Comportamento**: Si genera un nuovo ID documento, ricominciando lo storico da zero.

---

### SEZIONE 2: Gestione Attività e Contatti Commerciali (Azioni 16-25)

#### Azione 16: Registrazione Telefonata conoscitiva
*   **Storia**: *Fabio* chiama *"Alfa Group S.r.l."* e registra l'attività di tipo *"Telefonata"* inserendo i dettagli dell'esito.
*   **Comportamento**: Scrittura in `/clients/{clientId}/activities/{activityId}`.

#### Azione 17: Log di un Incontro di persona
*   **Storia**: *Fabio* fa visita al cliente e logga l'attività di tipo *"Incontro di persona"* con l'accordo verbale preso.
*   **Comportamento**: Creazione del relativo documento attività. La Cloud Function aggiorna la data dell'ultimo contatto sul cliente.

#### Azione 18: Registrazione Email Inviata
*   **Storia**: Invio della proposta commerciale tramite email. Il commerciale copia il testo principale dell'email nel log attività.
*   **Comportamento**: Aggiunta attività di tipo *"Email"*.

#### Azione 19: Correzione di una Nota Attività Errata
*   **Storia**: Il commerciale nota un errore ortografico in una nota attività inserita poco fa. Modifica la nota e salva.
*   **Comportamento**: Aggiornamento del campo `original.notes` del record dell'attività.

#### Azione 20: Visualizzazione Timeline Attività del Cliente
*   **Storia**: Il direttore commerciale vuole verificare quante interazioni ha avuto *"Alfa Group"* prima di decidere lo sconto.
*   **Comportamento**: Query sulla subcollection `/clients/{clientId}/activities` ordinata per `original.date desc`.

#### Azione 21: Eliminazione di un'Attività Doppia
*   **Storia**: Per un click di troppo, la stessa telefonata è stata registrata due volte. Il commerciale ne cancella una.
*   **Comportamento**: Rimozione del documento attività. La Cloud Function decrementa `derived.activitiesCount`.

#### Azione 22: Log di Attività da parte dell'Amministrazione
*   **Storia**: L'amministrazione chiama il cliente per un sollecito di pagamento e lo registra come attività.
*   **Comportamento**: Creazione attività con ruolo `amministrazione` come autore.

#### Azione 23: Filtro delle Attività per Operatore
*   **Storia**: La direzione vuole vedere quante telefonate ha effettuato nello specifico il venditore *Fabio*.
*   **Comportamento**: Query su `collectionGroup('activities')` con filtro `original.loggedBy == 'uid_fabio'`.

#### Azione 24: Tentativo di Modifica Attività Altrui (Bloccato)
*   **Storia**: Un venditore tenta di modificare la nota di una telefonata registrata da un suo collega.
*   **Comportamento**: Le security rules bloccano l'operazione verificando `request.auth.uid == resource.data.original.loggedBy`.

#### Azione 25: Audit Log di Modifica Attività
*   **Storia**: Viene corretta una nota attività critica. Il sistema scrive un record di tracciamento modifiche.
*   **Comportamento**: Scrittura automatica nel log di storico annesso.

---

### SEZIONE 3: Emissione, Modifica e Override Contratti (Azioni 26-45)

#### Azione 26: Creazione Contratto in Stato Pending
*   **Storia**: Il commerciale stipula una bozza per *"Consulenza SEO"* da €1000. L'ordine viene salvato in stato `pending`.
*   **Comportamento**: Documento inserito in `/contracts/` con `original.status = 'pending'`.

#### Azione 27: Aggiunta Prodotto Singolo al Contratto
*   **Storia**: Il commerciale aggiunge un secondo servizio (*Campagna Google Ads*) al contratto prima di inviarlo.
*   **Comportamento**: L'array `original.products` viene esteso. Il valore `original.totalPrice` si aggiorna.

#### Azione 28: Applicazione Prezzo sotto la Soglia Minima (Warning)
*   **Storia**: Per chiudere il deal, il commerciale inserisce un prezzo di €250 su un prodotto che ha soglia minima €300.
*   **Comportamento**: Il sistema salva il contratto ma imposta `original.hasWarning = true` e mostra un avviso grafico arancione.

#### Azione 29: Ripartizione Provvigionale con Co-Selling (30%)
*   **Storia**: Il contratto è stato gestito in coppia. Il venditore principale imposta un co-seller al 30%.
*   **Comportamento**: I campi `original.secondVendorUid` e `original.secondVendorShare` vengono salvati.

#### Azione 30: Calcolo Provvigioni per Venditore Junior
*   **Storia**: Il contratto viene creato da un commerciale avente qualifica `junior`.
*   **Comportamento**: La Cloud Function applica le percentuali ridotte per junior e scrive il calcolo finale nel derived del contratto.

#### Azione 31: Calcolo Provvigioni per Venditore Senior
*   **Storia**: Il contratto viene creato da un venditore `senior`.
*   **Comportamento**: La Cloud Function applica le tabelle provvigionali massime.

#### Azione 32: Correzione Quantità Prodotto in un Contratto Pending
*   **Storia**: Il cliente contesta il preventivo: voleva 2 licenze anziché 3. Il commerciale corregge la quantità.
*   **Comportamento**: Il totale del contratto si aggiorna e la Cloud Function ricalcola le provvigioni sospese.

#### Azione 33: Tentativo di Modifica Contratto Approved (Blocco)
*   **Storia**: Un commerciale prova a modificare l'importo di un contratto che l'amministrazione ha già approvato.
*   **Comportamento**: Le regole del database bloccano l'operazione in quanto lo stato è diverso da `pending`.

#### Azione 34: Annullamento Contratto in Pending
*   **Storia**: Il cliente decide di non firmare più. Il commerciale sposta lo stato del contratto in `cancelled`.
*   **Comportamento**: Lo stato del contratto cambia. Le provvigioni precedentemente stimate vengono rimosse dal cumulato pendente del venditore.

#### Azione 35: Eliminazione Contratto Errato (Superadmin)
*   **Storia**: Un contratto duplicato è stato inserito a sistema. Il superadmin lo elimina definitivamente.
*   **Comportamento**: Il documento viene cancellato dal DB. I contatori dei contratti del cliente vengono ricalcolati.

#### Azione 36: Cambio di Co-Seller prima dell'Approvazione
*   **Storia**: Il commerciale si accorda per dare la provvigione di co-selling a un collega diverso. Modifica il secondo venditore.
*   **Comportamento**: La Cloud Function sturna la provvigione sospesa dal primo collega e la assegna al secondo.

#### Azione 37: Modifica Prezzo da parte dell'Amministrazione
*   **Storia**: L'amministrazione nota che il prezzo inserito non corrisponde alla firma. Modifica il prezzo del contratto in pending per allinearlo.
*   **Comportamento**: Il totale e le provvigioni vengono ricalcolati istantaneamente.

#### Azione 38: Ricalcolo Provvigione per Upgrade Listino
*   **Storia**: Un prodotto viene venduto a un prezzo superiore rispetto al listino consigliato.
*   **Comportamento**: La Cloud Function riconosce il margine extra e aumenta la provvigione del commerciale (over-performance reward).

#### Azione 39: Override del Warning Prezzo da parte del Superadmin
*   **Storia**: Il superadmin convalida lo sconto speciale applicato dal commerciale, rimuovendo visivamente l'allerta di prezzo sotto soglia.
*   **Comportamento**: Il campo `original.hasWarning` viene impostato a `false`.

#### Azione 40: Ricerca Contratti per ID Venditore
*   **Storia**: Il commerciale *Luca* apre la sua sezione per controllare l'elenco dei contratti su cui ha lavorato.
*   **Comportamento**: Query su `/contracts` con filtro `original.vendorUid == luca_uid`.

#### Azione 41: Lettura Contratti con Filtro Scaduti (Direzione)
*   **Storia**: La direzione estrae l'elenco dei contratti in attesa da più di 30 giorni.
*   **Comportamento**: Query con filtro temporale sulla data di creazione.

#### Azione 42: Aggiunta Allegato Firmato (Riferimento)
*   **Storia**: Il commerciale inserisce il link al contratto firmato nel campo note del contratto.
*   **Comportamento**: Aggiornamento delle note del contratto.

#### Azione 43: Allineamento automatico dei Saldi alla Creazione
*   **Storia**: Un nuovo contratto da €2000 viene creato.
*   **Comportamento**: Il database imposta automaticamente `derived.totalPaid = 0` e `derived.totalRemaining = 2000`.

#### Azione 44: Tentativo di Co-selling oltre il 100% (Blocco)
*   **Storia**: Il commerciale prova a inserire una quota co-selling del 110%.
*   **Comportamento**: Il frontend restituisce un errore di validazione impedendo il salvataggio.

#### Azione 45: Verifica Provvigioni Sospese sul Profilo Venditore
*   **Storia**: Il venditore apre la sua dashboard personale e vede che la provvigione calcolata sul contratto pending è tra quelle "in attesa".
*   **Comportamento**: Lettura del campo `/users/{uid}/derived.totalCommissionPending`.

---

### SEZIONE 4: Gestione Rate, Posticipazioni e Rientri (Azioni 46-55)

#### Azione 46: Pianificazione Nuova Rata (Amministrazione)
*   **Storia**: L'amministrazione approva un contratto e pianifica una rata da scadere tra 30 giorni.
*   **Comportamento**: Scrittura nella subcollection `installments` del contratto.

#### Azione 47: Posticipazione Data di Scadenza Rata
*   **Storia**: Il cliente chiede più tempo per pagare la prima rata. L'amministrazione clicca su *"Posticipa"* e inserisce una nuova data.
*   **Comportamento**: Aggiornamento del campo `original.dueDate` del documento rata.

#### Azione 48: Rettifica Importo Rata Pianificata
*   **Storia**: Errore di digitazione: la rata doveva essere di €500 anziché €600. L'operatore modifica l'importo atteso della rata ancora pending.
*   **Comportamento**: Aggiornamento di `original.expectedAmount`.

#### Azione 49: Generazione automatica di Allerta Rata Scaduta
*   **Storia**: La data corrente supera la data di scadenza di una rata rimasta in attesa.
*   **Comportamento**: Il frontend calcola lo sfasamento temporale e mostra la riga in rosso con la scritta *"SOLLECITARE CLIENTE!"*.

#### Azione 50: Eliminazione di una Rata Pianificata per Errore
*   **Storia**: L'amministratore inserisce per sbaglio una terza rata inesistente e la cancella.
*   **Comportamento**: Eliminazione del documento rata. La Cloud Function aggiorna il contatore complessivo delle rate del contratto.

#### Azione 51: Visualizzazione Scadenziario Globale
*   **Storia**: L'amministrazione vuole vedere tutte le rate in scadenza questo mese per tutte le aziende.
*   **Comportamento**: Query `collectionGroup('installments')` ordinata per data di scadenza.

#### Azione 52: Segnatura Rata come Pagata Parzialmente
*   **Storia**: Il cliente paga solo €300 della rata da €500. L'amministrazione registra l'incasso parziale sulla rata.
*   **Comportamento**: Lo stato della rata rimane `pending` o `partial` e viene valorizzato il parziale pagato.

#### Azione 53: Transizione Rata a Riscossione Completata
*   **Storia**: Il saldo della rata viene interamente riscosso.
*   **Comportamento**: Lo stato passa a `paid`, viene compilata la data di effettivo incasso.

#### Azione 54: Spostamento di tutte le scadenze per ferie
*   **Storia**: L'azienda chiude ad agosto, tutte le rate di agosto vengono posticipate a settembre.
*   **Comportamento**: Modifica manuale o tramite script di ciascuna scadenza rata interessata.

#### Azione 55: Ricalcolo date scadenze sul Contratto Padre
*   **Storia**: Viene posticipata la prima rata del contratto.
*   **Comportamento**: La Cloud Function rileva la scrittura e aggiorna `derived.nextInstallmentDate` sul contratto.

---

### SEZIONE 5: Registrazione, Allocazione e Storno Incassi (Azioni 56-70)

#### Azione 56: Registrazione Incasso di Cassa Generico
*   **Storia**: Arriva un bonifico di €1000 da *"Alfa Group"*. L'amministrazione crea il record incasso senza assegnarlo subito ad un contratto.
*   **Comportamento**: Inserimento in `/payments/{payId}`. Il residuo da distribuire è impostato al 100%.

#### Azione 57: Allocazione dell'Incasso al Contratto
*   **Storia**: L'amministratore assegna l'incasso di €1000 al contratto *"Consulenza SEO"*.
*   **Comportamento**: Creazione di `/payments/{payId}/contractsPaid/{contractId}`.

#### Azione 58: Ricalcolo del Saldo Rimanente del Contratto (Metà Pagato)
*   **Storia**: Il contratto da €2000 riceve l'allocazione dell'incasso da €1000.
*   **Comportamento**: La Cloud Function aggiorna il contratto impostando `derived.totalPaid = 1000` e `derived.totalRemaining = 1000`.

#### Azione 59: Approvazione automatica del Contratto al raggiungimento del Saldo
*   **Storia**: Viene registrato un secondo incasso da €1000 sul contratto da €2000 (che era in pending).
*   **Comportamento**: La Cloud Function rileva che `totalPaid >= totalPrice` e cambia lo stato del contratto in `approved` automaticamente.

#### Azione 60: Scorporo automatico dell'IVA al 22%
*   **Storia**: L'operatore inserisce un pagamento lordo e preme *"Scorpora IVA"* nel modal di incasso rata.
*   **Comportamento**: Il valore numerico viene diviso per 1.22 e arrotondato a due decimali sul frontend prima del salvataggio.

#### Azione 61: Storno dell'Incasso per Errore di Associazione
*   **Storia**: L'amministratore si rende conto di aver associato l'incasso al contratto sbagliato. Clicca su elimina nel dettaglio incasso.
*   **Comportamento**: Viene eliminata l'allocazione. La Cloud Function sturna il pagato del contratto e aggiorna il residuo.

#### Azione 62: Cancellazione Totale di un Incasso dal Registro
*   **Storia**: Un bonifico inserito a sistema è stato respinto dalla banca. Il Superadmin cancella l'intero incasso dal registro contabile.
*   **Comportamento**: Vengono eliminati il documento di pagamento e tutte le sue sotto-allocazioni.

#### Azione 63: Spostamento di un Contratto da Approved a Pending a causa di Storno
*   **Storia**: Un contratto approvato perde il suo unico pagamento a causa di uno storno amministrativo.
*   **Comportamento**: Il totale pagato torna a €0, la Cloud Function reimposta lo stato su `pending`.

#### Azione 64: Distribuzione di un singolo Incasso su due Contratti Diversi
*   **Storia**: Il cliente fa un unico bonifico da €1500 per pagare due contratti attivi (uno da €1000 e uno da €500).
*   **Comportamento**: Vengono create due allocazioni sotto lo stesso ID pagamento.

#### Azione 65: Visualizzazione del Registro Incassi del Mese
*   **Storia**: L'amministrazione estrae la lista di tutti gli incassi eseguiti nel mese per fare la riconciliazione bancaria.
*   **Comportamento**: Query ordinata su `/payments` con filtro temporale.

#### Azione 66: Verifica del Saldo Rimanente Cliente nella Scheda Anagrafica
*   **Storia**: Il venditore controlla se il cliente ha pendenze prima di proporre un nuovo servizio.
*   **Comportamento**: Lettura del valore `derived.totalRemaining` sulla scheda del cliente.

#### Azione 67: Tentativo di inserimento Importo Negativo (Blocco)
*   **Storia**: Un operatore prova a inserire un incasso di -€100 per registrare uno storno.
*   **Comportamento**: Il sistema restituisce errore: per gli storni va usata la funzione di storno ufficiale.

#### Azione 68: Tracciamento Utente su Registrazione Incasso
*   **Storia**: L'amministrazione vuole sapere chi ha inserito un determinato pagamento a sistema.
*   **Comportamento**: Il sistema legge `original.recordedEmail` memorizzato all'atto della creazione.

#### Azione 69: Esportazione Excel dei Pagamenti Ricevuti
*   **Storia**: Il commercialista richiede la lista dei pagamenti per la dichiarazione dei redditi.
*   **Comportamento**: Clic sul pulsante esporta che genera il foglio di calcolo dai dati della tabella.

#### Azione 70: Riconciliazione automatica provvigione a Incasso Avvenuto
*   **Storia**: Il contratto viene saldato al 100%.
*   **Comportamento**: Le provvigioni del commerciale passano da "sospese" ad "effettive" nel suo profilo utente.

---

### SEZIONE 6: Gestione Collaboratori, Ruoli e Provvigioni (Azioni 71-75)

#### Azione 71: Creazione Profilo Nuovo Venditore
*   **Storia**: Viene assunto un nuovo commerciale, *Stefano*. Il Superadmin gli crea l'anagrafica utente con ruolo `commerciale`.
*   **Comportamento**: Creazione documento in `/users/` con qualifica `junior` di default.

#### Azione 72: Promozione di un Venditore da Junior a Senior
*   **Storia**: *Stefano* supera il periodo di prova e viene promosso a `senior`. Il Superadmin aggiorna la sua qualifica.
*   **Comportamento**: Il campo `original.qualification` passa a `senior`. I calcoli provvigionali sui suoi contratti futuri useranno le nuove percentuali.

#### Azione 73: Variazione Ruolo in Amministrazione
*   **Storia**: Un dipendente cambia reparto e passa all'amministrazione. Il Superadmin ne modifica i ruoli abilitando l'approvazione dei contratti.
*   **Comportamento**: L'array `original.roles` dell'utente viene aggiornato.

#### Azione 74: Disattivazione Account Collaboratore
*   **Storia**: Un commerciale lascia l'azienda. Il Superadmin ne revoca i ruoli per impedirgli l'accesso al CRM.
*   **Comportamento**: L'array dei ruoli viene svuotato o viene impostato un flag `disabled = true`.

#### Azione 75: Visualizzazione Report Provvigionale Personale
*   **Storia**: Il commerciale *Stefano* controlla quanto ha guadagnato questo mese per pianificare le sue vendite.
*   **Comportamento**: Il frontend legge e visualizza i campi `derived.totalCommissionEarned` del suo profilo.

---

### SEZIONE 7: Dashboard, BI, Export e Stampe (Azioni 76-80)

#### Azione 76: Consultazione Grafico di Andamento Fatturato
*   **Storia**: Il direttore generale accede alla dashboard e analizza l'istogramma del fatturato diviso per mese.
*   **Comportamento**: Query aggregata che popola il componente grafico.

#### Azione 77: Filtro Dashboard per Singolo Venditore
*   **Storia**: La direzione analizza il rendimento del venditore *Fabio* filtrando i dati della dashboard.
*   **Comportamento**: Il grafico esegue query filtrate per `vendorUid`.

#### Azione 78: Esportazione Registro Contratti in CSV
*   **Storia**: La direzione scarica l'elenco dei contratti dell'anno in formato CSV per elaborazioni esterne.
*   **Comportamento**: Il frontend cicla sui contratti e genera il file scaricabile.

#### Azione 79: Stampa della Scheda Dettaglio Contratto
*   **Storia**: Il commerciale stampa la scheda cartacea del contratto da portare all'incontro di persona.
*   **Comportamento**: Click su stampa che attiva il foglio di stile CSS specifico per print di Svelte.

#### Azione 80: Espansione/Contrazione del Pannello Grafici
*   **Storia**: L'utente preferisce nascondere i grafici per avere più spazio per la tabella dati. Clicca sul pulsante di compressione.
*   **Comportamento**: Lo stato viene salvato in `localStorage` per mantenere la preferenza al successivo accesso.

---

### SEZIONE 8: Scene Ideali di Processo Vendite, Invito, Ricerca e Chiusura Provvigioni (Azioni 81-86)

#### Azione 81: Creazione, Invito e Primo Accesso Collaboratore
*   **Storia**: Il Superadmin accede alla sezione "Gestione Utenti", inserisce i dettagli del commerciale "Stefano" (email, nome, cognome, qualifica 'junior' e ruolo 'commerciale') e crea l'account. A Stefano viene notificata la creazione (con un PIN di sicurezza temporaneo). Stefano accede alla pagina di Login, inserisce l'email ed il PIN, e completa con successo l'accesso iniziale al CRM.
*   **Comportamento**: Scrittura del record su Firebase Auth e Firestore `/users/{uid}`, e verifica corretta del PIN via Cloud Function `verifyLoginPin`.

#### Azione 82: Paternità delle Anagrafiche e Filtri Commerciali
*   **Storia**: Stefano accede alla piattaforma. Essendo appena registrato, la sua lista clienti è vuota. Crea una nuova anagrafica per "Beta S.r.l." inserendo i dati aziendali. Poiché le impostazioni di default prevedono la paternità dei lead, Stefano visualizza esclusivamente le proprie anagrafiche, nascondendo quelle degli altri commerciali.
*   **Comportamento**: Query Firestore filtrata per `original.createdBy == request.auth.uid`.

#### Azione 83: Ricerca Sotto-Stringa in Firebase per Clienti, Utenti e Prodotti (textSearch)
*   **Storia**: Stefano deve trovare il cliente "Alpha Group S.r.l." scrivendo solo "Group" o la Partita IVA. Il sistema esegue una ricerca indicizzata e performante senza caricare tutto l'archivio.
*   **Comportamento**: All'inserimento/modifica dei record, viene popolato l'array `derived.textSearch` contenente tutte le combinazioni sequenziali delle parole del nome. La query Firestore esegue un filtro `array-contains` sul termine di ricerca.

#### Azione 84: Log Attività dell'Incontro e Chiusura Task dell'Agenda
*   **Storia**: Stefano effettua una chiamata a "Beta S.r.l." ed fissa un incontro in presenza. Logga la telefonata e segna l'appuntamento sul To-Do. Una volta avvenuto l'incontro, clicca sul task To-Do, lo segna come completato e registra il log dell'incontro.
*   **Comportamento**: Creazione di una scheda attività in `/clients/{id}/activities` e aggiornamento automatico dello stato del To-Do e dei KPI statistici (`derived.lastActivityDate` e `derived.activitiesCount`).

#### Azione 85: Firma Olografa del Cliente e Validazione Contratto
*   **Storia**: Stefano presenta il preventivo a "Beta S.r.l." sul tablet. Il referente accetta e firma olograficamente direttamente sullo schermo del tablet nel pannello dedicato. Stefano salva la firma olografa e passa il contratto all'amministrazione.
*   **Comportamento**: Salvataggio del base64 della firma nel campo `original.signature` del contratto e trigger di aggiornamento stato.

#### Azione 86: Chiusura Provvigionale Amministrativa Mensile
*   **Storia**: L'amministratore accede alla pagina "Gestione Provvigioni" a fine mese. Seleziona il mese precedente e visualizza il riepilogo delle provvigioni provvisorie. Le provvigioni sono calcolate **esclusivamente** sulla porzione di incassi (payments) che è stata **allocata ai contratti** (tramite le subcollection `contractsPaid`). Un incasso generico non collegato a un contratto viene ignorato ai fini provvigionali, in quanto è il contratto a stabilire le percentuali ed i venditori assegnatari (primario e co-seller). L'amministratore clicca su "Approva e Rendi Definitive" per congelare la massa provvigionale del mese calcolata su questi incassi. I commerciali ricevono lo sblocco per l'emissione fattura.
*   **Comportamento**: Lettura dei `payments` nel range di date, estrazione delle relative allocazioni in `contractsPaid`, recupero dei dati dei `contracts` allocati per identificare il `vendorUid` e calcolo importi. Infine, scrittura del record consolidato in `/commissions_closings/{periodId}`.
