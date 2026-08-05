<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { page } from '$app/stores';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, User, MessageSquare, FileText, QrCode, UserCheck } from '@lucide/svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import ClientTicketQRCodeModal from '$lib/components/ClientTicketQRCodeModal.svelte';
  import AnonymizeModal from '$lib/components/AnonymizeModal.svelte';
  import { AnonymizationService, CLIENTS_ANONYMIZATION_SPEC } from '$lib/services/anonymizationService';
  import { can } from '$lib/services/roles.service';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Scheda Cliente CRM');
  import ClientProfileTab from './components/ClientProfileTab.svelte';
  import ClientActivitiesTab from './components/ClientActivitiesTab.svelte';
  import ClientContactsTab from './components/ClientContactsTab.svelte';
  import { Card } from '$lib';
  import { menuConfigStore } from '$lib/stores/menu';
  import { ClientDetailService } from './client-detail.service';

  // Dynamic Tabs Injection
  const injectedTabs = import.meta.glob('../../../routes/dashboard/*/client-tabs/*.svelte', { eager: true });
  
  let dynamicTabsFromConfig = $derived($menuConfigStore.flatMap(m => 
    ((m as any).clientTabs || []).map((tab: any) => ({ ...tab, moduleId: m.id }))
  ));

  let activeDynamicTabs = $derived(
    dynamicTabsFromConfig.map(tab => {
      // The path format for the glob is relative to this file's path
      // This file is at src/routes/dashboard/clients/[id]/+page.svelte
      // The glob targets src/routes/dashboard/*/client-tabs/*.svelte
      // So relative path from here is: ../../../routes/dashboard/${moduleId}/client-tabs/${tab.component}
      // Actually since it's eager: true, keys are like '../../../routes/dashboard/contracts/client-tabs/ClientQuotesTab.svelte'
      const path = Object.keys(injectedTabs).find(k => k.includes(`/${tab.moduleId}/client-tabs/${tab.component}`));
      return {
        ...tab,
        componentInstance: path ? (injectedTabs[path] as any).default : null
      };
    }).filter(tab => tab.componentInstance)
  );


  let hasActivitiesModule = $derived($menuConfigStore.some(i => i.id === 'activities'));
  let hasContractsModule = $derived($menuConfigStore.some(i => i.id === 'contracts'));
  let hasTicketsModule = $derived($menuConfigStore.some(i => i.id === 'tickets'));

  const clientId = $page.params.id as string;
  let showQRCodeModal = $state(false);
  let showAnonymizeModal = $state(false);

  // Tabs
  let activeTab = $state<string>('profile');

  // Loaders & Status
  let loadingData = $state(true);
  let submittingProfile = $state(false);
  let submittingActivity = $state(false);
  let submittingQuote = $state(false);
  let newlyCreatedId = $state('');
  let activitiesConfig = $state<any[]>([]);

  // Client profile fields
  let clientName = $state('');
  let clientCognome = $state('');
  let clientEmail = $state('');
  let clientPhone = $state('');
  let clientWebsite = $state('');
  let clientCreatedBy = $state('');
  let clientAssignedAdminId = $state('');
  let clientCreatedAt = $state('');
  let clientNotes = $state<string[]>([]);
  let clientStatus = $state('prospect');
  let clientFiscalId = $state('');
  let clientPartitaIva = $state('');
  let clientCodiceFiscale = $state('');

  // Anagrafica & ERP additions
  let clientCode = $state('');
  let clientGroup = $state('Standard');
  let certificationStatus = $state('Certificato');
  let isItalianSubject = $state(true);

  // SDI & Bank Data
  let clientSdiCode = $state('');
  let clientPec = $state('');
  let clientIban = $state('');
  let clientBankName = $state('');
  let clientPaymentTerms = $state('');
  let mainPhone = $state('');

  // Referenti Rapidi
  let referenteTecnico = $state('');
  let telReferente = $state('');
  let emailContatto = $state('');
  let emailAlternativa = $state('');

  // Affidabilità & Credito
  let crifCheck = $state('ESEGUITO & VALIDO');
  let riskClass = $state('AAA (Basso Rischio)');
  let maxCredit = $state<number>(0);
  let residualCredit = $state<number>(0);
  let paymentStatus = $state('Regolare');

  // Note ERP
  let internalAdminNotes = $state('');
  let quoteAutoNotes = $state('');

  // Sede Principale
  let clientAddress = $state('');
  let clientCity = $state('');
  let clientProvince = $state('');
  let clientPostalCode = $state('');
  let clientCountry = $state('Italy');

  // Fatturazione
  let clientBillingAddress = $state('');
  let clientBillingCity = $state('');
  let clientBillingProvince = $state('');
  let clientBillingPostalCode = $state('');
  let clientBillingCountry = $state('Italy');

  // Spedizione
  let clientShippingAddress = $state('');
  let clientShippingCity = $state('');
  let clientShippingProvince = $state('');
  let clientShippingPostalCode = $state('');
  let clientShippingCountry = $state('Italy');

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



  function getNowDateTimeString() {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
  }

  let activeModuleIds = $derived($menuConfigStore.map(m => m.id));

  // Load everything
  async function loadAllData() {
    loadingData = true;
    try {
      const payload = await ClientDetailService.fetchClientData(clientId, activeModuleIds);
      if (hasActivitiesModule) {
        try {
          const { loadOptionalService } = await import('$lib/utils/moduleBridge');
          const mod = await loadOptionalService('activityTypesService');
          if (mod && mod.ActivityTypesService) {
            activitiesConfig = await mod.ActivityTypesService.getActivityTypes();
          }
        } catch (e) {
          console.warn('ActivityTypesService dynamic import failed:', e);
        }
      }



      
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
      clientWebsite = originalProfile.website || '';
      clientStatus = originalProfile.status || 'prospect';
      clientFiscalId = originalProfile.fiscalId || '';
      clientPartitaIva = originalProfile.partitaIva || '';
      clientCodiceFiscale = originalProfile.codiceFiscale || '';
      clientCreatedBy = originalProfile.createdBy || '';
      clientAssignedAdminId = originalProfile.assignedAdminId || originalProfile.createdBy || '';

      clientCode = originalProfile.clientCode || '';
      clientGroup = originalProfile.clientGroup || 'Standard';
      certificationStatus = originalProfile.certificationStatus || 'Certificato';
      isItalianSubject = originalProfile.isItalianSubject !== undefined ? originalProfile.isItalianSubject : true;

      clientSdiCode = originalProfile.sdiCode || '';
      clientPec = originalProfile.pec || '';
      clientIban = originalProfile.iban || '';
      clientBankName = originalProfile.bankName || '';
      clientPaymentTerms = originalProfile.paymentTerms || '';
      mainPhone = originalProfile.mainPhone || originalProfile.phone || '';

      referenteTecnico = originalProfile.referenteTecnico || '';
      telReferente = originalProfile.telReferente || '';
      emailContatto = originalProfile.emailContatto || originalProfile.email || '';
      emailAlternativa = originalProfile.emailAlternativa || '';

      crifCheck = originalProfile.crifCheck || 'ESEGUITO & VALIDO';
      riskClass = originalProfile.riskClass || 'AAA (Basso Rischio)';
      maxCredit = originalProfile.maxCredit || 0;
      residualCredit = originalProfile.residualCredit || 0;
      paymentStatus = originalProfile.paymentStatus || 'Regolare';

      internalAdminNotes = originalProfile.internalAdminNotes || '';
      quoteAutoNotes = originalProfile.quoteAutoNotes || '';

      clientAddress = originalProfile.address || '';
      clientCity = originalProfile.city || '';
      clientProvince = originalProfile.province || '';
      clientPostalCode = originalProfile.postalCode || '';
      clientCountry = originalProfile.country || 'Italy';

      clientBillingAddress = originalProfile.billingAddress || clientAddress;
      clientBillingCity = originalProfile.billingCity || clientCity;
      clientBillingProvince = originalProfile.billingProvince || clientProvince;
      clientBillingPostalCode = originalProfile.billingPostalCode || clientPostalCode;
      clientBillingCountry = originalProfile.billingCountry || clientCountry;

      clientShippingAddress = originalProfile.shippingAddress || clientBillingAddress;
      clientShippingCity = originalProfile.shippingCity || clientBillingCity;
      clientShippingProvince = originalProfile.shippingProvince || clientBillingProvince;
      clientShippingPostalCode = originalProfile.shippingPostalCode || clientBillingPostalCode;
      clientShippingCountry = originalProfile.shippingCountry || clientBillingCountry;
    } catch (e: any) {
      console.error(e);
      toast.error('Errore durante il caricamento dei dati: ' + e.message);
    } finally {
      loadingData = false;
    }
  }

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'quotes' || tabParam === 'activities' || tabParam === 'profile') {
        activeTab = tabParam;
      }
    }

    loadAllData();
  });

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!authState.user || !activeRoleState.role) return;

    if (!clientName.trim()) {
      toast.error("Il Nome Azienda è obbligatorio.");
      return;
    }

    submittingProfile = true;

    try {
      const newProfile = {
        nome: clientName.trim(),
        cognome: clientCognome.trim(),
        email: clientEmail.trim(),
        phone: clientPhone.trim(),
        website: clientWebsite.trim(),
        status: clientStatus,
        fiscalId: clientFiscalId.trim(),
        partitaIva: clientPartitaIva.trim(),
        codiceFiscale: clientCodiceFiscale.trim(),
        clientCode: clientCode.trim(),
        clientGroup,
        certificationStatus,
        isItalianSubject,
        sdiCode: clientSdiCode.trim(),
        pec: clientPec.trim(),
        iban: clientIban.trim(),
        bankName: clientBankName.trim(),
        paymentTerms: clientPaymentTerms.trim(),
        mainPhone: mainPhone.trim(),
        referenteTecnico: referenteTecnico.trim(),
        telReferente: telReferente.trim(),
        emailContatto: emailContatto.trim(),
        emailAlternativa: emailAlternativa.trim(),
        crifCheck,
        riskClass,
        maxCredit,
        residualCredit,
        paymentStatus,
        internalAdminNotes: internalAdminNotes.trim(),
        quoteAutoNotes: quoteAutoNotes.trim(),
        address: clientAddress.trim(),
        city: clientCity.trim(),
        province: clientProvince.trim(),
        postalCode: clientPostalCode.trim(),
        country: clientCountry.trim(),
        billingAddress: clientBillingAddress.trim(),
        billingCity: clientBillingCity.trim(),
        billingProvince: clientBillingProvince.trim(),
        billingPostalCode: clientBillingPostalCode.trim(),
        billingCountry: clientBillingCountry.trim(),
        shippingAddress: clientShippingAddress.trim(),
        shippingCity: clientShippingCity.trim(),
        shippingProvince: clientShippingProvince.trim(),
        shippingPostalCode: clientShippingPostalCode.trim(),
        shippingCountry: clientShippingCountry.trim(),
        createdBy: clientCreatedBy,
        assignedAdminId: clientAssignedAdminId
      };

      const newOriginal = await ClientDetailService.updateProfile(
        clientId, 
        activeRoleState.role, 
        originalProfile, 
        newProfile, 
        { uid: authState.user.uid, email: authState.user.email! }
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
    if (activeRoleState.role !== 'superadmin') {
      toast.error("Solo il Superadmin può eliminare un cliente.");
      return;
    }

    let hasNestedData = (clientDerived.contractsCount || 0) > 0 || historyList.length > 0 || activitiesList.length > 0;
    
    if (hasNestedData) {
      const resp = await confirmStore.requireMatch("ATTENZIONE: Questo cliente possiede dati collegati (contratti, incassi, log, attività). Vuoi procedere? Verranno eliminati definitivamente in cascata tutti i suoi dati.", 'ELIMINA');
      if (!resp) return;
    }

    submittingProfile = true;

    try {
      await ClientDetailService.deleteClientCascade(clientId);

      toast.success('Anagrafica ed eventuali sotto-risorse collegate eliminate con successo!');
      goto('/dashboard/clients');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante l\'eliminazione dell\'anagrafica.');
    } finally {
      submittingProfile = false;
    }
  }

  async function handleAddNote(e: Event | string) {
    let noteText = '';
    if (typeof e === 'string') {
      noteText = e;
    } else {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      noteText = (formData.get('noteText') as string) || '';
      form.reset();
    }
    if (!noteText.trim() || !authState.user) return;
    try {
      const updatedNotes = await ClientDetailService.addNote(clientId, noteText, authState.user.email || 'Utente');
      clientNotes = updatedNotes;
      toast.success('Nota aggiunta con successo!');
    } catch (err: any) {
      toast.error('Errore durante il salvataggio della nota: ' + err.message);
    }
  }

  async function logActivity(notes: string, appointmentDate?: string) {
    if (!notes.trim()) {
      toast.error('Inserisci una nota descrittiva dell\'attività.');
      return;
    }
    if (!authState.user) return;

    submittingActivity = true;

    try {
      const activityId = await ClientDetailService.logActivity(
        clientId, 
        notes, 
        appointmentDate, 
        { uid: authState.user.uid, email: authState.user.email! }
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


  async function confirmAnonymize() {
    try {
      submittingProfile = true;
      showAnonymizeModal = false;
      await AnonymizationService.anonymizeEntity('clients', clientId, CLIENTS_ANONYMIZATION_SPEC, authState.user?.uid || 'system');
      toast.success('Cliente anonimizzato con successo.');
      await loadAllData();
    } catch (e: any) {
      console.error('Error anonymizing client:', e);
      toast.error('Errore durante l\'anonimizzazione: ' + e.message);
    } finally {
      submittingProfile = false;
    }
  }
</script>

<div class="client-details-page animate-fade-in">
  <Card class="header-card">
    <div class="page-top-actions">
      <a href="/dashboard/clients" class="back-link-btn action-link">
        <ArrowLeft size={16} /> Torna a elenco clienti
      </a>
      <h2 class="title-header">Gestione Cliente: {clientName} {clientCognome}</h2>
      {#if hasTicketsModule}
        <button type="button" onclick={() => (showQRCodeModal = true)} class="btn-qr-modal">
          <QrCode size={16} /> QR Code Assistenza
        </button>
      {/if}
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
          <User size={16} /> Profilo & Scheda Dettagli
        </button>

        <button 
          class="tab-nav-btn" 
          class:active={activeTab === 'contacts'} 
          onclick={() => activeTab = 'contacts'}
        >
          <UserCheck size={16} /> Contatti & Referenti
        </button>

        {#if hasActivitiesModule && (can('activities:read', activeRoleState.role) || can('activities:list', activeRoleState.role))}
          <button 
            class="tab-nav-btn" 
            class:active={activeTab === 'activities'} 
            onclick={() => activeTab = 'activities'}
          >
            <MessageSquare size={16} /> Attività & Note
          </button>
        {/if}

        {#each activeDynamicTabs as tab}
          <button 
            class="tab-nav-btn" 
            class:active={activeTab === tab.id} 
            onclick={() => activeTab = tab.id}
          >
            <FileText size={16} /> {tab.label}
          </button>
        {/each}
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
          bind:clientWebsite
          bind:clientStatus
          bind:clientCreatedBy
          bind:clientAssignedAdminId
          bind:clientFiscalId
          bind:clientPartitaIva
          bind:clientCodiceFiscale
          bind:clientCode
          bind:clientGroup
          bind:certificationStatus
          bind:isItalianSubject
          bind:clientSdiCode
          bind:clientPec
          bind:clientIban
          bind:clientBankName
          bind:clientPaymentTerms
          bind:referenteTecnico
          bind:telReferente
          bind:emailContatto
          bind:emailAlternativa
          bind:crifCheck
          bind:riskClass
          bind:maxCredit
          bind:residualCredit
          bind:paymentStatus
          bind:internalAdminNotes
          bind:quoteAutoNotes
          bind:clientAddress
          bind:clientCity
          bind:clientProvince
          bind:clientPostalCode
          bind:clientCountry
          bind:clientBillingAddress
          bind:clientBillingCity
          bind:clientBillingProvince
          bind:clientBillingPostalCode
          bind:clientBillingCountry
          bind:clientShippingAddress
          bind:clientShippingCity
          bind:clientShippingProvince
          bind:clientShippingPostalCode
          bind:clientShippingCountry
          usersList={usersList}
          historyList={historyList}
          submittingProfile={submittingProfile}
          activeRole={activeRoleState.role}
          originalProfile={originalProfile}
          contractsCount={clientDerived.contractsCount || 0}
          onUpdateProfile={handleUpdateProfile}
          onDeleteClient={handleDeleteClient}
          onOpenAnonymize={() => showAnonymizeModal = true}
        />
      {:else if activeTab === 'contacts'}
        <ClientContactsTab
          clientId={clientId}
          clientName={clientName}
          userId={authState.user?.uid || ''}
        />
      {:else if activeTab === 'activities' && (can('activities:read', activeRoleState.role) || can('activities:list', activeRoleState.role))}
        <ClientActivitiesTab
          activitiesList={activitiesList}
          clientNotes={clientNotes}
          clientCreatedAt={clientCreatedAt}
          newlyCreatedId={newlyCreatedId}
          activitiesConfig={activitiesConfig}

          activeRole={activeRoleState.role}
          submittingActivity={submittingActivity}
          logActivity={logActivity}
          updateActivity={updateActivity}
          handleAddNote={handleAddNote}
          parseNote={parseNote}
        />
      {/if}

      {#each activeDynamicTabs as tab}
        {#if activeTab === tab.id}
          <svelte:component this={tab.componentInstance} {clientId} clientData={{ nome: clientName, cognome: clientCognome }} />
        {/if}
      {/each}
    </div>
  {/if}
</div>

{#if showQRCodeModal}
  <ClientTicketQRCodeModal clientId={clientId} clientName={`${clientName} ${clientCognome}`} bind:isOpen={showQRCodeModal} />
{/if}

{#if showAnonymizeModal}
  <AnonymizeModal
    isOpen={showAnonymizeModal}
    entityName="Cliente"
    originalDoc={{...originalProfile, id: clientId}}
    specs={CLIENTS_ANONYMIZATION_SPEC}
    onConfirm={confirmAnonymize}
    onClose={() => showAnonymizeModal = false}
  />
{/if}

<style>
  .client-details-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;
  }
  .title-header {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .action-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s;
  }
  .action-link:hover {
    color: var(--color-primary-600);
  }
  .btn-qr-modal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
    border: 1px solid var(--color-neutral-300);
    padding: 8px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-qr-modal:hover {
    background: var(--color-neutral-200);
    color: var(--color-neutral-900);
  }
  .details-tab-nav {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--color-neutral-200);
    padding-bottom: 0;
    margin-bottom: -16px;
  }
  .tab-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    transition: all 0.2s;
  }
  .tab-nav-btn:hover {
    color: var(--color-primary-600);
  }
  .tab-nav-btn.active {
    color: var(--color-primary-600);
    border-bottom-color: var(--color-primary-600);
  }
  .loading-box {
    padding: 40px;
    display: flex;
    justify-content: center;
  }
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
