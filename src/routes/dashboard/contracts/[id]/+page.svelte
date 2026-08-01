<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { ContractsService } from '../contracts.service';
  import { ContractSettingsService } from '../contractSettingsService';
  import type { ContractItem, ContractInstallment, ContractStatus, ContractSettings } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { Card } from '$lib';
  import { 
    ArrowLeft, 
    Printer, 
    Edit, 
    Info, 
    Euro, 
    Puzzle, 
    X, 
    User, 
    Plus,
    AlertTriangle,
    ShoppingBag
  } from '@lucide/svelte';

  const contractId = page.params.id || '';

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true
  });
  let labels = $derived(ContractSettingsService.getLabels(settings));

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
      case 'attivo': return { label: labels.activeTabLabel, class: 'badge-success' };
      case 'in_scadenza': return { label: labels.expiringTabLabel, class: 'badge-warning' };
      case 'scaduto': return { label: labels.expiredTabLabel, class: 'badge-danger' };
      case 'sospeso': return { label: 'Sospeso', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }

  function printContract() {
    window.print();
  }
</script>

<svelte:head>
  <title>{contract ? contract.title : labels.detailSingular} | Gestoray</title>
</svelte:head>

<div class="contract-detail-page animate-fade-in">
  <a href="/dashboard/contracts" class="back-link">
    <ArrowLeft size={16} /> Torna alla Gestione {labels.plural}
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
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printContract}>
          <Printer size={16} /> Stampa
        </button>
        <a href="/dashboard/contracts/{contractId}/edit" class="btn btn-secondary">
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
                <th>P. Listino (€)</th>
                <th>P. Venduto (€)</th>
                <th>Qtà</th>
                <th>Subtotale (€)</th>
              </tr>
            </thead>
            <tbody>
              {#each contract.items as item}
                <tr>
                  <td>
                    <strong>{item.productName}</strong>
                    {#if item.notes}<div class="sub-text">{item.notes}</div>{/if}
                  </td>
                  <td>€ {item.listPrice.toFixed(2)}</td>
                  <td class="font-bold">€ {item.priceSold.toFixed(2)}</td>
                  <td>{item.quantity} {item.unit || ''}</td>
                  <td class="font-bold">€ {item.subtotal.toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
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

        <div class="info-row">
          <span class="info-label">Frequenza Fatturazione</span>
          <span class="info-val capitalize">{contract.billingFrequency}</span>
        </div>

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

        {#if contract.notes}
          <div class="notes-box">
            <strong>Note Riservate:</strong>
            <p>{contract.notes}</p>
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
              <input type="number" id="instAmt" bind:value={instAmount} step="0.01" min="0.01" required />
            </div>

            <div class="form-group">
              <label for="instN">Note</label>
              <input type="text" id="instN" bind:value={instNotes} placeholder="es. Rata 1 di 4..." />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick={() => showInstallmentModal = false}>Annulla</button>
              <button type="submit" class="btn btn-primary" disabled={savingInst}>
                {savingInst ? 'Salvataggio...' : 'Salva Rata'}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .contract-detail-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-600, #4b5563);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
  }

  .detail-header {
    background: white;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-tag {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
    text-transform: uppercase;
    letter-spacing: 0.05em;

  }

  .page-title {
    font-size: 22px;
    font-weight: 800;
    margin: 4px 0;
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-actions {
    display: flex;
    gap: 10px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
    border: none;
  }

  .btn-secondary {
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-800, #1f2937);
    border: 1px solid var(--color-neutral-300, #d1d5db);
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: white;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .info-card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
  }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .btn-small-primary {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-neutral-100, #f3f4f6);
    font-size: 14px;
  }

  .info-label {
    color: var(--color-neutral-500, #6b7280);
  }

  .info-val {
    font-weight: 600;
  }

  .notes-box {
    margin-top: 16px;
    padding: 12px;
    background: var(--color-neutral-50, #f9fafb);
    border-radius: 8px;
    font-size: 13px;
  }

  .notes-box p {
    margin: 4px 0 0 0;
    color: var(--color-neutral-700, #374151);
  }

  .installments-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .installment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--color-neutral-50, #f9fafb);
    border-radius: 8px;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
  }

  .inst-num { font-weight: 700; display: block; font-size: 13px; }
  .inst-date { font-size: 12px; color: var(--color-neutral-500, #6b7280); }
  .inst-amount { font-weight: 800; font-size: 15px; color: var(--color-neutral-900, #111827); }

  .table-wrapper { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table th { background: var(--color-neutral-50, #f9fafb); padding: 10px 12px; text-align: left; font-weight: 600; color: var(--color-neutral-500, #6b7280); }
  .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-neutral-200, #e5e7eb); }

  .badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f3f4f6; color: #4b5563; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal-card { background: white; border-radius: 12px; width: 100%; max-width: 440px; padding: 20px; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--color-neutral-500); }
  .modal-body { display: flex; flex-direction: column; gap: 12px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }

  .form-group { display: flex; flex-direction: column; gap: 4px; }
  .form-group label { font-size: 12px; font-weight: 600; }
  .form-group input { padding: 8px 10px; border: 1px solid var(--color-neutral-300); border-radius: 6px; }

  .empty-subtext { font-size: 13px; color: var(--color-neutral-500); font-style: italic; }
  .sub-text { font-size: 12px; color: var(--color-neutral-500); }
  .font-bold { font-weight: 700; }
  .capitalize { text-transform: capitalize; }
  .loader-box { padding: 40px; text-align: center; }
</style>
