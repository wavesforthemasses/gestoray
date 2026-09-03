<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { NavigationService } from '$lib/services/navigationService';
  import { ContractsService } from '../contracts.service';
  import { ContractSettingsService } from '../contractSettingsService';
  import type { ContractItem, ContractInstallment, ContractStatus, ContractSettings } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { Card, FormField, Button, StatusBadge } from '$lib';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import ContractInstallmentModal from './components/ContractInstallmentModal.svelte';
  import { 
    List, 
    Printer, 
    Edit, 
    Info, 
    Euro, 
    Puzzle, 
    X, 
    User, 
    Plus,
    AlertTriangle,
    ShoppingBag,
    Tag,
    UserCheck,
    FolderKanban,
    MapPin,
    ExternalLink,
    CheckCircle,
    Clock,
    ShieldAlert,
    Trash2,
    Calendar,
    Users,
    Sparkles
  } from '@lucide/svelte';

  const contractId = $page.params.id || '';

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true
  });
  let labels = $derived(ContractSettingsService.getLabels(settings));

  let projectLabel = $state('Progetto');
  let contract = $state<ContractItem | null>(null);
  let installments = $state<ContractInstallment[]>([]);
  let customFieldsList = $state<any[]>([]);
  let loading = $state(true);
  let savingAction = $state(false);

  // Modal Nuova Rata
  let showInstallmentModal = $state(false);
  let instNumber = $state(1);
  let instDueDate = $state(new Date().toISOString().slice(0, 10));
  let instAmount = $state<number | undefined>(undefined);
  let instNotes = $state('');
  let savingInst = $state(false);

  // Modal Incasso Rata (con Scorpora IVA)
  let showCollectModal = $state(false);
  let selectedInstallmentId = $state<string | null>(null);
  let installmentActualAmount = $state<number | null>(null);
  let productAllocations = $state<Array<{ productId: string; amount: number }>>([]);

  let productsStatus = $derived.by(() => {
    if (!contract || !contract.items) return [];
    return contract.items.map(item => ({
      productId: item.productId,
      name: item.productName,
      price: item.priceSold * item.quantity,
      remaining: item.priceSold * item.quantity
    }));
  });

  let isAdmin = $derived(
    activeRoleState.role === 'superadmin' || activeRoleState.role === 'amministrazione'
  );

  let isPendingApproval = $derived(
    contract?.status === 'bozza' || 
    contract?.status === 'in_approvazione' || 
    contract?.status === 'draft' || 
    contract?.status === 'pending' || 
    contract?.status === 'inviato'
  );

  onMount(async () => {
    await loadContractData();
  });

  async function loadContractData() {
    try {
      const [s, c, inst, cf] = await Promise.all([
        ContractSettingsService.getSettings(),
        ContractsService.getContractById(contractId),
        ContractsService.getInstallments(contractId),
        CustomFieldsService.getFieldsForModule('contracts')
      ]);
      settings = s;
      contract = c;
      installments = inst;
      customFieldsList = cf;

      if (c && c.projectId) {
        try {
          const setPath = '../../projects/projectSettingsService';
          // @ts-ignore
          const modSet = await import(/* @vite-ignore */ setPath);
          if (modSet?.ProjectSettingsService) {
            const ps = await modSet.ProjectSettingsService.getSettings();
            projectLabel = modSet.ProjectSettingsService.getLabels(ps).singular;
          }
        } catch (e) {}
      }

      if (inst.length > 0) {
        instNumber = inst.length + 1;
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio contratto:', e);
      toast.error(`Impossibile caricare i dati del documento`);
    } finally {
      loading = false;
    }
  }

  // --- AZIONI WORKFLOW APPROVAZIONE ---

  async function handleApproveContract() {
    if (!authState.user || savingAction) return;
    const confirmed = await confirmStore.prompt("Confermi l'approvazione formale di questo documento?");
    if (!confirmed) return;

    savingAction = true;
    try {
      await ContractsService.approveContract(contractId, authState.user.uid, authState.user.email || '');
      toast.success("Documento approvato con successo!");
      await loadContractData();
    } catch (err: any) {
      toast.error("Errore durante l'approvazione: " + err.message);
    } finally {
      savingAction = false;
    }
  }

  async function handleApproveAndCollectFull() {
    if (!authState.user || savingAction) return;
    const confirmed = await confirmStore.prompt("Confermi l'approvazione e la contestuale registrazione dell'incasso totale?");
    if (!confirmed) return;

    savingAction = true;
    try {
      await ContractsService.approveAndCollectFull(contractId, authState.user.uid, authState.user.email || '');
      toast.success("Documento approvato e saldo incassato interamente!");
      await loadContractData();
    } catch (err: any) {
      toast.error("Errore durante l'incasso: " + err.message);
    } finally {
      savingAction = false;
    }
  }

  // --- AZIONI SCADENZARIO & RATE ---

  async function handleAddInstallment(e: Event) {
    e.preventDefault();
    if (!instDueDate || !instAmount || instAmount <= 0) {
      toast.error('Inserisci data scadenza e importo valido per la rata');
      return;
    }

    savingInst = true;
    try {
      await ContractsService.addInstallment(contractId, {
        installmentNumber: instNumber,
        dueDate: instDueDate,
        expectedAmount: instAmount,
        amount: instAmount,
        status: 'in_attesa',
        notes: instNotes.trim()
      });
      installments = await ContractsService.getInstallments(contractId);
      showInstallmentModal = false;
      instNotes = '';
      instAmount = undefined;
      instNumber = installments.length + 1;
      toast.success('Rata dello scadenzario aggiunta con successo');
    } catch (err: any) {
      toast.error('Errore aggiunta rata: ' + err.message);
    } finally {
      savingInst = false;
    }
  }

  async function handlePostponeInstallment(instId: string, currentDueDate: string) {
    if (!contract || !authState.user) return;
    const newDate = await confirmStore.askInput("Inserisci la nuova data di scadenza (AAAA-MM-GG):", currentDueDate);
    if (!newDate || newDate.trim() === currentDueDate) return;

    try {
      await ContractsService.postponeInstallment(
        contract,
        instId,
        newDate.trim(),
        { uid: authState.user.uid, email: authState.user.email || '' }
      );
      toast.success(`Scadenza rata posticipata al ${newDate}. Registrata nota a diario.`);
      installments = await ContractsService.getInstallments(contractId);
    } catch (err: any) {
      toast.error("Errore durante il posticipo della rata: " + err.message);
    }
  }

  function handleOpenCollectModal(inst: ContractInstallment) {
    selectedInstallmentId = inst.id || null;
    installmentActualAmount = inst.expectedAmount || inst.amount || 0;
    productAllocations = (contract?.items || []).map(p => ({ productId: p.productId, amount: 0 }));
    showCollectModal = true;
  }

  async function handleConfirmCollect() {
    if (!selectedInstallmentId || installmentActualAmount == null || !authState.user) return;

    try {
      await ContractsService.collectInstallment(
        contractId,
        selectedInstallmentId,
        installmentActualAmount,
        { uid: authState.user.uid, email: authState.user.email || '' },
        productAllocations
      );
      toast.success("Incasso rata registrato con successo!");
      showCollectModal = false;
      await loadContractData();
    } catch (err: any) {
      toast.error("Errore durante la registrazione dell'incasso: " + err.message);
    }
  }

  async function handleDeleteInstallment(instId: string) {
    const confirmed = await confirmStore.prompt("Sei sicuro di voler eliminare questa rata dallo scadenzario?");
    if (!confirmed) return;

    try {
      await ContractsService.deleteInstallment(contractId, instId);
      toast.success("Rata rimossa dallo scadenzario");
      installments = await ContractsService.getInstallments(contractId);
    } catch (err: any) {
      toast.error("Errore durante l'eliminazione: " + err.message);
    }
  }

  function formatDate(d: any) {
    if (!d) return 'N/D';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return String(d);
    }
  }

  function getStatusBadge(status: ContractStatus) {
    switch (status) {
      case 'approvato': case 'approved': case 'attivo': case 'accettato': 
        return { label: labels.activeTabLabel || 'Approvato', class: 'badge-success' };
      case 'in_approvazione': case 'pending': case 'inviato': 
        return { label: 'In Attesa di Approvazione', class: 'badge-warning' };
      case 'bozza': case 'draft': 
        return { label: 'Bozza', class: 'badge-neutral' };
      case 'in_scadenza': 
        return { label: labels.expiringTabLabel || 'In Scadenza', class: 'badge-warning' };
      case 'scaduto': 
        return { label: labels.expiredTabLabel || 'Scaduto', class: 'badge-danger' };
      case 'rifiutato': 
        return { label: 'Rifiutato', class: 'badge-danger' };
      case 'sospeso': 
        return { label: 'Sospeso', class: 'badge-neutral' };
      default: 
        return { label: status, class: 'badge-neutral' };
    }
  }

  function printContract() {
    window.print();
  }
