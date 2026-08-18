<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { ContractsService } from '../contracts.service';
  import { ContractSettingsService } from '../contractSettingsService';
  import type { ContractItem, ContractInstallment, ContractStatus, ContractSettings } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { Card } from '$lib';
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
    Building2,
    FolderKanban,
    MapPin,
    ExternalLink,
    Receipt
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

  let showInstallmentModal = $state(false);
  let instNumber = $state(1);
  let instDueDate = $state(new Date().toISOString().slice(0, 10));
  let instAmount = $state<number | undefined>(undefined);
  let instNotes = $state('');
  let savingInst = $state(false);

  onMount(async () => {
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
      console.error('Errore caricamento dettaglio:', e);
      toast.error(`Impossibile caricare i dati del ${labels.singular.toLowerCase()}`);
    } finally {
      loading = false;
    }
  });

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

  function getStatusBadge(status: ContractStatus) {
    switch (status) {
      case 'attivo': case 'accettato': return { label: labels.activeTabLabel, class: 'badge-success' };
      case 'inviato': return { label: 'Inviato al Cliente', class: 'badge-info' };
      case 'bozza': return { label: 'Bozza', class: 'badge-neutral' };
      case 'in_scadenza': return { label: labels.expiringTabLabel, class: 'badge-warning' };
      case 'scaduto': return { label: labels.expiredTabLabel, class: 'badge-danger' };
      case 'rifiutato': return { label: 'Rifiutato', class: 'badge-danger' };
      case 'sospeso': return { label: 'Sospeso', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
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
  <a 
    href="/dashboard/contracts" 
    class="btn-module-list" 
    title="Vai all'elenco {labels.plural}"
    aria-label="Vai all'elenco {labels.plural}"
  >
    <List size={20} />
  </a>

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
      <div>
        <div class="header-tag">{labels.numberLabel}: {contract.contractNumber}</div>
        <h1 class="page-title">{contract.title || `${labels.singular} - ${contract.clientName}`}</h1>
        <p class="page-subtitle">
          <User size={14} /> Cliente Intestatario: <strong>{contract.clientName}</strong>
        </p>

        {#if contract.tags && contract.tags.length > 0}
          <div class="tags-bar margin-top-8">
            {#each contract.tags as tag}
              <span class="tag-chip"><Tag size={12} /> #{tag}</span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printContract}>
          <Printer size={16} /> Stampa
        </button>
        <a href={NavigationService.preserveParams(`/dashboard/contracts/${contractId}/edit`, $page.url.searchParams)} class="btn btn-secondary">
          <Edit size={16} /> {labels.editSingular}
        </a>
      </div>
    </header>

    <!-- TABELLA PRODOTTI E SERVIZI INCLUSI -->
    {#if contract.items && contract.items.length > 0}
      <Card title="Articoli & Servizi Inclusi nella Quotazione" description="Dettaglio analitico delle licenze e dei prodotti inseriti in sede di quotazione.">
        {#snippet icon()}
          <ShoppingBag size={20} color="var(--color-primary-600)" />
        {/snippet}

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Prodotto / Servizio</th>
                <th>Descrizione Dettagliata</th>
                <th>Qtà & Unità</th>
                <th>Prezzo Unt. (€)</th>
                <th class="text-right">Subtotale (€)</th>
              </tr>
            </thead>
            <tbody>
              {#each contract.items as item}
                <tr class:row-optional={item.isOptional}>
                  <td>
                    <strong>{item.productName}</strong>
                    {#if item.isOptional}
                      <span class="badge-optional">Opzionale</span>
                    {/if}
                  </td>
                  <td class="cell-desc">{item.description || '-'}</td>
                  <td>{item.quantity} {item.unit || ''}</td>
                  <td>€ {item.priceSold?.toFixed(2)}</td>
                  <td class="text-right font-bold">
                    € {item.subtotal?.toFixed(2)}
                    {#if item.minimoFatturabileText}
                      <div class="minimo-info-note"><Info size={12} /> {item.minimoFatturabileText}</div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- SUMMARY RIEPILOGO TOTALE -->
        <div class="totals-summary-card margin-top-16">
          {#if contract.taxableAmount != null}
            <div class="totals-row">
              <span class="t-label">Imponibile Parziale:</span>
              <span class="t-val">€ {contract.taxableAmount.toFixed(2)}</span>
            </div>
          {/if}

          {#if contract.discountAmount && contract.discountAmount > 0}
            <div class="totals-row">
              <span class="t-label">Sconto Documento ({contract.discountType === 'percent' ? `${contract.discountValue}%` : '€'}):</span>
              <span class="t-val text-danger">- € {contract.discountAmount.toFixed(2)}</span>
            </div>
          {/if}

          <div class="totals-row grand-total-row">
            <span class="t-label-grand">TOTALE COMPLESSIVO:</span>
            <span class="t-val-grand">€ {(contract.totalAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>
    {/if}

    <!-- GRID INFO -->
    <div class="info-grid">
      <!-- SUMMARY CARD -->
      <div class="card info-card">
        <h3 class="card-title">
          <Info size={18} color="var(--color-primary-600)" /> Informazioni Generali
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
          <span class="info-val">{contract.startDate || 'N.D.'}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Data Scadenza</span>
          <span class="info-val">{contract.endDate || 'N.D.'}</span>
        </div>

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

        {#if contract.termsAndConditions}
          <div class="notes-box terms-box">
            <strong>Termini & Condizioni Contrattuali:</strong>
            <p>{contract.termsAndConditions}</p>
          </div>
        {/if}
      </div>

      <!-- INSTALLMENTS CARD -->
      <div class="card info-card">
        <div class="card-header-flex">
          <h3 class="card-title">
            <Euro size={18} color="var(--color-primary-600)" /> Scadenzario & Rateizzazioni ({installments.length})
          </h3>
          <button type="button" class="btn-small-primary" onclick={() => showInstallmentModal = true}>
            <Plus size={14} /> Aggiungi Rata
          </button>
        </div>

        {#if installments.length === 0}
          <div class="empty-subtext">Nessuna rata ancora registrata nello scadenzario di questo {labels.singular.toLowerCase()}.</div>
        {:else}
          <div class="installments-list">
            {#each installments as inst}
              <div class="installment-item">
                <div class="inst-info">
                  <span class="inst-num">Rata #{inst.installmentNumber}</span>
                  <span class="inst-date">Scadenza: {inst.dueDate}</span>
                </div>
                <div class="inst-amount">
                  € {inst.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && contract.customFields}
      <div class="card form-card">
        <h3 class="card-title">
          <Puzzle size={18} color="var(--color-primary-600)" /> Campi Personalizzati
        </h3>
        <CustomFieldsRenderer fields={customFieldsList} values={contract.customFields} readonly={true} />
      </div>
    {/if}

    <!-- MODALE NUOVA RATA -->
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
              <input type="number" id="instNum" bind:value={instNumber} min="1" required />
            </div>

            <div class="form-group">
              <label for="instDate">Data Scadenza *</label>
              <input type="date" id="instDate" bind:value={instDueDate} required />
            </div>

            <div class="form-group">
              <label for="instAmt">Importo (€) *</label>
              <input type="number" id="instAmt" bind:value={instAmount} min="0.01" step="any" placeholder="0.00" required />
            </div>

            <div class="form-group">
              <label for="instNotes">Note (opzionale)</label>
              <input type="text" id="instNotes" bind:value={instNotes} placeholder="es. Acconto 30% all'ordine..." />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-neutral" onclick={() => showInstallmentModal = false}>Annulla</button>
              <button type="submit" class="btn-primary" disabled={savingInst}>
                {#if savingInst}Salvataggio...{:else}Salva Rata{/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  :global(.project-link-badge) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 9999px;
    background-color: #e0e7ff;
    color: #3730a3;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  :global(.project-link-badge:hover) {
    background-color: #c7d2fe;
    color: #1e1b4b;
    transform: translateY(-1px);
  }

  .contract-detail-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #ffffff;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    color: var(--text-heading, #1e293b);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    margin-bottom: 1rem;
    width: fit-content;
  }
  .back-link:hover {
    background: var(--bg-subtle, #f8fafc);
    border-color: var(--color-primary, #2563eb);
    color: var(--color-primary, #2563eb);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #ffffff;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    color: var(--text-main, #334155);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .btn-secondary:hover {
    background: var(--bg-subtle, #f8fafc);
    border-color: var(--color-primary, #2563eb);
    color: var(--color-primary, #2563eb);
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
  }

  .detail-header {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-tag {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-primary, #2563eb);
    letter-spacing: 0.05em;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    margin: 0.25rem 0;
    color: var(--text-heading, #0f172a);
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .tags-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--bg-subtle, #f1f5f9);
    color: var(--color-primary, #2563eb);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .info-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-heading, #0f172a);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
  }

  .info-label {
    color: var(--text-muted, #64748b);
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .info-val {
    font-weight: 600;
    color: var(--text-heading, #0f172a);
  }

  .table-wrapper {
    overflow-x: auto;
    margin-top: 1rem;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    background: var(--bg-subtle, #f8fafc);
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-heading, #0f172a);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
    vertical-align: top;
  }

  .cell-desc {
    max-width: 260px;
    font-size: 0.8125rem;
    color: var(--text-muted, #64748b);
  }

  .row-optional {
    opacity: 0.65;
    background: #fcfcfc;
  }

  .badge-optional {
    font-size: 0.7rem;
    background: #fef3c7;
    color: #b45309;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    margin-left: 0.35rem;
  }

  .minimo-info-note {
    font-size: 0.75rem;
    color: #d97706;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    justify-content: flex-end;
  }

  .totals-summary-card {
    background: var(--bg-subtle, #f8fafc);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 420px;
    margin-left: auto;
  }

  .totals-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
    color: var(--text-main, #334155);
  }

  .grand-total-row {
    border-top: 2px solid var(--border-color, #cbd5e1);
    padding-top: 0.75rem;
    margin-top: 0.25rem;
  }

  .t-label-grand {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-heading, #0f172a);
  }

  .t-val-grand {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-primary, #2563eb);
  }

  .notes-box {
    background: var(--bg-subtle, #f8fafc);
    border-left: 3px solid var(--color-primary, #2563eb);
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }

  .admin-notes {
    border-left-color: #f59e0b;
  }

  .terms-box {
    border-left-color: #64748b;
    font-size: 0.8125rem;
  }

  .notes-box p { margin: 0.25rem 0 0 0; color: var(--text-main, #334155); }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-small-primary {
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .installments-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .installment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 0.875rem;
    background: var(--bg-subtle, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
  }

  .inst-info {
    display: flex;
    flex-direction: column;
  }
  .inst-num { font-weight: 600; font-size: 0.875rem; }
  .inst-date { font-size: 0.75rem; color: var(--text-muted, #64748b); }
  .inst-amount { font-weight: 700; color: var(--color-primary, #2563eb); }

  .empty-subtext {
    font-size: 0.84rem;
    color: var(--text-muted, #64748b);
    font-style: italic;
  }

  /* MODAL */
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-card {
    background: var(--bg-surface, #ffffff);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    padding: 1.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
  }
  .modal-header h3 { margin: 0; font-size: 1.125rem; font-weight: 700; }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--text-muted, #64748b); }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label { font-size: 0.8125rem; font-weight: 600; }
  .form-group input {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-color, #cbd5e1);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-neutral {
    background: var(--bg-subtle, #f1f5f9);
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-main, #334155);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    text-decoration: none;
  }

  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f1f5f9; color: #475569; }
  .text-danger { color: #dc2626; }
  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  .margin-top-8 { margin-top: 0.5rem; }
  .margin-top-16 { margin-top: 1rem; }
</style>
