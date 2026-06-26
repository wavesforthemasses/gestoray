<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { db, doc, getDoc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField } from '$lib';
  import { 
    User, Phone, Calendar, Users, MessageSquare, Plus, FileText, 
    ArrowLeft, Trash2, CheckCircle, Clock, Award, ShieldAlert 
  } from '@lucide/svelte';

  const clientId = $page.params.id as string;

  // Tabs
  let activeTab = $state<'profile' | 'activities' | 'quotes'>('profile');

  // Loaders & Status
  let loadingData = $state(true);
  let submittingProfile = $state(false);
  let submittingActivity = $state(false);
  let submittingQuote = $state(false);
  let statusMessage = $state('');
  let isError = $state(false);
  let newlyCreatedId = $state('');

  // Client profile
  let clientName = $state('');
  let clientCognome = $state('');
  let clientEmail = $state('');
  let clientPhone = $state('');
  let clientCreatedBy = $state('');
  let clientCreatedAt = $state('');
  let clientNotes = $state<string[]>([]);
  let clientCommunications = $state<any[]>([]);
  let usersList = $state<any[]>([]);
  let secondVendorUid = $state('');
  let secondVendorShare = $state(30);

  // Original profile state for history tracking
  let originalProfile = $state<any>({});

  // Products catalog (for preventivatore)
  let productsList = $state<Array<{ id: string, name: string, listPrice: number, minPrice: number }>>([]);

  // Quotes, contracts & lists
  let quotesList = $state<any[]>([]);
  let activitiesList = $state<any[]>([]);
  let historyList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);

  // Form: Quick Activity
  let activityNotesText = $state('');
  let appointmentDateTime = $state(getNowDateTimeString());

  // Form: Quote Builder
  let quoteItems = $state<Array<{ productId: string, name: string, listPrice: number, minPrice: number, priceSold: number, quantity: number }>>([]);
  let selectedProductId = $state('');
  let itemPriceSold = $state<number | null>(null);
  let itemQuantity = $state<number>(1);
  let quoteSuccessMsg = $state('');
  let quoteErrorMsg = $state('');

  function getNowDateTimeString() {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  // Load everything
  async function loadAllData() {
    loadingData = true;
    try {
      // 1. Fetch Client Details
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (!clientDoc.exists()) {
        isError = true;
        statusMessage = 'Il cliente specificato non esiste.';
        loadingData = false;
        return;
      }
      const data = clientDoc.data();
      clientName = data.nome || '';
      clientCognome = data.cognome || '';
      clientEmail = data.email || '';
      clientPhone = data.phone || '';
      clientCreatedBy = data.createdBy || '';
      clientCreatedAt = data.createdAt || '';
      clientNotes = data.notes || [];
      clientCommunications = data.communications || [];

      // Save for history diff
      originalProfile = {
        nome: clientName,
        cognome: clientCognome,
        email: clientEmail,
        phone: clientPhone,
        createdBy: clientCreatedBy
      };

      // 2. Fetch Products
      const productsSnap = await getDocs(collection(db, 'products'));
      const prods: typeof productsList = [];
      productsSnap.forEach((doc: any) => {
        const p = doc.data();
        prods.push({
          id: doc.id,
          name: p.name,
          listPrice: p.listPrice,
          minPrice: p.minPrice
        });
      });
      productsList = prods;

      // 3. Fetch Quotes
      const quotesSnap = await getDocs(collection(db, 'quotes'));
      const quotes: any[] = [];
      quotesSnap.forEach((doc: any) => {
        const q = doc.data();
        if (q.clientId === clientId) {
          quotes.push({ id: doc.id, ...q });
        }
      });
      quotesList = quotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 4. Fetch Activities
      const activitiesSnap = await getDocs(collection(db, 'activities'));
      const acts: any[] = [];
      activitiesSnap.forEach((doc: any) => {
        const act = doc.data();
        if (act.clientId === clientId) {
          acts.push({ id: doc.id, ...act });
        }
      });
      activitiesList = acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 5. Fetch Client History (Audit logs)
      const historySnap = await getDocs(collection(db, 'client_history'));
      const histories: any[] = [];
      historySnap.forEach((doc: any) => {
        const h = doc.data();
        if (h.clientId === clientId) {
          histories.push({ id: doc.id, ...h });
        }
      });
      historyList = histories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // 6. Fetch Contracts for Client
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const contracts: any[] = [];
      contractsSnap.forEach((doc: any) => {
        const c = doc.data();
        if (c.clientId === clientId) {
          contracts.push({ id: doc.id, ...c });
        }
      });
      contractsList = contracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 7. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: any[] = [];
      usersSnap.forEach((doc: any) => {
        const u = doc.data();
        uList.push({ uid: doc.id, ...u });
      });
      usersList = uList;

    } catch (e: any) {
      console.error(e);
      isError = true;
      statusMessage = 'Errore durante il caricamento dei dati: ' + e.message;
    } finally {
      loadingData = false;
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'commerciale' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    loadAllData();
    return () => unsubscribe();
  });

  // Update profile
  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!clientName || !$auth) return;

    submittingProfile = true;
    statusMessage = '';
    isError = false;

    try {
      const isDirezione = $activeRole === 'direzione';
      const updatedClient = {
        nome: isDirezione ? originalProfile.nome : clientName.trim(),
        cognome: isDirezione ? originalProfile.cognome : clientCognome.trim(),
        email: isDirezione ? originalProfile.email : clientEmail.trim(),
        phone: isDirezione ? originalProfile.phone : clientPhone.trim(),
        notes: clientNotes,
        communications: clientCommunications,
        createdBy: clientCreatedBy,
        createdAt: clientCreatedAt,
        updatedBy: $auth.uid,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'clients', clientId), updatedClient);

      // Log history audit log if there are changes
      const changes: Record<string, { oldVal: any, newVal: any }> = {};
      let hasChanges = false;
      const fields = ['nome', 'cognome', 'email', 'phone', 'createdBy'];
      
      fields.forEach(f => {
        const oldVal = originalProfile[f] || '';
        const newVal = (updatedClient as any)[f] || '';
        if (oldVal !== newVal) {
          changes[f] = { oldVal, newVal };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        const historyId = 'audit_' + Math.random().toString(36).substring(2, 11);
        await setDoc(doc(db, 'client_history', historyId), {
          clientId,
          updatedBy: $auth.uid,
          updatedEmail: $auth.email,
          updatedAt: new Date().toISOString(),
          previousState: originalProfile,
          currentState: {
            nome: updatedClient.nome,
            cognome: updatedClient.cognome,
            email: updatedClient.email,
            phone: updatedClient.phone
          },
          changes
        });
      }

      statusMessage = 'Profilo cliente aggiornato con successo!';
      originalProfile = {
        nome: clientName,
        cognome: clientCognome,
        email: clientEmail,
        phone: clientPhone
      };
      await loadAllData();
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore nel salvataggio.';
    } finally {
      submittingProfile = false;
    }
  }

  // Add simple Note directly to client
  async function handleAddNote(e: Event) {
    e.preventDefault();
    const noteText = (e.target as any).noteText.value.trim();
    if (!noteText || !$auth) return;

    try {
      const noteObject = {
        text: noteText,
        createdAt: new Date().toISOString(),
        createdByEmail: $auth.email
      };

      const noteIdx = clientNotes.length;
      const updatedNotes = [...clientNotes, JSON.stringify(noteObject)];
      await setDoc(doc(db, 'clients', clientId), {
        nome: clientName,
        cognome: clientCognome,
        email: clientEmail,
        phone: clientPhone,
        notes: updatedNotes,
        communications: clientCommunications,
        createdBy: clientCreatedBy,
        createdAt: clientCreatedAt
      });

      (e.target as any).noteText.value = '';
      statusMessage = 'Nota aggiunta con successo!';
      newlyCreatedId = `note-${noteIdx}`;
      await loadAllData();
      await tick();
      const el = document.getElementById(`timeline-item-note-${noteIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (e: any) {
      statusMessage = 'Errore durante l\'inserimento della nota: ' + e.message;
      isError = true;
    }
  }

  // Log immediate activity: "Telefonata", "Incontro", "Appuntamento"
  async function logActivity(type: 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC', datetimeVal?: string) {
    if (!$auth) return;
    submittingActivity = true;
    statusMessage = '';
    isError = false;

    try {
      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      const activityDate = datetimeVal || new Date().toISOString();

      const activityData = {
        clientId,
        clientName: `${clientName} ${clientCognome}`.trim(),
        type,
        notes: activityNotesText.trim(),
        date: activityDate,
        loggedBy: $auth.uid,
        loggedEmail: $auth.email,
        status: 'completata'
      };

      await setDoc(doc(db, 'activities', activityId), activityData);

      // Also update communications in client object for count metrics compatibility
      const updatedComms = [...clientCommunications, {
        id: activityId,
        type,
        date: activityDate,
        notes: activityNotesText.trim()
      }];

      await setDoc(doc(db, 'clients', clientId), {
        nome: clientName,
        cognome: clientCognome,
        email: clientEmail,
        phone: clientPhone,
        notes: clientNotes,
        communications: updatedComms,
        createdBy: clientCreatedBy,
        createdAt: clientCreatedAt
      });

      activityNotesText = '';
      appointmentDateTime = getNowDateTimeString();
      statusMessage = `Attività "${type}" registrata correttamente!`;
      newlyCreatedId = activityId;
      await loadAllData();
      await tick();
      const el = document.getElementById(`timeline-item-${activityId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore nel salvataggio dell\'attività.';
    } finally {
      submittingActivity = false;
    }
  }

  // Quote: Add item
  function handleAddQuoteItem() {
    if (!selectedProductId) return;
    const prod = productsList.find(p => p.id === selectedProductId);
    if (!prod) return;

    const soldPrice = itemPriceSold !== null ? itemPriceSold : prod.listPrice;
    
    // Check if already in items
    const existingIdx = quoteItems.findIndex(item => item.productId === selectedProductId);
    if (existingIdx > -1) {
      quoteItems[existingIdx].quantity += itemQuantity;
      quoteItems[existingIdx].priceSold = soldPrice;
    } else {
      quoteItems.push({
        productId: prod.id,
        name: prod.name,
        listPrice: prod.listPrice,
        minPrice: prod.minPrice,
        priceSold: soldPrice,
        quantity: itemQuantity
      });
    }

    // Reset picker
    selectedProductId = '';
    itemPriceSold = null;
    itemQuantity = 1;
    quoteSuccessMsg = 'Prodotto aggiunto al preventivo corrente.';
  }

  // Quote: Remove item
  function handleRemoveQuoteItem(index: number) {
    quoteItems.splice(index, 1);
  }

  // Total of quote builder
  let quoteTotal = $derived(
    quoteItems.reduce((sum, item) => sum + item.priceSold * item.quantity, 0)
  );

  // Quote: Save Draft Quote
  async function handleSaveQuote() {
    if (quoteItems.length === 0 || !$auth) return;
    submittingQuote = true;
    quoteErrorMsg = '';
    quoteSuccessMsg = '';

    try {
      const quoteId = 'quote_' + Math.random().toString(36).substring(2, 11);
      const newQuote = {
        clientId,
        clientName: `${clientName} ${clientCognome}`.trim(),
        clientEmail: clientEmail,
        products: quoteItems,
        totalPrice: quoteTotal,
        createdBy: $auth.uid,
        createdEmail: $auth.email,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'quotes', quoteId), newQuote);
      
      // Reset builder
      quoteItems = [];
      quoteSuccessMsg = 'Preventivo salvato in bozza con successo!';
      await loadAllData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante il salvataggio del preventivo: ' + e.message;
    } finally {
      submittingQuote = false;
    }
  }

  // Quote: Convert Quote (or current builder) into Contract
  async function convertToContract(items: typeof quoteItems) {
    if (items.length === 0 || !$auth) return;
    submittingQuote = true;
    quoteErrorMsg = '';
    quoteSuccessMsg = '';

    try {
      // Determine if pricing sold is below min thresholds
      const hasWarning = items.some(item => item.priceSold < item.minPrice);

      const contractId = 'contract_' + Math.random().toString(36).substring(2, 11);
      const totalContractPrice = items.reduce((sum, item) => sum + item.priceSold * item.quantity, 0);

      let secondVendorEmail = '';
      if (secondVendorUid) {
        const found = usersList.find(u => u.uid === secondVendorUid);
        secondVendorEmail = found ? found.email : '';
      }

      const newContract = {
        clientId,
        clientName: `${clientName} ${clientCognome}`.trim(),
        clientEmail: clientEmail,
        vendorUid: $auth.uid,
        vendorEmail: $auth.email,
        totalPrice: totalContractPrice,
        products: items,
        status: 'pending',
        hasWarning,
        createdAt: new Date().toISOString(),
        ...(secondVendorUid ? {
          secondVendorUid,
          secondVendorEmail,
          secondVendorShare: Number(secondVendorShare)
        } : {})
      };

      await setDoc(doc(db, 'contracts', contractId), newContract);

      quoteSuccessMsg = 'Preventivo convertito in contratto! In attesa di approvazione amministrativa.';
      quoteItems = []; 
      secondVendorUid = '';
      secondVendorShare = 30;
      await loadAllData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante la conversione in contratto: ' + e.message;
    } finally {
      submittingQuote = false;
    }
  }

  // Parse structured note object or fallback to raw string
  function parseNote(noteRaw: string) {
    try {
      const parsed = JSON.parse(noteRaw);
      if (parsed && typeof parsed === 'object' && 'text' in parsed) {
        return parsed;
      }
    } catch (e) {}
    return {
      text: noteRaw,
      createdAt: null,
      createdByEmail: 'Sistema'
    };
  }

  // Watch selected product to sync priceSold placeholder
  function onProductSelectChange(id: string) {
    const prod = productsList.find(p => p.id === id);
    if (prod) {
      itemPriceSold = prod.listPrice;
    } else {
      itemPriceSold = null;
    }
  }
</script>

<svelte:head>
  <title>Scheda Cliente CRM | Gestoray</title>
</svelte:head>

<div class="client-details-page animate-fade-in">
  <!-- Back Button & Page Header -->
  <div class="page-top-actions">
    <button onclick={() => goto('/dashboard/clients')} class="back-link-btn">
      <ArrowLeft size={16} /> Torna a elenco clienti
    </button>
    <h2 class="title-header">Gestione Cliente: {clientName} {clientCognome}</h2>
  </div>

  {#if statusMessage}
    <div class="status-alert-box animate-fade-in" class:error={isError}>
      {statusMessage}
    </div>
  {/if}

  {#if loadingData}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento dati in corso...
    </div>
  {:else if !isError}
    <!-- Tab Navigation -->
    <div class="details-tab-nav">
      <button 
        class="tab-nav-btn" 
        class:active={activeTab === 'profile'} 
        onclick={() => activeTab = 'profile'}
      >
        <User size={16} /> Profilo & Audit Log
      </button>
      <button 
        class="tab-nav-btn" 
        class:active={activeTab === 'activities'} 
        onclick={() => activeTab = 'activities'}
      >
        <MessageSquare size={16} /> Attività & Note
      </button>
      <button 
        class="tab-nav-btn" 
        class:active={activeTab === 'quotes'} 
        onclick={() => activeTab = 'quotes'}
      >
        <FileText size={16} /> Preventivatore ({quotesList.length})
      </button>
    </div>

    <!-- TABS PANELS -->
    <div class="tab-content-panel">

      <!-- TAB 1: Profile & History -->
      {#if activeTab === 'profile'}
        <div class="tab-view animate-fade-in">
          <div class="vertical-layout-stack">
            <!-- Edit Profile Form -->
            <Card title="Scheda Anagrafica Cliente" description="Aggiorna le informazioni di contatto principali. Ogni modifica viene tracciata nell'Audit Log.">
              {#snippet icon()}
                <User size={20} class="icon-accent" />
              {/snippet}

              <form onsubmit={handleUpdateProfile} class="widescreen-form">
                <div class="form-grid-columns">
                  <FormField id="c-nome" label="Nome Azienda">
                    <input type="text" id="c-nome" bind:value={clientName} required disabled={submittingProfile || $activeRole === 'direzione'} />
                  </FormField>

                  <FormField id="c-cognome" label="Referente" helpText="Opzionale">
                    <input type="text" id="c-cognome" bind:value={clientCognome} disabled={submittingProfile || $activeRole === 'direzione'} />
                  </FormField>
                </div>

                <div class="form-grid-columns">
                  <FormField id="c-email" label="Indirizzo Email" helpText="Opzionale">
                    <input type="email" id="c-email" bind:value={clientEmail} placeholder="es. client@azienda.com" disabled={submittingProfile || $activeRole === 'direzione'} />
                  </FormField>

                  <FormField id="c-phone" label="Numero di Telefono" helpText="Opzionale">
                    <input type="text" id="c-phone" bind:value={clientPhone} placeholder="es. +39 02 123456" disabled={submittingProfile || $activeRole === 'direzione'} />
                  </FormField>
                </div>

                {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione' || $activeRole === 'direzione'}
                  <div class="form-grid-columns" style="margin-top: 10px;">
                    <FormField id="c-owner" label="Consulente Proprietario (Assegnazione)" helpText="Modifica l'assegnazione di questo cliente ad un altro commerciale.">
                      <select id="c-owner" bind:value={clientCreatedBy} disabled={submittingProfile}>
                        {#each usersList as u}
                          <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                        {/each}
                      </select>
                    </FormField>
                  </div>
                {/if}

                <button type="submit" class="submit-profile-btn" disabled={submittingProfile}>
                  {submittingProfile ? 'Aggiornamento...' : 'Salva Modifiche Anagrafica'}
                </button>
              </form>
            </Card>

            <!-- Audit Trail Table -->
            <Card title="Audit Trail Storico Modifiche" description="Visualizza cronologicamente chi ha modificato la scheda e quali campi sono variati.">
              {#snippet icon()}
                <Clock size={20} class="icon-accent" />
              {/snippet}

              {#if historyList.length === 0}
                <div class="empty-panel">Nessuna modifica registrata per questa anagrafica.</div>
              {:else}
                <div class="audit-history-list">
                  {#each historyList as log}
                    <div class="audit-log-item">
                      <div class="audit-log-meta">
                        <span class="audit-author">{log.updatedEmail}</span>
                        <span class="audit-time">{new Date(log.updatedAt).toLocaleString('it-IT')}</span>
                      </div>
                      
                      <div class="audit-log-changes">
                        {#if log.changes && Object.keys(log.changes).length > 0}
                          <ul class="changes-list">
                            {#each Object.keys(log.changes) as field}
                              <li>
                                Campo <strong>{field}</strong>: 
                                <span class="old-val">"{log.changes[field].oldVal || 'N/D'}"</span> 
                                &rarr; 
                                <span class="new-val">"{log.changes[field].newVal || 'N/D'}"</span>
                              </li>
                            {/each}
                          </ul>
                        {:else}
                          <span class="no-diff-msg">Modifica generica salvata (nessuna variazione rilevata nei campi principali)</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </Card>
          </div>
        </div>
      {/if}

      <!-- TAB 2: Activities & Notes -->
      {#if activeTab === 'activities'}
        <div class="tab-view animate-fade-in">
          <div class="vertical-layout-stack">
            {#if $activeRole !== 'direzione'}
              <!-- Activities Logger Form -->
              <Card title="Registrazione Attività Semplificata" description="Aggiungi una nota testuale e clicca sul pulsante dell'attività corrispondente. Le attività di Telefonata e Incontro verranno registrate all'istante, gli Appuntamenti consentono di pianificare data/ora.">
                {#snippet icon()}
                  <MessageSquare size={20} class="icon-accent" />
                {/snippet}

                <div class="activity-logger-shell">
                  <FormField id="act-notes" label="Note Attività" helpText="Riassumi brevemente l'esito della telefonata o dell'incontro.">
                    <textarea 
                      id="act-notes" 
                      bind:value={activityNotesText} 
                      placeholder="es. Il cliente ha richiesto una quotazione per 3 licenze..."
                      rows="3"
                      disabled={submittingActivity}
                    ></textarea>
                  </FormField>

                  <div class="appointment-time-picker">
                    <FormField id="appt-date" label="Data e Ora Appuntamento" helpText="Richiesto solo in caso di registrazione Appuntamento.">
                      <input 
                        type="datetime-local" 
                        id="appt-date" 
                        bind:value={appointmentDateTime} 
                        disabled={submittingActivity} 
                      />
                    </FormField>
                  </div>

                  <div class="quick-log-actions">
                    {#if $activeRole === 'amministrazione'}
                      <button 
                        onclick={() => logActivity('Sollecito Telefonico')} 
                        class="log-btn phone-btn"
                        disabled={submittingActivity}
                      >
                        <Phone size={14} /> Sollecito Telefonico
                      </button>
                      <button 
                        onclick={() => logActivity('Sollecito Email')} 
                        class="log-btn meeting-btn"
                        disabled={submittingActivity}
                      >
                        <MessageSquare size={14} /> Sollecito Email
                      </button>
                      <button 
                        onclick={() => logActivity('Sollecito PEC')} 
                        class="log-btn appt-btn"
                        disabled={submittingActivity}
                      >
                        <Calendar size={14} /> Sollecito PEC
                      </button>
                    {:else}
                      <button 
                        onclick={() => logActivity('Telefonata')} 
                        class="log-btn phone-btn"
                        disabled={submittingActivity}
                      >
                        <Phone size={14} /> Registra Telefonata
                      </button>
                      <button 
                        onclick={() => logActivity('Incontro')} 
                        class="log-btn meeting-btn"
                        disabled={submittingActivity}
                      >
                        <Users size={14} /> Registra Incontro
                      </button>
                      <button 
                        onclick={() => logActivity('Appuntamento', new Date(appointmentDateTime).toISOString())} 
                        class="log-btn appt-btn"
                        disabled={submittingActivity || !appointmentDateTime}
                      >
                        <Calendar size={14} /> Registra Appuntamento
                      </button>
                    {/if}
                  </div>
                </div>
              </Card>

              <!-- Quick notes text form -->
              <Card title="Note Libere Cronologiche" description="Se vuoi registrare una nota informativa slegata da una specifica telefonata o incontro.">
                {#snippet icon()}
                  <FileText size={20} class="icon-accent" />
                {/snippet}

                <form onsubmit={handleAddNote} class="simple-note-form">
                  <div class="note-input-row">
                    <input type="text" name="noteText" placeholder="Scrivi una nota per questa anagrafica..." required />
                    <button type="submit" class="add-note-btn">Posa Nota</button>
                  </div>
                </form>
              </Card>
            {/if}

            <!-- Combined Activities & Notes Timeline -->
            <Card title="Cronologia Attività e Note" description="Storico cronologico inverso di tutte le interazioni registrate su questa scheda cliente.">
              {#snippet icon()}
                <Clock size={20} class="icon-accent" />
              {/snippet}

              <div class="timeline-container">
                {#if activitiesList.length === 0 && clientNotes.length === 0}
                  <div class="empty-panel">Nessuna interazione o nota salvata per questo cliente.</div>
                {:else}
                  <!-- Construct unified items list -->
                  {@const timelineItems = [
                    ...activitiesList.map(a => ({
                      id: a.id,
                      time: new Date(a.date),
                      author: a.loggedEmail,
                      badge: a.type,
                      text: a.notes,
                      source: 'activity'
                    })),
                    ...clientNotes.map((nRaw, idx) => {
                      const parsed = parseNote(nRaw);
                      return {
                        id: `note-${idx}`,
                        time: parsed.createdAt ? new Date(parsed.createdAt) : new Date(clientCreatedAt),
                        author: parsed.createdByEmail,
                        badge: 'NOTA',
                        text: parsed.text,
                        source: 'note'
                      };
                    })
                  ].sort((a, b) => b.time.getTime() - a.time.getTime())}

                  <div class="timeline-flow">
                    {#each timelineItems as item}
                      <div 
                        id="timeline-item-{item.id}"
                        class="timeline-card" 
                        class:note-item={item.source === 'note'}
                        class:glow={item.id === newlyCreatedId}
                      >
                        <div class="card-top">
                          <span class="item-badge" class:badge-nota={item.badge === 'NOTA'} class:badge-tel={item.badge === 'Telefonata'} class:badge-inc={item.badge === 'Incontro'} class:badge-app={item.badge === 'Appuntamento'}>
                            {item.badge}
                          </span>
                          <span class="item-time">{item.time.toLocaleString('it-IT')}</span>
                          <span class="item-author">&bull; {item.author}</span>
                        </div>
                        <p class="card-text">{item.text || 'Nessuna nota aggiuntiva.'}</p>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </Card>
          </div>
        </div>
      {/if}

      <!-- TAB 3: Quote Builder & History -->
      {#if activeTab === 'quotes'}
        <div class="tab-view animate-fade-in">
          <div class="vertical-layout-stack">
            {#if $activeRole !== 'direzione'}
              <!-- Current Quote Draft Builder -->
              <Card title="Preventivatore Rapido" description="Seleziona i prodotti, modifica la quotazione venduta, ed inserisci la quantità per preparare un preventivo. Puoi salvarlo in bozza o convertirlo subito in un Contratto in attesa.">
              {#snippet icon()}
                <Plus size={20} class="icon-accent" />
              {/snippet}

              {#if quoteSuccessMsg}
                <div class="alert-box success animate-fade-in">{quoteSuccessMsg}</div>
              {/if}
              {#if quoteErrorMsg}
                <div class="alert-box error animate-fade-in">{quoteErrorMsg}</div>
              {/if}

              <!-- Builder Selection Form -->
              <div class="quote-builder-form">
                <div class="builder-inputs">
                  <FormField id="q-prod" label="Seleziona Prodotto">
                    <select 
                      id="q-prod" 
                      bind:value={selectedProductId}
                      onchange={(e) => onProductSelectChange((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">-- Seleziona Prodotto dal Catalogo --</option>
                      {#each productsList as p}
                        <option value={p.id}>{p.name} (Listino: €{p.listPrice.toFixed(2)})</option>
                      {/each}
                    </select>
                  </FormField>

                  {#if selectedProductId}
                    {@const chosenProd = productsList.find(p => p.id === selectedProductId)}
                    {#if chosenProd}
                      <FormField id="q-price" label="Prezzo Venduto Singolo (€)" helpText="Prezzo listino: €{chosenProd.listPrice.toFixed(2)}. Prezzo minimo consentito: €{chosenProd.minPrice.toFixed(2)}.">
                        <input 
                          type="number" 
                          id="q-price" 
                          bind:value={itemPriceSold} 
                          step="0.01" 
                          min="0" 
                        />
                        {#if itemPriceSold !== null && itemPriceSold < chosenProd.minPrice}
                          <span class="warning-inline"><ShieldAlert size={12} /> Prezzo inferiore al minimo di catalogo!</span>
                        {/if}
                      </FormField>

                      <FormField id="q-qty" label="Quantità">
                        <input 
                          type="number" 
                          id="q-qty" 
                          bind:value={itemQuantity} 
                          min="1" 
                          step="1" 
                        />
                      </FormField>

                      <div class="btn-align-group">
                        <span class="invisible-label">&nbsp;</span>
                        <button type="button" onclick={handleAddQuoteItem} class="add-to-items-btn">
                          Inserisci Prodotto
                        </button>
                      </div>
                    {/if}
                  {/if}
                </div>

                <!-- Selected items list -->
                <div class="quote-current-items">
                  <h4>Articoli nel Preventivo Corrente</h4>
                  {#if quoteItems.length === 0}
                    <div class="empty-items-placeholder">Il preventivo è vuoto. Aggiungi prodotti dal catalogo per iniziare.</div>
                  {:else}
                    <div class="items-table-container">
                      <table class="widescreen-table">
                        <thead>
                          <tr>
                            <th>Prodotto</th>
                            <th>Prezzo Listino</th>
                            <th>Prezzo Venduto</th>
                            <th>Quantità</th>
                            <th>Totale</th>
                            <th>Soglia Minima</th>
                            <th>Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each quoteItems as item, index}
                            <tr class:row-warning={item.priceSold < item.minPrice}>
                              <td>{item.name}</td>
                              <td>€ {item.listPrice.toFixed(2)}</td>
                              <td>
                                <strong class:text-warning={item.priceSold < item.minPrice}>
                                  € {item.priceSold.toFixed(2)}
                                </strong>
                              </td>
                              <td>{item.quantity}</td>
                              <td><strong>€ {(item.priceSold * item.quantity).toFixed(2)}</strong></td>
                              <td>
                                <span class="min-threshold-cell">€ {item.minPrice.toFixed(2)}</span>
                                {#if item.priceSold < item.minPrice}
                                  <span class="under-min-badge" title="Prezzo sotto la soglia minima"><ShieldAlert size={10} /> SOTTO SOGLIA</span>
                                {/if}
                              </td>
                              <td>
                                <button onclick={() => handleRemoveQuoteItem(index)} class="remove-item-btn" title="Rimuovi">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>

                    <!-- Co-Selling splits panel -->
                    <div class="co-selling-config-panel" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-neutral-200);">
                      <h4 style="font-size: 13.5px; font-weight: 600; color: var(--color-neutral-800); margin-bottom: 4px;">Ripartizione Co-Selling (Opzionale)</h4>
                      <p style="font-size: 12px; color: var(--color-neutral-500); margin-bottom: 12px;">Se questa vendita è stata conclusa in collaborazione con un altro commerciale, selezionalo qui sotto per ripartire le provvigioni.</p>
                      <div class="form-grid-columns">
                        <FormField id="q-second-vendor" label="Secondo Consulente">
                          <select id="q-second-vendor" bind:value={secondVendorUid}>
                            <option value="">Nessuno (100% provvigione a te)</option>
                            {#each usersList.filter(u => u.uid !== $auth?.uid) as u}
                              <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                            {/each}
                          </select>
                        </FormField>
                        {#if secondVendorUid}
                          <FormField id="q-second-share" label="Quota Provvigionale Co-Seller (%)" helpText="Il resto della provvigione andrà al principale.">
                            <input type="number" id="q-second-share" bind:value={secondVendorShare} min="1" max="99" step="1" required />
                          </FormField>
                        {/if}
                      </div>
                    </div>

                    <!-- Builder Footer Stats -->
                    <div class="builder-summary-row" style="margin-top: 20px;">
                      <div class="total-summary-box">
                        <span class="tot-label">Importo Complessivo Preventivo:</span>
                        <span class="tot-val">€ {quoteTotal.toFixed(2)}</span>
                      </div>

                      <div class="actions-group">
                        <button onclick={handleSaveQuote} class="save-draft-btn" disabled={submittingQuote}>
                          Salva Bozza Preventivo
                        </button>
                        <button onclick={() => convertToContract(quoteItems)} class="convert-contract-btn" disabled={submittingQuote}>
                          <CheckCircle size={14} /> Converti in Contratto
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            </Card>
            {/if}

            <!-- Quotes History List -->
            <Card title="Storico Preventivi Generati" description="Consulta i preventivi calcolati in precedenza per questo cliente. Puoi convertirli direttamente in contratti se il cliente li ha accettati.">
              {#snippet icon()}
                <FileText size={20} class="icon-accent" />
              {/snippet}

              {#if quotesList.length === 0}
                <div class="empty-panel">Nessun preventivo salvato in bozza per questo cliente.</div>
              {:else}
                <div class="quotes-history-flow">
                  {#each quotesList as q}
                    <div class="quote-history-card">
                      <div class="q-header">
                        <span class="q-date">Preventivo del {new Date(q.createdAt).toLocaleString('it-IT')}</span>
                        <span class="q-creator">Creato da: {q.createdEmail}</span>
                        <span class="q-amount">€ {q.totalPrice.toFixed(2)}</span>
                      </div>
                      
                      <!-- products inside -->
                      <div class="q-products-preview">
                        <ul class="preview-prod-list">
                          {#each q.products as item}
                            <li>
                              {item.name} &times; {item.quantity} (Venduto a €{item.priceSold.toFixed(2)} / Listino €{item.listPrice.toFixed(2)})
                              {#if item.priceSold < item.minPrice}
                                <span class="warning-pill"><ShieldAlert size={10} /> Prezzo Basso</span>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      </div>

                      {#if $activeRole !== 'direzione'}
                        <div class="q-actions">
                          <button onclick={() => convertToContract(q.products)} class="action-btn-convert" disabled={submittingQuote}>
                            <CheckCircle size={12} /> Converti in Contratto Attivo
                          </button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </Card>

            <!-- Active / Pending Contracts list for this client -->
            <Card title="Contratti Assegnati al Cliente" description="Contratti emessi per questo cliente.">
              {#snippet icon()}
                <FileText size={20} class="icon-accent" />
              {/snippet}

              {#if contractsList.length === 0}
                <div class="empty-panel">Nessun contratto presente in database per questa anagrafica.</div>
              {:else}
                <div class="contracts-overview-table-container">
                  <table class="widescreen-table">
                    <thead>
                      <tr>
                        <th>Codice Contratto</th>
                        <th>Data Creazione</th>
                        <th>Importo Totale</th>
                        <th>Stato Approvazione</th>
                        <th>Prezzo Sotto Minimo</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each contractsList as c}
                        <tr>
                          <td><code>{c.id}</code></td>
                          <td>{new Date(c.createdAt).toLocaleDateString('it-IT')}</td>
                          <td><strong>€ {c.totalPrice.toFixed(2)}</strong></td>
                          <td>
                            <span class="badge-status" class:approved={c.status === 'approved'}>
                              {c.status === 'approved' ? 'Approvato' : 'In Attesa'}
                            </span>
                          </td>
                          <td>
                            {#if c.hasWarning}
                              <span class="warning-badge"><ShieldAlert size={12} /> Prezzo Basso</span>
                            {:else}
                              <span class="regular-price-badge">Prezzi Standard</span>
                            {/if}
                          </td>
                          <td>
                            <button onclick={() => goto(`/dashboard/contracts/${c.id}`)} class="go-details-btn">
                              Dettagli Contratto
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </Card>
          </div>
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .client-details-page {
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
    flex-wrap: wrap;
  }

  .back-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .title-header {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .status-alert-box {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .status-alert-box.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .alert-box {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
  }

  .alert-box.success {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .alert-box.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .loading-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Tabs CSS */
  .details-tab-nav {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--color-neutral-200);
    padding-bottom: 8px;
  }

  .tab-nav-btn {
    background: transparent;
    border: none;
    padding: 10px 16px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tab-nav-btn:hover {
    color: var(--color-primary-600);
    background: var(--color-neutral-100);
  }

  .tab-nav-btn.active {
    color: var(--color-primary-600);
    border-bottom: 3px solid var(--color-primary-500);
    background: var(--color-primary-50);
  }

  .tab-content-panel {
    width: 100%;
  }

  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  /* Form */
  .widescreen-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-grid-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 768px) {
    .form-grid-columns {
      grid-template-columns: 1fr;
    }
  }

  .submit-profile-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 12px 24px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    align-self: flex-start;
    margin-top: 10px;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  .submit-profile-btn:hover {
    opacity: 0.9;
  }

  .submit-profile-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Audit history logs */
  .audit-history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .audit-log-item {
    border-left: 3px solid var(--color-primary-300);
    padding-left: 14px;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .audit-log-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .audit-author {
    font-weight: 700;
    color: var(--color-neutral-700);
  }

  .audit-time {
    color: var(--color-neutral-400);
  }

  .audit-log-changes {
    font-size: 12px;
  }

  .changes-list {
    margin: 4px 0 0 0;
    padding-left: 20px;
    color: var(--color-neutral-600);
  }

  .old-val {
    color: var(--color-error-text);
    text-decoration: line-through;
  }

  .new-val {
    color: var(--color-success-text);
    font-weight: 600;
  }

  .no-diff-msg {
    color: var(--color-neutral-400);
    font-style: italic;
  }

  /* Activity logger */
  .activity-logger-shell {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px var(--color-primary-50);
  }

  .appointment-time-picker {
    max-width: 320px;
  }

  .quick-log-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 10px;
  }

  .log-btn {
    border: none;
    color: var(--color-white);
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.2s;
  }

  .log-btn:hover {
    opacity: 0.9;
  }

  .phone-btn {
    background: #0284c7;
  }

  .meeting-btn {
    background: #0d9488;
  }

  .appt-btn {
    background: #4f46e5;
  }

  .simple-note-form .note-input-row {
    display: flex;
    gap: 10px;
  }

  .simple-note-form input {
    flex: 1;
    padding: 10px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 13px;
  }

  .add-note-btn {
    background: var(--color-neutral-700);
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    cursor: pointer;
  }

  /* Timeline */
  .timeline-flow {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .timeline-card {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-left: 4px solid var(--color-primary-500);
    padding: 14px;
    border-radius: var(--radius-md);
    transition: all 0.3s ease;
  }

  .timeline-card.glow {
    animation: glow-animation 2.5s ease-out;
  }

  @keyframes glow-animation {
    0% { 
      box-shadow: 0 0 0 0 hsla(var(--brand-h), var(--brand-s), 50%, 0.7); 
      background-color: hsla(var(--brand-h), var(--brand-s), 50%, 0.15); 
      border-color: var(--color-primary-500);
    }
    50% { 
      box-shadow: 0 0 15px 5px hsla(var(--brand-h), var(--brand-s), 50%, 0.4); 
      background-color: hsla(var(--brand-h), var(--brand-s), 50%, 0.1); 
      border-color: var(--color-primary-500);
    }
    100% { 
      box-shadow: 0 0 0 0 hsla(var(--brand-h), var(--brand-s), 50%, 0); 
      background-color: var(--color-neutral-50); 
      border-color: var(--color-neutral-200);
    }
  }

  .timeline-card.note-item {
    border-left-color: var(--color-neutral-700);
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--color-neutral-500);
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .item-badge {
    font-size: 9px;
    font-weight: 700;
    color: var(--color-white);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
  }

  .badge-nota { background: var(--color-neutral-700); }
  .badge-tel { background: #0284c7; }
  .badge-inc { background: #0d9488; }
  .badge-app { background: #4f46e5; }

  .item-author {
    font-weight: 600;
  }

  .card-text {
    margin: 0;
    font-size: 13.5px;
    color: var(--color-neutral-800);
    line-height: 1.4;
  }

  /* Preventivatore */
  .quote-builder-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .builder-inputs {
    display: grid;
    grid-template-columns: 2fr 1fr 120px auto;
    gap: 16px;
    align-items: flex-start;
  }

  @media (max-width: 992px) {
    .builder-inputs {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
  }

  .btn-align-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .invisible-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    height: 18px;
    visibility: hidden;
    display: inline-block;
  }

  .add-to-items-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    height: 46px;
    padding: 0 24px;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    box-sizing: border-box;
  }

  .add-to-items-btn:hover {
    opacity: 0.9;
  }

  .warning-inline {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-error-text);
    font-size: 10.5px;
    font-weight: 600;
    margin-top: 4px;
  }

  .quote-current-items h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: var(--color-neutral-700);
  }

  .empty-items-placeholder {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-400);
    background: var(--color-neutral-50);
    border: 1px dashed var(--color-neutral-300);
    border-radius: var(--radius-md);
    font-size: 13px;
  }

  .items-table-container {
    overflow-x: auto;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    margin-bottom: 20px;
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  .widescreen-table th {
    background: var(--color-neutral-50);
    padding: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .widescreen-table td {
    padding: 12px;
    border-bottom: 1px solid var(--color-neutral-200);
    color: var(--color-neutral-700);
  }

  .row-warning {
    background: hsla(0, 100%, 98%, 1);
  }

  .under-min-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    background: var(--color-error-light);
    color: var(--color-error-text);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 6px;
  }

  .remove-item-btn {
    background: transparent;
    border: none;
    color: var(--color-neutral-400);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .remove-item-btn:hover {
    color: var(--color-error);
    background: var(--color-error-light);
  }

  .builder-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    background: var(--color-neutral-50);
    padding: 16px;
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  }

  .total-summary-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tot-label {
    font-size: 12px;
    color: var(--color-neutral-500);
    font-weight: 600;
  }

  .tot-val {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .actions-group {
    display: flex;
    gap: 12px;
  }

  .save-draft-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    font-size: 13px;
  }

  .save-draft-btn:hover {
    background: var(--color-neutral-100);
  }

  .convert-contract-btn {
    background: linear-gradient(135deg, var(--color-success), #16a34a);
    color: var(--color-white);
    border: none;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 10px rgba(22, 163, 74, 0.15);
  }

  .convert-contract-btn:hover {
    opacity: 0.9;
  }

  /* Quotes history list */
  .quotes-history-flow {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .quote-history-card {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .q-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--color-neutral-500);
    flex-wrap: wrap;
    gap: 10px;
  }

  .q-date {
    font-weight: 700;
    color: var(--color-neutral-700);
    font-size: 12px;
  }

  .q-amount {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .q-products-preview {
    font-size: 12.5px;
    color: var(--color-neutral-600);
  }

  .preview-prod-list {
    margin: 0;
    padding-left: 20px;
  }

  .warning-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    background: var(--color-error-light);
    color: var(--color-error-text);
    padding: 1px 5px;
    border-radius: 4px;
    margin-left: 4px;
  }

  .q-actions {
    display: flex;
    justify-content: flex-end;
  }

  .action-btn-convert {
    background: var(--color-white);
    border: 1px solid var(--color-success);
    color: var(--color-success-text);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
  }

  .action-btn-convert:hover {
    background: var(--color-success-light);
  }

  /* Assigned contracts table */
  .contracts-overview-table-container {
    overflow-x: auto;
  }

  .badge-status {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-200);
    color: var(--color-neutral-600);
    text-transform: uppercase;
  }

  .badge-status.approved {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .warning-badge {
    font-size: 10px;
    font-weight: 700;
    background: var(--color-error-light);
    color: var(--color-error-text);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .regular-price-badge {
    font-size: 10px;
    color: var(--color-neutral-400);
  }

  .go-details-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .go-details-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .empty-panel {
    padding: 24px;
    text-align: center;
    color: var(--color-neutral-400);
    font-size: 13.5px;
    background: var(--color-neutral-50);
    border: 1px dashed var(--color-neutral-200);
    border-radius: var(--radius-md);
  }

  .min-threshold-cell {
    color: var(--color-neutral-400);
  }

  .text-warning {
    color: var(--color-error-text);
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
