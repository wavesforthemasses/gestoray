<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { db, doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from '$lib/firebase';
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, User, MessageSquare, FileText, Trash2 } from '@lucide/svelte';
  import ClientProfileTab from './components/ClientProfileTab.svelte';
  import ClientActivitiesTab from './components/ClientActivitiesTab.svelte';
  import ClientQuotesTab from './components/ClientQuotesTab.svelte';
  import { generateSearchTerms, Card } from '$lib';

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

  // Client profile fields (bind to original namespace)
  let clientName = $state('');
  let clientCognome = $state('');
  let clientEmail = $state('');
  let clientPhone = $state('');
  let clientCreatedBy = $state('');
  let clientCreatedAt = $state('');
  let clientNotes = $state<string[]>([]);
  let clientStatus = $state('prospect');
  let clientFiscalId = $state('');
  let clientPartitaIva = $state('');
  let clientCodiceFiscale = $state('');
  let clientDerived = $state<any>({});

  // Original profile state for history tracking
  let originalProfile = $state<any>({});

  // Products catalog (for preventivatore)
  let productsList = $state<Array<{ id: string, name: string, listPrice: number, minPrice: number }>>([]);

  // Quotes, contracts & lists
  let quotesList = $state<any[]>([]);
  let activitiesList = $state<any[]>([]);
  let historyList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);

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

  // Co-seller options
  let secondVendorUid = $state('');
  let secondVendorShare = $state(30);

  function getNowDateTimeString() {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
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
      const orig = data.original || {};
      clientDerived = data.derived || {};

      clientName = orig.nome || '';
      clientCognome = orig.cognome || '';
      clientEmail = orig.email || '';
      clientPhone = orig.phone || '';
      clientNotes = orig.notes || [];
      clientStatus = orig.status || 'prospect';
      clientFiscalId = orig.fiscalId || '';
      clientPartitaIva = orig.partitaIva || '';
      clientCodiceFiscale = orig.codiceFiscale || '';
      clientCreatedBy = orig.createdBy || '';
      clientCreatedAt = data.edits?.createdAt || orig.createdAt || '';

      originalProfile = {
        nome: clientName,
        cognome: clientCognome,
        email: clientEmail,
        phone: clientPhone,
        createdBy: clientCreatedBy,
        status: clientStatus,
        fiscalId: clientFiscalId,
        partitaIva: clientPartitaIva,
        codiceFiscale: clientCodiceFiscale
      };

      // 2. Fetch parallel sub-collections and queries
      const [productsSnap, activitiesSnap, historySnap, contractsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'clients', clientId, 'activities')),
        getDocs(collection(db, 'clients', clientId, 'history')),
        getDocs(query(collection(db, 'contracts'), where('original.clientId', '==', clientId))),
        getDocs(collection(db, 'users'))
      ]);

      // Process Products
      const prods: typeof productsList = [];
      productsSnap.forEach((doc: any) => {
        const p = doc.data()?.original || doc.data();
        prods.push({
          id: doc.id,
          name: p.name,
          listPrice: p.listPrice,
          minPrice: p.minPrice
        });
      });
      productsList = prods;

      // Process Contracts and Quotes (drafts) in memory
      const contracts: any[] = [];
      const quotes: any[] = [];
      contractsSnap.forEach((doc: any) => {
        const c = doc.data();
        const docData = { id: doc.id, ...c.original, edits: c.edits, derived: c.derived };
        if (c.original?.status === 'draft') {
          quotes.push(docData);
        } else {
          contracts.push(docData);
        }
      });
      contractsList = contracts.sort((a, b) => new Date(b.edits?.createdAt || 0).getTime() - new Date(a.edits?.createdAt || 0).getTime());
      quotesList = quotes.sort((a, b) => new Date(b.edits?.createdAt || 0).getTime() - new Date(a.edits?.createdAt || 0).getTime());

      // Process Activities
      const acts: any[] = [];
      activitiesSnap.forEach((doc: any) => {
        const act = doc.data();
        acts.push({ id: doc.id, ...act.original, edits: act.edits });
      });
      activitiesList = acts.sort((a, b) => new Date(b.edits?.createdAt || a.date).getTime() - new Date(a.edits?.createdAt || b.date).getTime());

      // Process Client History (Audit logs)
      const histories: any[] = [];
      historySnap.forEach((doc: any) => {
        const h = doc.data();
        histories.push({ id: doc.id, ...h.original, edits: h.edits });
      });
      historyList = histories.sort((a, b) => {
        const timeB = new Date(b.edits?.createdAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.edits?.createdAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      });

      // Process Users
      const uList: any[] = [];
      usersSnap.forEach((doc: any) => {
        const u = doc.data()?.original || doc.data();
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

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'quotes' || tabParam === 'activities' || tabParam === 'profile') {
        activeTab = tabParam;
      }
    }

    loadAllData();
    return () => unsubscribe();
  });

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!$auth) return;

    if (!clientName.trim()) {
      isError = true;
      statusMessage = "Il Nome Azienda è obbligatorio.";
      return;
    }
    if (!clientFiscalId.trim()) {
      isError = true;
      statusMessage = "L'Identificativo Fiscale è obbligatorio.";
      return;
    }
    if (!clientEmail.trim() && !clientPhone.trim()) {
      isError = true;
      statusMessage = "Inserire almeno un contatto tra Email e Telefono.";
      return;
    }

    submittingProfile = true;
    statusMessage = '';
    isError = false;

    try {
      const isDirezione = $activeRole === 'direzione';

      // Uniqueness check for clientFiscalId (excluding current clientId)
      if (!isDirezione) {
        const checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', clientFiscalId.trim()));
        const checkSnap = await getDocs(checkQuery);
        const otherWithSameId = checkSnap.docs.some((doc: any) => doc.id !== clientId);
        if (otherWithSameId) {
          throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
        }
      }

      const now = new Date().toISOString();

      // Profile updates are kept inside original namespace
      await updateDoc(doc(db, 'clients', clientId), {
        'original.nome': isDirezione ? originalProfile.nome : clientName.trim(),
        'original.cognome': isDirezione ? originalProfile.cognome : clientCognome.trim(),
        'original.email': isDirezione ? originalProfile.email : clientEmail.trim(),
        'original.phone': isDirezione ? originalProfile.phone : clientPhone.trim(),
        'original.status': isDirezione ? originalProfile.status : clientStatus,
        'original.fiscalId': isDirezione ? originalProfile.fiscalId : clientFiscalId.trim(),
        'original.partitaIva': isDirezione ? originalProfile.partitaIva : clientPartitaIva.trim(),
        'original.codiceFiscale': isDirezione ? originalProfile.codiceFiscale : clientCodiceFiscale.trim(),
        'derived.textSearch': generateSearchTerms((isDirezione ? originalProfile.nome : clientName.trim()) + ' ' + (isDirezione ? originalProfile.partitaIva : clientPartitaIva.trim()) + ' ' + (isDirezione ? originalProfile.codiceFiscale : clientCodiceFiscale.trim())),
        'edits.modifiedAt': now,
        'edits.modifiedBy': $auth.uid
      });

      // Log history audit log if there are changes
      const changes: Record<string, { oldVal: any, newVal: any }> = {};
      let hasChanges = false;
      const fields = ['nome', 'cognome', 'email', 'phone', 'status', 'fiscalId', 'partitaIva', 'codiceFiscale'];
      
      const newOriginal = {
        nome: isDirezione ? originalProfile.nome : clientName.trim(),
        cognome: isDirezione ? originalProfile.cognome : clientCognome.trim(),
        email: isDirezione ? originalProfile.email : clientEmail.trim(),
        phone: isDirezione ? originalProfile.phone : clientPhone.trim(),
        status: isDirezione ? originalProfile.status : clientStatus,
        fiscalId: isDirezione ? originalProfile.fiscalId : clientFiscalId.trim(),
        partitaIva: isDirezione ? originalProfile.partitaIva : clientPartitaIva.trim(),
        codiceFiscale: isDirezione ? originalProfile.codiceFiscale : clientCodiceFiscale.trim()
      };

      fields.forEach(f => {
        const oldVal = originalProfile[f] || '';
        const newVal = (newOriginal as any)[f] || '';
        if (oldVal !== newVal) {
          changes[f] = { oldVal, newVal };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        const historyId = 'audit_' + Math.random().toString(36).substring(2, 11);
        await setDoc(doc(db, 'clients', clientId, 'history', historyId), {
          original: {
            clientId,
            updatedBy: $auth.uid,
            updatedEmail: $auth.email,
            changes
          },
          edits: {
            createdAt: now
          }
        });
      }

      statusMessage = 'Profilo cliente aggiornato con successo!';
      originalProfile = { ...newOriginal, createdBy: clientCreatedBy };
      await loadAllData();
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore nel salvataggio.';
    } finally {
      submittingProfile = false;
    }
  }

  // Delete client with constraints
  async function handleDeleteClient() {
    if ($activeRole !== 'superadmin') {
      alert("Solo il Superadmin può eliminare un cliente.");
      return;
    }

    let hasNestedData = clientDerived.contractsCount > 0 || historyList.length > 0 || activitiesList.length > 0;
    
    if (hasNestedData) {
      const resp = prompt("ATTENZIONE: Questo cliente possiede dati collegati (contratti, incassi, log, attività). Vuoi procedere? Verranno eliminati definitivamente in cascata tutti i suoi dati. Scrivi 'ELIMINA' per confermare.");
      if (resp !== 'ELIMINA') return;
    } else {
      if (!confirm("Sei sicuro di voler eliminare definitivamente questa anagrafica cliente? Questa azione è irreversibile.")) return;
    }

    submittingProfile = true;
    statusMessage = '';
    isError = false;

    try {
      // 1. Delete all activities
      for (const act of activitiesList) {
        await deleteDoc(doc(db, 'clients', clientId, 'activities', act.id));
      }
      // 2. Delete all history logs
      for (const hist of historyList) {
        await deleteDoc(doc(db, 'clients', clientId, 'history', hist.id));
      }
      
      // 3. Delete all contracts and their installments
      const contractsSnap = await getDocs(query(collection(db, 'contracts'), where('original.clientId', '==', clientId)));
      for (const cDoc of contractsSnap.docs) {
        const installmentsSnap = await getDocs(collection(db, 'contracts', cDoc.id, 'installments'));
        for (const instDoc of installmentsSnap.docs) {
          await deleteDoc(doc(db, 'contracts', cDoc.id, 'installments', instDoc.id));
        }
        await deleteDoc(doc(db, 'contracts', cDoc.id));
      }

      // 4. Delete all payments and their contractsPaid allocations
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('original.clientId', '==', clientId)));
      for (const pDoc of paymentsSnap.docs) {
        const allocationsSnap = await getDocs(collection(db, 'payments', pDoc.id, 'contractsPaid'));
        for (const allocDoc of allocationsSnap.docs) {
          await deleteDoc(doc(db, 'payments', pDoc.id, 'contractsPaid', allocDoc.id));
        }
        await deleteDoc(doc(db, 'payments', pDoc.id));
      }

      // 5. Finally, delete the client document
      await deleteDoc(doc(db, 'clients', clientId));

      statusMessage = 'Anagrafica cliente eliminata con successo! Reindirizzamento...';
      setTimeout(() => {
        goto('/dashboard/clients');
      }, 1500);
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || "Errore durante l'eliminazione del cliente.";
      submittingProfile = false;
    }
  }

  // Add simple Note directly to client original notes
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

      const updatedNotes = [...clientNotes, JSON.stringify(noteObject)];
      await updateDoc(doc(db, 'clients', clientId), {
        'original.notes': updatedNotes,
        'edits.modifiedAt': new Date().toISOString(),
        'edits.modifiedBy': $auth.uid
      });

      (e.target as any).noteText.value = '';
      statusMessage = 'Nota aggiunta con successo!';
      await loadAllData();
    } catch (e: any) {
      statusMessage = 'Errore durante l\'inserimento della nota: ' + e.message;
      isError = true;
    }
  }

  // Log activity inside the subcollection clients/{clientId}/activities
  async function logActivity(type: 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC', datetimeVal?: string) {
    if (!$auth) return;
    submittingActivity = true;
    statusMessage = '';
    isError = false;

    try {
      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      const activityDate = datetimeVal || new Date().toISOString();

      await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
        original: {
          clientId,
          clientName: `${clientName} ${clientCognome}`.trim(),
          type,
          notes: activityNotesText.trim(),
          date: activityDate,
          loggedBy: $auth.uid,
          loggedEmail: $auth.email,
          status: 'completata'
        },
        edits: {
          createdAt: activityDate,
          createdBy: $auth.uid
        }
      });

      // Transition client status to contacted if prospect (Triggers do this automatically for customer, but we can do it client-side for contacted)
      if (clientStatus === 'prospect') {
        await updateDoc(doc(db, 'clients', clientId), {
          'original.status': 'contacted'
        });
      }

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

  function handleAddQuoteItem() {
    if (!selectedProductId) return;
    const prod = productsList.find(p => p.id === selectedProductId);
    if (!prod) return;

    const soldPrice = itemPriceSold !== null ? itemPriceSold : prod.listPrice;
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

    selectedProductId = '';
    itemPriceSold = null;
    itemQuantity = 1;
    quoteSuccessMsg = 'Prodotto aggiunto al preventivo corrente.';
  }

  function handleRemoveQuoteItem(index: number) {
    quoteItems.splice(index, 1);
  }

  let quoteTotal = $derived(
    quoteItems.reduce((sum, item) => sum + item.priceSold * item.quantity, 0)
  );

  async function handleSaveQuote() {
    if (quoteItems.length === 0 || !$auth) return;
    submittingQuote = true;
    quoteErrorMsg = '';
    quoteSuccessMsg = '';

    try {
      const contractId = 'contract_' + Math.random().toString(36).substring(2, 11);
      const now = new Date().toISOString();

      let secondVendorEmail = '';
      if (secondVendorUid) {
        const found = usersList.find(u => u.uid === secondVendorUid);
        secondVendorEmail = found ? found.email : '';
      }

      const newQuoteDraft = {
        original: {
          clientId,
          clientName: `${clientName} ${clientCognome}`.trim(),
          clientEmail: clientEmail,
          vendorUid: $auth.uid,
          vendorEmail: $auth.email,
          products: quoteItems,
          totalPrice: quoteTotal,
          status: 'draft',
          hasWarning: quoteItems.some(item => item.priceSold < item.minPrice),
          ...(secondVendorUid ? {
            secondVendorUid,
            secondVendorEmail,
            secondVendorShare: Number(secondVendorShare)
          } : {})
        },
        derived: {},
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      };

      await setDoc(doc(db, 'contracts', contractId), newQuoteDraft);
      
      if (clientStatus === 'prospect') {
        await updateDoc(doc(db, 'clients', clientId), {
          'original.status': 'proposal_sent'
        });
      }
      
      quoteItems = [];
      secondVendorUid = '';
      secondVendorShare = 30;
      quoteSuccessMsg = 'Preventivo salvato in bozza con successo!';
      await loadAllData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante il salvataggio del preventivo: ' + e.message;
    } finally {
      submittingQuote = false;
    }
  }

  async function convertToContract(items: typeof quoteItems, quoteId?: string) {
    if (items.length === 0 || !$auth) return;
    submittingQuote = true;
    quoteErrorMsg = '';
    quoteSuccessMsg = '';

    try {
      const hasWarning = items.some(item => item.priceSold < item.minPrice);
      const totalContractPrice = items.reduce((sum, item) => sum + item.priceSold * item.quantity, 0);
      const now = new Date().toISOString();

      let secondVendorEmail = '';
      if (secondVendorUid) {
        const found = usersList.find(u => u.uid === secondVendorUid);
        secondVendorEmail = found ? found.email : '';
      }

      if (quoteId) {
        // We are converting an existing draft/quote contract to pending contract
        await updateDoc(doc(db, 'contracts', quoteId), {
          'original.status': 'pending',
          'original.totalPrice': totalContractPrice,
          'original.products': items,
          'original.hasWarning': hasWarning,
          'original.secondVendorUid': secondVendorUid || null,
          'original.secondVendorEmail': secondVendorEmail || null,
          'original.secondVendorShare': secondVendorUid ? Number(secondVendorShare) : null,
          'edits.modifiedAt': now,
          'edits.modifiedBy': $auth.uid
        });
      } else {
        // We are converting the current unsaved items in the editor
        const contractId = 'contract_' + Math.random().toString(36).substring(2, 11);
        const newContract = {
          original: {
            clientId,
            clientName: `${clientName} ${clientCognome}`.trim(),
            clientEmail: clientEmail,
            vendorUid: $auth.uid,
            vendorEmail: $auth.email,
            totalPrice: totalContractPrice,
            products: items,
            status: 'pending',
            hasWarning,
            ...(secondVendorUid ? {
              secondVendorUid,
              secondVendorEmail,
              secondVendorShare: Number(secondVendorShare)
            } : {})
          },
          derived: {},
          edits: {
            createdAt: now,
            createdBy: $auth.uid
          }
        };
        await setDoc(doc(db, 'contracts', contractId), newContract);
      }

      if (clientStatus === 'prospect') {
        await updateDoc(doc(db, 'clients', clientId), {
          'original.status': 'proposal_sent'
        });
      }

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
  <Card class="header-card">
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
    {/if}
  </Card>

  {#if !loadingData && !isError}
    <div class="tab-content-panel">
      {#if activeTab === 'profile'}
        <ClientProfileTab
          bind:clientName
          bind:clientCognome
          bind:clientEmail
          bind:clientPhone
          bind:clientStatus
          bind:clientCreatedBy
          bind:clientFiscalId
          bind:clientPartitaIva
          bind:clientCodiceFiscale
          usersList={usersList}
          historyList={historyList}
          submittingProfile={submittingProfile}
          activeRole={$activeRole}
          originalProfile={originalProfile}
          contractsCount={clientDerived.contractsCount || 0}
          onUpdateProfile={handleUpdateProfile}
          onDeleteClient={handleDeleteClient}
        />
      {/if}

      {#if activeTab === 'activities'}
        <ClientActivitiesTab
          activitiesList={activitiesList}
          clientNotes={clientNotes}
          clientCreatedAt={clientCreatedAt}
          newlyCreatedId={newlyCreatedId}
          bind:activityNotesText
          bind:appointmentDateTime
          activeRole={$activeRole}
          submittingActivity={submittingActivity}
          logActivity={logActivity}
          handleAddNote={handleAddNote}
          parseNote={parseNote}
        />
      {/if}

      {#if activeTab === 'quotes'}
        <ClientQuotesTab
          productsList={productsList}
          quotesList={quotesList}
          contractsList={contractsList}
          usersList={usersList}
          auth={$auth}
          bind:selectedProductId
          bind:itemPriceSold
          bind:itemQuantity
          bind:quoteItems
          bind:secondVendorUid
          bind:secondVendorShare
          activeRole={$activeRole}
          submittingQuote={submittingQuote}
          bind:quoteSuccessMsg
          bind:quoteErrorMsg
          quoteTotal={quoteTotal}
          onProductSelectChange={onProductSelectChange}
          onAddQuoteItem={handleAddQuoteItem}
          onRemoveQuoteItem={handleRemoveQuoteItem}
          onSaveQuote={handleSaveQuote}
          onConvertToContract={convertToContract}
        />
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
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .details-tab-nav {
    display: flex;
    gap: 10px;
    margin-top: 24px;
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
  .tab-content-panel {
    margin-top: 24px;
  }
</style>