</script>

<svelte:head>
  <title>{contract ? contract.title : labels.detailSingular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="contract-detail-page animate-fade-in">
  <div class="page-top-nav no-print">
    <a 
      href="/dashboard/contracts" 
      class="btn-module-list" 
      title="Vai all'elenco {labels.plural}"
      aria-label="Vai all'elenco {labels.plural}"
    >
      <List size={20} />
      <span>Elenco {labels.plural}</span>
    </a>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if !contract}
    <div class="alert error-box">
      <AlertTriangle size={18} /> {labels.singular} non trovato o eliminato.
    </div>
  {:else}
    {@const badge = getStatusBadge(contract.status)}

    <!-- HEADER MAIN -->
    <header class="detail-header card">
      <div class="header-info-col">
        <div class="header-tag">
          {labels.numberLabel}: <strong>{contract.contractNumber || 'N/D'}</strong>
          {#if contract.derived?.isNNCF || contract.isNNCF}
            <span class="nncf-pill" title="New Name in Central File (1° Ordine di questo Cliente)">
              <Sparkles size={11} /> NNCF (1° Ordine Cliente)
            </span>
          {/if}
        </div>
        <h1 class="page-title">{contract.title || `${labels.singular} - ${contract.clientName}`}</h1>
        <p class="page-subtitle">
          <User size={15} /> Cliente Intestatario: <strong>{contract.clientName || 'Cliente'}</strong>
        </p>

        {#if contract.tags && contract.tags.length > 0}
          <div class="tags-bar margin-top-8">
            {#each contract.tags as tag}
              <span class="tag-chip"><Tag size={12} /> #{tag}</span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="header-actions no-print">
        <button type="button" class="btn btn-secondary" onclick={printContract}>
          <Printer size={16} /> Stampa / PDF
        </button>
        <a href={NavigationService.preserveParams(`/dashboard/contracts/${contractId}/edit`, $page.url.searchParams)} class="btn btn-secondary">
          <Edit size={16} /> {labels.editSingular}
        </a>

        <!-- AZIONI AMMINISTRAZIONE -->
        {#if isAdmin && isPendingApproval}
          <button 
            type="button" 
            class="btn btn-success" 
            onclick={handleApproveContract}
            disabled={savingAction}
          >
            <CheckCircle size={16} /> Approva {labels.singular}
          </button>
          <button 
            type="button" 
            class="btn btn-primary" 
            onclick={handleApproveAndCollectFull}
            disabled={savingAction}
          >
            <Euro size={16} /> Approva & Incassa Saldo
          </button>
        {/if}
      </div>
    </header>

    <!-- TABELLA PRODOTTI E SERVIZI INCLUSI -->
    {#if contract.items && contract.items.length > 0}
      <Card title="Articoli & Servizi Inclusi nella Quotazione" description="Dettaglio analitico delle licenze e dei prodotti inseriti in sede di quotazione.">
        {#snippet icon()}
          <ShoppingBag size={20} class="icon-accent" />
        {/snippet}

        <div class="table-wrapper">
          <table class="data-table widescreen-table">
            <thead>
              <tr>
                <th>Prodotto / Servizio</th>
                <th>Descrizione</th>
                <th>Quantità</th>
                <th>Prezzo Listino</th>
                <th>Prezzo Venduto</th>
                <th class="text-right">Subtotale (€)</th>
                <th>Soglia Prezzo</th>
              </tr>
            </thead>
            <tbody>
              {#each contract.items as item}
                {@const isBelowMin = item.minPrice && item.priceSold < item.minPrice}
                <tr class:row-warning={isBelowMin} class:row-optional={item.isOptional}>
                  <td>
                    <strong>{item.productName}</strong>
                    {#if item.isOptional}
                      <span class="badge-optional">Opzionale</span>
                    {/if}
                  </td>
                  <td class="cell-desc">{item.description || '-'}</td>
                  <td>{item.quantity} {item.unit || ''}</td>
                  <td>€ {(Number(item.listPrice) || 0).toFixed(2)}</td>
                  <td>
                    <strong class:text-warning={isBelowMin}>
                      € {(Number(item.priceSold) || 0).toFixed(2)}
                    </strong>
                  </td>
                  <td class="text-right font-bold">
                    € {(Number(item.subtotal) || 0).toFixed(2)}
                    {#if item.minimoFatturabileText}
                      <div class="minimo-info-note"><Info size={12} /> {item.minimoFatturabileText}</div>
                    {/if}
                  </td>
                  <td>
                    {#if isBelowMin}
                      <span class="under-min-badge" title="Prezzo sotto la soglia minima di listino">
                        <ShieldAlert size={12} /> SOTTO SOGLIA (Min €{(Number(item.minPrice) || 0).toFixed(2)})
                      </span>
                    {:else}
                      <span class="regular-price-badge">Conforme</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- SUMMARY RIEPILOGO TOTALE -->
        <div class="totals-summary-card margin-top-16">
          {#if contract.taxableAmount != null && contract.discountAmount}
            <div class="totals-row">
              <span class="t-label">Imponibile Lordo:</span>
              <span class="t-val">€ {(Number(contract.taxableAmount) || 0).toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span class="t-label">Sconto Applicato:</span>
              <span class="t-val text-danger">- € {(Number(contract.discountAmount) || 0).toFixed(2)}</span>
            </div>
          {/if}

          <div class="totals-row grand-total-row">
            <span class="t-label-grand">TOTALE COMPLESSIVO:</span>
            <span class="t-val-grand">€ {(contract.totalAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>
    {/if}

    <!-- CO-SELLING & AGENT SPLIT CARD (Se applicabile) -->
    {#if contract.coSellerUid || contract.agentName}
      <Card title="Ripartizione Commerciale & Co-Selling" description="Dettaglio dei consulenti responsabili della vendita e della ripartizione provvigionale.">
        {#snippet icon()}
          <Users size={20} class="icon-accent" />
        {/snippet}

        <div class="co-selling-grid">
          <div class="co-seller-box">
            <span class="co-role-label">Consulente Principale</span>
            <strong class="co-name">{contract.agentName || contract.agentId || 'Agente'}</strong>
            <span class="co-share-badge">
              Quota: {100 - (contract.coSellerShare || 0)}%
            </span>
          </div>

          {#if contract.coSellerUid}
            <div class="co-seller-box second-vendor">
              <span class="co-role-label">Co-Venditore (Co-Selling)</span>
              <strong class="co-name">{contract.coSellerEmail || contract.coSellerName || contract.coSellerUid}</strong>
              <span class="co-share-badge share-secondary">
                Quota: {contract.coSellerShare}%
              </span>
            </div>
          {/if}
        </div>
      </Card>
    {/if}

    <!-- GRID INFO GENERALI & SCADENZARIO -->
    <div class="info-grid">
      <!-- SUMMARY CARD -->
      <div class="card info-card">
        <h3 class="card-title">
          <Info size={18} class="icon-accent" /> Informazioni Generali
        </h3>
        
        <div class="info-row">
          <span class="info-label">Stato {labels.singular}</span>
          <span class="badge {badge.class}">{badge.label}</span>
        </div>

        <div class="info-row">
          <span class="info-label">{labels.typeLabel}</span>
          <span class="info-val">{contract.type}</span>
        </div>

        {#if contract.agentName}
          <div class="info-row">
            <span class="info-label"><UserCheck size={14} /> Agente / Commerciale</span>
            <span class="info-val">{contract.agentName}</span>
          </div>
        {/if}

        {#if contract.projectName || contract.projectId}
          <div class="info-row">
            <span class="info-label"><FolderKanban size={14} /> {projectLabel} Correlato</span>
            {#if contract.projectId}
              <a href="/dashboard/projects/{contract.projectId}" class="project-link-badge" title="Apri {projectLabel}">
                <span>{contract.projectName || contract.projectId}</span>
                <ExternalLink size={12} />
              </a>
            {:else}
              <span class="info-val">{contract.projectName}</span>
            {/if}
          </div>
        {/if}

        {#if contract.placeName || contract.placeId}
          <div class="info-row">
            <span class="info-label"><MapPin size={14} /> Cantiere / Luogo Correlato</span>
            {#if contract.placeId}
              <a href="/dashboard/places/{contract.placeId}" class="project-link-badge" title="Apri Cantiere / Luogo">
                <span>{contract.placeName || contract.placeId}</span>
                <ExternalLink size={12} />
              </a>
            {:else}
              <span class="info-val">{contract.placeName}</span>
            {/if}
          </div>
        {/if}

        <div class="info-row">
          <span class="info-label">{labels.totalValueLabel}</span>
          <span class="info-val font-bold">€ {(contract.totalAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Data Inizio / Decorrenza</span>
          <span class="info-val">{formatDate(contract.startDate)}</span>
        </div>

        {#if contract.endDate}
          <div class="info-row">
            <span class="info-label">Data Scadenza</span>
            <span class="info-val">{formatDate(contract.endDate)}</span>
          </div>
        {/if}

        {#if contract.clientNotes}
          <div class="notes-box">
            <strong>Note Visibili al Cliente:</strong>
            <p>{contract.clientNotes}</p>
          </div>
        {/if}

        {#if contract.adminNotes || contract.notes}
          <div class="notes-box admin-notes">
            <strong>Note Riservate (Amministrazione):</strong>
            <p>{contract.adminNotes || contract.notes}</p>
          </div>
        {/if}
      </div>

      <!-- INSTALLMENTS CARD CON ALLERTA SOLLECITI -->
      <div class="card info-card" id="scadenziario-pagamenti">
        <div class="card-header-flex">
          <h3 class="card-title">
            <Euro size={18} class="icon-accent" /> Scadenzario Pagamenti & Rate ({installments.length})
          </h3>
          {#if isAdmin}
            <button type="button" class="btn-small-primary no-print" onclick={() => showInstallmentModal = true}>
              <Plus size={14} /> Nuova Rata
            </button>
          {/if}
        </div>

        {#if installments.length === 0}
          <div class="empty-subtext">Nessuna rata ancora pianificata nello scadenzario di questo documento.</div>
        {:else}
          <div class="table-wrapper">
            <table class="widescreen-table installments-table">
              <thead>
                <tr>
                  <th>Scadenza</th>
                  <th>Importo Dovuto</th>
                  <th>Stato</th>
                  <th>Incassato</th>
                  {#if isAdmin}
                    <th class="no-print text-right">Azioni</th>
                  {/if}
                </tr>
              </thead>
              <tbody>
                {#each installments as inst}
                  {@const isOverdue = inst.status !== 'pagato' && inst.status !== 'paid' && new Date(inst.dueDate) < new Date()}
                  <tr class:is-overdue={isOverdue}>
                    <td>
                      <span class="due-date-text" class:overdue-text={isOverdue}>
                        {formatDate(inst.dueDate)}
                      </span>
                      {#if isOverdue}
                        <span class="overdue-warning">
                          <AlertTriangle size={12} /> SOLLECITARE CLIENTE!
                        </span>
                      {/if}
                    </td>
                    <td><strong>€ {(Number(inst.expectedAmount) || 0).toFixed(2)}</strong></td>
                    <td>
                      <StatusBadge status={inst.status === 'pagato' || inst.status === 'paid' ? 'pagato' : (isOverdue ? 'scaduto' : 'in_attesa')} />
                    </td>
                    <td>
                      {#if inst.status === 'pagato' || inst.status === 'paid'}
                        <span class="paid-amount-label">
                          € {(Number(inst.paidAmount) || 0).toFixed(2)} ({formatDate(inst.paidAt)})
                        </span>
                      {:else}
                        <span class="text-muted">-</span>
                      {/if}
                    </td>
                    {#if isAdmin}
                      <td class="no-print text-right">
                        {#if inst.status !== 'pagato' && inst.status !== 'paid'}
                          <div class="action-buttons-group">
                            <button 
                              type="button"
                              class="btn-action-sm" 
                              title="Posticipa data scadenza e registra sollecito a diario"
                              onclick={() => handlePostponeInstallment(inst.id!, inst.dueDate)}
                            >
                              Posticipa
                            </button>
                            <button 
                              type="button"
                              class="btn-action-sm btn-collect" 
                              title="Segna incasso rata con scorpora IVA"
                              onclick={() => handleOpenCollectModal(inst)}
                            >
                              Segna Incassato
                            </button>
                            <button 
                              type="button"
                              class="btn-action-sm btn-danger" 
                              title="Elimina rata"
                              onclick={() => handleDeleteInstallment(inst.id!)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        {:else}
                          <span class="success-status-label">
                            <CheckCircle size={12} /> Incassato
                          </span>
                        {/if}
                      </td>
                    {/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && contract.customFields}
      <div class="card form-card">
        <h3 class="card-title">
          <Puzzle size={18} class="icon-accent" /> Campi Personalizzati
        </h3>
        <CustomFieldsRenderer fields={customFieldsList} values={contract.customFields} readonly={true} />
      </div>
    {/if}

    <!-- MODALE NUOVA RATA INTERMEDIA -->
    {#if showInstallmentModal}
      <div class="modal-backdrop" onclick={() => showInstallmentModal = false} role="presentation">
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="presentation">
          <div class="modal-header">
            <h3>+ Nuova Rata Scadenzario</h3>
            <button type="button" class="btn-close" onclick={() => showInstallmentModal = false}>
              <X size={18} />
            </button>
          </div>

          <form onsubmit={handleAddInstallment} class="modal-body">
            <div class="form-group">
              <label for="instNum">Numero Rata</label>
              <input type="number" id="instNum" bind:value={instNumber} min="1" required class="form-control" />
            </div>

            <div class="form-group">
              <label for="instDate">Data Scadenza *</label>
              <input type="date" id="instDate" bind:value={instDueDate} required class="form-control" />
            </div>

            <div class="form-group">
              <label for="instAmt">Importo Dovuto (€) *</label>
              <input type="number" id="instAmt" bind:value={instAmount} min="0.01" step="any" placeholder="0.00" required class="form-control" />
            </div>

            <div class="form-group">
              <label for="instNotes">Note (opzionale)</label>
              <input type="text" id="instNotes" bind:value={instNotes} placeholder="es. Acconto all'ordine..." class="form-control" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick={() => showInstallmentModal = false}>Annulla</button>
              <button type="submit" class="btn btn-primary" disabled={savingInst}>
                {#if savingInst}Salvataggio...{:else}Salva Rata{/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    <!-- MODALE INCASSO RATA CON SCORPORA IVA -->
    {#if showCollectModal}
      <ContractInstallmentModal
        bind:installmentActualAmount={installmentActualAmount}
        productsStatus={productsStatus}
        bind:productAllocations={productAllocations}
        selectedInstallmentId={selectedInstallmentId}
        onClose={() => showCollectModal = false}
        onCollect={handleConfirmCollect}
      />
    {/if}
  {/if}
</div>

<style>
  .contract-detail-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-sizing: border-box;
  }

  .page-top-nav {
    display: flex;
    justify-content: flex-start;
  }

  .btn-module-list {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: white;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    color: var(--color-neutral-700, #334155);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-module-list:hover {
    background: var(--color-neutral-100, #f1f5f9);
    color: var(--color-neutral-900, #0f172a);
  }

  .detail-header {
    background: white;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
  }

  .header-tag {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-500, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nncf-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(234, 88, 12, 0.12);
    color: #c2410c;
    border: 1px solid rgba(249, 115, 22, 0.3);
    letter-spacing: 0.02em;
    text-transform: none;
  }

  .page-title {
    margin: 4px 0 6px 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
  }

  .page-subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--color-neutral-600, #475569);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: var(--radius-md, 8px);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-secondary {
    background: white;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    color: var(--color-neutral-700, #334155);
  }
  .btn-secondary:hover {
    background: var(--color-neutral-100, #f1f5f9);
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: white;
  }
  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  .btn-success {
    background: var(--color-success, #16a34a);
    color: white;
  }
  .btn-success:hover {
    background: #15803d;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .widescreen-table th {
    background: var(--color-neutral-50, #f8fafc);
    padding: 12px 14px;
    text-align: left;
    font-weight: 600;
    color: var(--color-neutral-600, #475569);
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
  }

  .widescreen-table td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
    color: var(--color-neutral-800, #1e293b);
  }

  .is-overdue {
    background-color: #fff1f2 !important;
    border-left: 4px solid var(--color-error, #dc2626);
  }

  .overdue-text {
    color: var(--color-error, #dc2626);
    font-weight: 700;
  }

  .overdue-warning {
    display: block;
    font-size: 11px;
    font-weight: 800;
    color: var(--color-error, #dc2626);
    margin-top: 2px;
  }

  .under-min-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
  }

  .regular-price-badge {
    font-size: 11px;
    color: var(--color-neutral-500, #64748b);
  }

  .co-selling-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .co-seller-box {
    background: var(--color-neutral-50, #f8fafc);
    padding: 16px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .co-role-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--color-neutral-500, #64748b);
  }

  .co-name {
    font-size: 15px;
    color: var(--color-neutral-900, #0f172a);
  }

  .co-share-badge {
    display: inline-block;
    width: fit-content;
    padding: 2px 8px;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 12px;
    font-weight: 700;
    border-radius: 4px;
  }

  .share-secondary {
    background: #fef3c7;
    color: #b45309;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1.3fr;
    gap: 20px;
  }

  .info-card {
    background: white;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 24px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
  }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .card-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-neutral-100, #f1f5f9);
    font-size: 13.5px;
  }

  .info-label {
    color: var(--color-neutral-500, #64748b);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-small-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .action-buttons-group {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .btn-action-sm {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    background: white;
    cursor: pointer;
  }
  .btn-action-sm:hover { background: var(--color-neutral-100, #f1f5f9); }

  .btn-collect {
    background: #f0fdf4;
    color: #166534;
    border-color: #bbf7d0;
  }
  .btn-collect:hover { background: #dcfce7; }

  .btn-danger {
    color: var(--color-error, #dc2626);
    border-color: #fecaca;
  }
  .btn-danger:hover { background: #fef2f2; }

  .success-status-label {
    color: var(--color-success, #16a34a);
    font-weight: 700;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .totals-summary-card {
    background: var(--color-neutral-50, #f8fafc);
    border-radius: var(--radius-md, 8px);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .grand-total-row {
    font-size: 18px;
    font-weight: 800;
    color: var(--color-neutral-900, #0f172a);
    border-top: 2px solid var(--color-neutral-300, #cbd5e1);
    padding-top: 8px;
    width: 100%;
    display: flex;
    justify-content: space-between;
  }

  .notes-box {
    margin-top: 14px;
    padding: 12px;
    background: var(--color-neutral-50, #f8fafc);
    border-radius: 6px;
    font-size: 13px;
  }

  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: white;
    padding: 24px;
    border-radius: var(--radius-lg, 12px);
    width: 100%;
    max-width: 440px;
    box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .modal-header h3 { margin: 0; font-size: 17px; font-weight: 700; }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--color-neutral-500); }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }
  .form-control {
    padding: 8px 12px;
    font-size: 14px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  .icon-accent { color: var(--color-primary-600, #2563eb); }
  .text-right { text-align: right; }
  .text-danger { color: #dc2626; }
  .text-warning { color: #d97706; }
  .text-muted { color: #94a3b8; }
  .font-bold { font-weight: 700; }
  .margin-top-16 { margin-top: 16px; }

  @media (max-width: 900px) {
    .info-grid { grid-template-columns: 1fr; }
    .co-selling-grid { grid-template-columns: 1fr; }
  }

  @media print {
    .no-print { display: none !important; }
    .contract-detail-page { padding: 0; }
    .detail-header { box-shadow: none; border: none; padding: 0; margin-bottom: 20px; }
  }
</style>
