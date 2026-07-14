<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, User, MessageSquare, FileText } from '@lucide/svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Scheda Cliente CRM');
  import ClientProfileTab from './components/ClientProfileTab.svelte';
  import ClientActivitiesTab from './components/ClientActivitiesTab.svelte';
  import ClientQuotesTab from './components/ClientQuotesTab.svelte';
  import { Card } from '$lib';
  import { ClientDetailService } from './client-detail.service';

  const clientId = $page.params.id as string;

  // Tabs
  let activeTab = $state<'profile' | 'activities' | 'quotes'>('profile');

  // Loaders & Status
  let loadingData = $state(true);
  let submittingProfile = $state(false);
  let submittingActivity = $state(false);
  let submittingQuote = $state(false);
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
  let productsList = $state<any[]>([]);

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
  let quoteItems = $state<Array<any>>([]);
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
      const payload = await ClientDetailService.fetchClientData(clientId);
      
      clientDerived = payload.clientDerived;
      originalProfile = payload.originalProfile;
      clientCreatedAt = payload.clientCreatedAt;
      productsList = payload.productsList;
      activitiesList = payload.activitiesList;
      historyList = payload.historyList;
      contractsList = payload.contractsList;
      quotesList = payload.quotesList;
      usersList = payload.usersList;
      clientNotes = payload.clientNotes;

      clientName = originalProfile.nome || '';
      clientCognome = originalProfile.cognome || '';
      clientEmail = originalProfile.email || '';
      clientPhone = originalProfile.phone || '';
      clientStatus = originalProfile.status || 'prospect';
      clientFiscalId = originalProfile.fiscalId || '';
      clientPartitaIva = originalProfile.partitaIva || '';
      clientCodiceFiscale = originalProfile.codiceFiscale || '';
      clientCreatedBy = originalProfile.createdBy || '';
    } catch (e: any) {
      console.error(e);
      toast.error('Errore durante il caricamento dei dati: ' + e.message);
    } finally {
      loadingData = false;
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
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
    if (!$auth || !$activeRole) return;

    if (!clientName.trim()) {
      toast.error("Il Nome Azienda è obbligatorio.");
      return;
    }
    if (!clientFiscalId.trim() && !clientCodiceFiscale.trim() && !clientPartitaIva.trim()) {
      toast.error("L'Identificativo Fiscale è obbligatorio.");
      return;
    }
    if (!clientEmail.trim() && !clientPhone.trim()) {
      toast.error("Inserire almeno un contatto tra Email e Telefono.");
      return;
    }

    submittingProfile = true;

    try {
      const newProfile = {
        nome: clientName.trim(),
        cognome: clientCognome.trim(),
        email: clientEmail.trim(),
        phone: clientPhone.trim(),
        status: clientStatus,
        fiscalId: clientFiscalId.trim(),
        partitaIva: clientPartitaIva.trim(),
        codiceFiscale: clientCodiceFiscale.trim(),
        createdBy: clientCreatedBy
      };

      const newOriginal = await ClientDetailService.updateProfile(
        clientId, 
        $activeRole, 
        originalProfile, 
        newProfile, 
        { uid: $auth.uid, email: $auth.email! }
      );

      toast.success('Profilo cliente aggiornato con successo!');
      originalProfile = { ...newOriginal, createdBy: clientCreatedBy };
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Errore nel salvataggio.');
    } finally {
      submittingProfile = false;
    }
  }

  async function handleDeleteClient() {
    if ($activeRole !== 'superadmin') {
      toast.error("Solo il Superadmin può eliminare un cliente.");
      return;
    }

    let hasNestedData = (clientDerived.contractsCount || 0) > 0 || historyList.length > 0 || activitiesList.length > 0;
    
    if (hasNestedData) {
      const resp = await confirmStore.requireMatch("ATTENZIONE: Questo cliente possiede dati collegati (contratti, incassi, log, attività). Vuoi procedere? Verranno eliminati definitivamente in cascata tutti i suoi dati.", 'ELIMINA');
      if (!resp) return;
    } else {
      const ok = await confirmStore.prompt("Sei sicuro di voler eliminare definitivamente questa anagrafica cliente? Questa azione è irreversibile.");
      if (!ok) return;
    }

    submittingProfile = true;

    try {
      await ClientDetailService.deleteClient(clientId, activitiesList, historyList);
      toast.success('Anagrafica cliente eliminata con successo! Reindirizzamento...');
      setTimeout(() => {
        goto('/dashboard/clients');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante l'eliminazione del cliente.");
      submittingProfile = false;
    }
  }

  async function handleAddNote(e: Event) {
    e.preventDefault();
    const noteText = (e.target as any).noteText.value.trim();
    if (!noteText || !$auth) return;

    try {
      await ClientDetailService.addNote(clientId, clientNotes, noteText, { uid: $auth.uid, email: $auth.email! });
      (e.target as any).noteText.value = '';
      toast.success('Nota aggiunta con successo!');
      await loadAllData();
    } catch (e: any) {
      toast.error('Errore durante l\'inserimento della nota: ' + e.message);
    }
  }

  async function logActivity(type: string) {
    if (!$auth) return;
    submittingActivity = true;

    try {
      const clientNameStr = `${clientName} ${clientCognome}`.trim();
      const activityId = await ClientDetailService.logActivity(
        clientId, 
        clientNameStr, 
        clientStatus, 
        type, 
        '', // Empty note initially
        undefined, // Empty datetime initially
        { uid: $auth.uid, email: $auth.email! }
      );

      toast.success(`Attività registrata! Ora puoi modificarla se serve aggiungere note o date.`);
      newlyCreatedId = activityId;
      await loadAllData();
      await tick();
      const el = document.getElementById(`timeline-item-${activityId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Errore nel salvataggio dell\'attività.');
    } finally {
      submittingActivity = false;
    }
  }

  async function updateActivity(activityId: string, payload: any) {
    submittingActivity = true;
    try {
      await ClientDetailService.updateActivity(clientId, activityId, payload);
      toast.success('Attività aggiornata!');
      await loadAllData();
    } catch (e: any) {
      toast.error('Errore durante l\'aggiornamento: ' + e.message);
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
      const clientNameStr = `${clientName} ${clientCognome}`.trim();
      let secondVendorEmail = '';
      if (secondVendorUid) {
        const found = usersList.find(u => u.uid === secondVendorUid);
        secondVendorEmail = found ? found.email : '';
      }

      await ClientDetailService.saveQuote(
        clientId, 
        clientNameStr, 
        clientEmail, 
        clientStatus, 
        quoteItems, 
        quoteTotal, 
        secondVendorUid, 
        secondVendorEmail, 
        secondVendorShare, 
        { uid: $auth.uid, email: $auth.email! }
      );
      
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
      const clientNameStr = `${clientName} ${clientCognome}`.trim();
      let secondVendorEmail = '';
      if (secondVendorUid) {
        const found = usersList.find(u => u.uid === secondVendorUid);
        secondVendorEmail = found ? found.email : '';
      }

      await ClientDetailService.convertToContract(
        clientId, 
        clientNameStr, 
        clientEmail, 
        clientStatus, 
        items, 
        secondVendorUid, 
        secondVendorEmail, 
        secondVendorShare, 
        { uid: $auth.uid, email: $auth.email! },
        quoteId
      );

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



<div class="client-details-page animate-fade-in">
  <Card class="header-card">
    <div class="page-top-actions">
      <button onclick={() => goto('/dashboard/clients')} class="back-link-btn">
        <ArrowLeft size={16} /> Torna a elenco clienti
      </button>
      <h2 class="title-header">Gestione Cliente: {clientName} {clientCognome}</h2>
    </div>

    {#if loadingData}
      <div class="loading-box">
        <span class="spinner"></span>
      </div>
    {:else}
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

  {#if !loadingData}
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
          updateActivity={updateActivity}
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
