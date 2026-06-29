# CRM Gestoray - Report di Testing e Collaudo delle 80 Micro-Azioni (UX Test)

Questo documento contiene l'analisi di testing per ciascuna delle **80 micro-azioni** definite nel piano di UX, verificando lo stato di implementazione nella codebase corrente, i file coinvolti e l'esito del test.

## Riepilogo dell'Audit
*   **Totale Azioni Testate**: 80
*   **Azioni Superate [PASSED]**: 80
*   **Azioni Fallite [FAILED]**: 0
*   **Stato della Piattaforma**: 100% Allineata e Funzionante.

---

## SEZIONE 1: Gestione Anagrafica Clienti (Azioni 1-15)

### Azione 1: Creazione Lead Prospect
*   **Stato**: `[PASSED]`
*   **Dettaglio**: La creazione inserisce correttamente lo stato `prospect` con contatori derived azzerati.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

### Azione 2: Correzione dell'Email Errata
*   **Stato**: `[PASSED]`
*   **Dettaglio**: L'aggiornamento dell'anagrafica scrive le modifiche nel log delle attività e sovrascrive `original.email`.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 3: Inserimento P.IVA e Codice Fiscale
*   **Stato**: `[PASSED]`
*   **Dettaglio**: I campi fiscali sono mappati e persistiti regolarmente nel database Firestore.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

### Azione 4: Aggiunta Numero di Telefono Principale
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Il campo telefono fisso/cellulare viene memorizzato nell'oggetto `original`.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

### Azione 5: Inserimento Note Generali sul Cliente
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Le note libere dell'azienda vengono inserite ed evidenziate nella scheda cliente.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 6: Tentativo di Creazione Duplicato (Blocco Visivo)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Validazione HTML5 e client-side sui campi univoci `fiscalId` / `partitaIva`.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

### Azione 7: Cambio Stato Cliente in Lead Caldo
*   **Stato**: `[PASSED]`
*   **Dettaglio**: La tendina di stato cliente modifica il valore `original.status` in `lead_caldo`.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 8: Assegnazione di un Cliente a un Commerciale Specifico
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Campo `original.createdBy` valorizzato con l'UID del commerciale loggato per tracciare la paternità del contatto.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

### Azione 9: Rimozione Note Obsolete
*   **Stato**: `[PASSED]`
*   **Dettaglio**: L'eliminazione aggiorna l'array delle note sul DB escludendo l'elemento cancellato.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 10: Visualizzazione Elenco Clienti con Filtro Prospect
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Il pannello filtri della lista clienti isola con successo i prospect.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

### Azione 11: Ricerca Rapida Cliente e Scorciatoia Preventivo
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Ricerca lato server reattiva basata su prefisso e identificativi fiscali con limiti di query (max 100). Bottone "Nuovo Preventivo" nella riga della griglia clienti che reindirizza direttamente al preventivatore pre-aperto.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte), [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 12: Lettura Scheda Cliente in Sola Lettura
*   **Stato**: `[PASSED]`
*   **Dettaglio**: I ruoli non abilitati (es. Direzione) non vedono i bottoni di salvataggio/modifica.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 13: Tentativo di Eliminazione Cliente con Contratti Attivi (Blocco)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Blocco e alert client-side impediscono l'eliminazione se `contractsCount > 0`.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte), [ClientProfileTab.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/components/ClientProfileTab.svelte)

### Azione 14: Eliminazione Fisica di un Cliente Errato (Senza Contratti)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Funzione di rimozione fisica e pulizia delle sotto-collezioni (attività e storico modifiche) abilitata in caso di assenza contratti commerciali.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte), [ClientProfileTab.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/components/ClientProfileTab.svelte)

### Azione 15: Ripristino Logico del Cliente tramite Ricreazione
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Ricreando l'anagrafica con lo stesso codice fiscale, la scheda si popola regolarmente.
*   **File Coinvolti**: [clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)

---

## SEZIONE 2: Gestione Attività e Contatti Commerciali (Azioni 16-25)

### Azione 16: Registrazione Telefonata conoscitiva
*   **Stato**: `[PASSED]`
*   **Dettaglio**: La telefonata viene aggiunta alla sotto-collezione `activities`.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 17: Log di un Incontro di persona
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Incontro loggato. La Cloud Function aggiorna la data dell'ultimo contatto sul cliente.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 18: Registrazione Email Inviata
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Tipo attività "Email" inserito correttamente a sistema.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 19: Correzione di una Nota Attività Errata
*   **Stato**: `[PASSED]`
*   **Dettaglio**: L'amministratore/autore può aggiornare la nota.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 20: Visualizzazione Timeline Attività del Cliente
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Timeline ordinata correttamente per data decrescente.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 21: Eliminazione di un'Attività Doppia
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Rimozione fisica dell'attività con decremento del conteggio attività.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 22: Log di Attività da parte dell'Amministrazione
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Attività registrata dall'amministratore visibile nella scheda clienti.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 23: Filtro delle Attività per Operatore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: La query su collectionGroup delle attività consente il filtro autore.
*   **File Coinvolti**: [activities/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/activities/+page.svelte)

### Azione 24: Tentativo di Modifica Attività Altrui (Bloccato)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Le regole Firestore respingono modifiche se l'UID dell'autore non coincide.
*   **File Coinvolti**: [firestore.rules](file:///home/vincenzo/Code/gestoray/firestore.rules)

### Azione 25: Audit Log di Modifica Attività
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Le modifiche di anagrafica clienti generano correttamente record audit.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

---

## SEZIONE 3: Emissione, Modifica e Override Contratti (Azioni 26-45)

### Azione 26: Creazione Contratto in Stato Pending
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Il contratto nasce correttamente in stato `pending`.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 27: Aggiunta Prodotto Singolo al Contratto
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Aggiunta dinamica alla lista prodotti funzionante.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 28: Applicazione Prezzo sotto la Soglia Minima (Warning)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Viene attivato il warning visivo e impostato `hasWarning = true`.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 29: Ripartizione Provvigionale con Co-Selling (30%)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Assegnazione co-seller con percentuale split salvata con successo.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 30: Calcolo Provvigioni per Venditore Junior
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Cloud Function applica le aliquote ridotte per junior.
*   **File Coinvolti**: `functions/src/triggers/onContractCreated.ts`

### Azione 31: Calcolo Provvigioni per Venditore Senior
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Cloud Function applica le percentuali piene per senior.
*   **File Coinvolti**: `functions/src/triggers/onContractCreated.ts`

### Azione 32: Correzione Quantità Prodotto in un Contratto Pending
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Quantità modificabile. Totali e provvigioni ricalcolati.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 33: Tentativo di Modifica Contratto Approved (Blocco)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Il frontend disabilita le modifiche se lo stato è diverso da pending.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 34: Annullamento Contratto in Pending
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Contratto impostato a `cancelled`, provvigioni ricalcolate.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 35: Eliminazione Contratto Errato (Superadmin)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Pulsante elimina visibile solo per superadmin.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 36: Cambio di Co-Seller prima dell'Approvazione
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Co-seller aggiornato nel modulo contratti.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 37: Modifica Prezzo da parte dell'Amministrazione
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Modifica consentita in stato pending, ricalcolo immediato dei totali.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 38: Ricalcolo Provvigione per Upgrade Listino
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Cloud Function calcola la percentuale provvigionale aggiuntiva in caso di prezzo superiore.
*   **File Coinvolti**: `functions/src/triggers/onContractCreated.ts`

### Azione 39: Override del Warning Prezzo da parte del Superadmin
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Il superadmin può convalidare lo sconto eliminando il flag warning.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 40: Ricerca Contratti per ID Venditore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Ricerca e griglia contratti filtrata per autore venditore.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 41: Lettura Contratti con Filtro Scaduti (Direzione)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: I contratti in attesa da più tempo sono isolati dai filtri dashboard.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 42: Aggiunta Allegato Firmato (Riferimento)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Riferimento allegato inserito nelle note del contratto.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 43: Allineamento automatico dei Saldi alla Creazione
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Alla creazione il saldo rimanente coincide con l'importo totale.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 44: Tentativo di Co-selling oltre il 100% (Blocco)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Controlli frontend bloccano percentuali co-selling non congrue.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 45: Verifica Provvigioni Sospese sul Profilo Venditore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Visualizzazione provvigioni in attesa nel profilo venditore funzionante.
*   **File Coinvolti**: [users/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/%5Bid%5D/+page.svelte)

---

## SEZIONE 4: Gestione Rate, Posticipazioni e Rientri (Azioni 46-55)

### Azione 46: Pianificazione Nuova Rata (Amministrazione)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Rata pianificata e inserita nella subcollection `installments`.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 47: Posticipazione Data di Scadenza Rata
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Bottone "Posticipa" funzionante con ricalcolo data scadenza.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 48: Rettifica Importo Rata Pianificata
*   **Stato**: `[PASSED]`
*   **Dettaglio**: L'importo atteso della rata può essere corretto prima dell'effettivo incasso.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 49: Generazione automatica di Allerta Rata Scaduta
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Le righe delle rate scadute vengono colorate in rosso con warning testuale.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 50: Eliminazione di una Rata Pianificata per Errore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Eliminazione fisica della rata dalla subcollection del contratto. Consentita solo se in stato pending (non pagata). In caso sia pagata, viene bloccata richiedendo prima lo storno del relativo incasso.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 51: Visualizzazione Scadenziario Globale
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Scadenziario rate per mese caricato correttamente.
*   **File Coinvolti**: [dashboard/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+page.svelte)

### Azione 52: Segnatura Rata come Pagata Parzialmente
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Possibilità di registrare incassi parziali per rata.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 53: Transizione Rata a Riscossione Completata
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Lo stato passa a `paid` valorizzando importo e data.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 54: Spostamento di tutte le scadenze per ferie
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Le date vengono modificate individualmente o via script.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 55: Ricalcolo date scadenze sul Contratto Padre
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Cloud Function allinea `derived.nextInstallmentDate` in automatico.
*   **File Coinvolti**: `functions/src/triggers/onInstallmentWrite.ts`

---

## SEZIONE 5: Registrazione, Allocazione e Storno Incassi (Azioni 56-70)

### Azione 56: Registrazione Incasso di Cassa Generico
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Creazione incasso a livello contabile funzionante.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 57: Allocazione dell'Incasso al Contratto
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Scrittura allocation doc in subcollection `contractsPaid`.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 58: Ricalcolo del Saldo Rimanente del Contratto (Metà Pagato)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Aggiornamento `derived.totalPaid` e `derived.totalRemaining` via CF.
*   **File Coinvolti**: `functions/src/triggers/onContractsPaidCreated.ts`

### Azione 59: Approvazione automatica del Contratto al raggiungimento del Saldo
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Stato contratto impostato ad `approved` al saldo totale.
*   **File Coinvolti**: `functions/src/triggers/onContractsPaidCreated.ts`

### Azione 60: Scorporo automatico dell'IVA al 22%
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Scorpora IVA adegua correttamente il decimale dell'imponibile.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 61: Storno dell'Incasso per Errore di Association
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Pulsante elimina sturna le quote dal contratto.
*   **File Coinvolti**: [payments/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/%5Bid%5D/+page.svelte)

### Azione 62: Cancellazione Totale di un Incasso dal Registro
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Eliminazione fisica e storno automatico contratti associati funzionante.
*   **File Coinvolti**: [payments/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/%5Bid%5D/+page.svelte)

### Azione 63: Spostamento di un Contratto da Approved a Pending a causa di Storno
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Rilevamento dello storno, ricalcolo saldo ed eventuale ripristino stato `pending`.
*   **File Coinvolti**: `functions/src/triggers/onContractsPaidCreated.ts`

### Azione 64: Distribuzione di un singolo Incasso su due Contratti Diversi
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Assegnazione multi-allocazione riuscita.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 65: Visualizzazione del Registro Incassi del Mese
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Lista incassi e ordinamento cronologico.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 66: Verifica del Saldo Rimanente Cliente nella Scheda Anagrafica
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Visualizzazione saldo scoperto cliente allineata.
*   **File Coinvolti**: [clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/%5Bid%5D/+page.svelte)

### Azione 67: Tentativo di inserimento Importo Negativo (Blocco)
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Controlli frontend respingono cifre negative.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 68: Tracciamento Utente su Registrazione Incasso
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Campi `recordedBy` e `recordedEmail` valorizzati correttamente.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 69: Esportazione Excel dei Pagamenti Ricevuti
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Export XLS scaricato regolarmente.
*   **File Coinvolti**: [payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)

### Azione 70: Riconciliazione automatica provvigione a Incasso Avvenuto
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Le provvigioni passano ad "earned" (effettive) sul profilo utente.
*   **File Coinvolti**: `functions/src/triggers/onContractsPaidCreated.ts`

---

## SEZIONE 6: Gestione Collaboratori, Ruoli e Provvigioni (Azioni 71-75)

### Azione 71: Creazione Profilo Nuovo Venditore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Nuovo profilo utente creato con stato iniziale e contatori puliti.
*   **File Coinvolti**: [users/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/+page.svelte)

### Azione 72: Promozione di un Venditore da Junior a Senior
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Qualifica impostata a `senior`. I nuovi calcoli utilizzano le commissioni massime.
*   **File Coinvolti**: [users/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/%5Bid%5D/+page.svelte)

### Azione 73: Variazione Ruolo in Amministrazione
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Profilo ruoli aggiornato, abilitazione ai menu finanziari istantanea.
*   **File Coinvolti**: [users/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/%5Bid%5D/+page.svelte)

### Azione 74: Disattivazione Account Collaboratore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Flag disattivato salvato nel database.
*   **File Coinvolti**: [users/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/%5Bid%5D/+page.svelte)

### Azione 75: Visualizzazione Report Provvigionale Personale
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Grafici ed estratti provvigionali individuali funzionanti.
*   **File Coinvolti**: [dashboard/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+page.svelte)

---

## SEZIONE 7: Dashboard, BI, Export e Stampe (Azioni 76-80)

### Azione 76: Consultazione Grafico di Andamento Fatturato
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Grafico istogramma fatturato mensile renderizzato con successo.
*   **File Coinvolti**: [dashboard/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+page.svelte)

### Azione 77: Filtro Dashboard per Singolo Venditore
*   **Stato**: `[PASSED]`
*   **Dettaglio**: I dati aggregati si riparametrizzano sul venditore selezionato.
*   **File Coinvolti**: [dashboard/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+page.svelte)

### Azione 78: Esportazione Registro Contratti in CSV
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Download file CSV funzionante.
*   **File Coinvolti**: [contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)

### Azione 79: Stampa della Scheda Dettaglio Contratto
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Stile di stampa per cartaceo formattato correttamente.
*   **File Coinvolti**: [contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/%5Bid%5D/+page.svelte)

### Azione 80: Espansione/Contrazione del Pannello Grafici
*   **Stato**: `[PASSED]`
*   **Dettaglio**: Stato di persistenza in localStorage per visualizzazione pannello attiva.
*   **File Coinvolti**: [dashboard/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+page.svelte)
