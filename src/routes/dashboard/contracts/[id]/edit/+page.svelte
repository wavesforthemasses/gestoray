<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ContractsService } from '../../contracts.service';
  import type { ContractItem, ContractType, RecurringFrequency, ContractStatus } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let contractId = $derived(page.params.id);
  let contract = $state<ContractItem | null>(null);

  let clients = $state<{ id: string; name: string }[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let contractNumber = $state('');
  let title = $state('');
  let clientId = $state('');
  let type = $state<ContractType>('Canone Ricorrente');
  let totalAmount = $state<number>(1200);
  let billingFrequency = $state<RecurringFrequency>('mensile');
  let startDate = $state('');
  let endDate = $state('');
  let status = $state<ContractStatus>('attivo');
  let notes = $state('');

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('contracts');
      clients = await CacheLookupService.getLookup('clients');

      if (contractId) {
        contract = await ContractsService.getContractById(contractId);
        if (contract) {
          contractNumber = contract.contractNumber || '';
          title = contract.title || '';
          clientId = contract.clientId || '';
          type = contract.type || 'Canone Ricorrente';
          totalAmount = contract.totalAmount || 0;
          billingFrequency = contract.billingFrequency || 'mensile';
          startDate = contract.startDate || '';
          endDate = contract.endDate || '';
          status = contract.status || 'attivo';
          notes = contract.notes || '';
          customFieldsValues = contract.customFields ? { ...contract.customFields } : {};
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati modifica contratto:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!contractId || !title.trim() || !clientId) {
      errorMsg = 'Compila tutti i campi obbligatori (Titolo e Cliente).';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedClient = clients.find(c => c.id === clientId);

      await ContractsService.updateContract(contractId, {
        contractNumber: contractNumber.trim(),
        title: title.trim(),
        clientId,
        clientName: selectedClient ? selectedClient.name : (contract?.clientName || ''),
        type,
        totalAmount,
        billingFrequency,
        startDate,
        endDate,
        status,
        notes: notes.trim(),
        customFields: customFieldsValues
      });

      toast.success('Contratto aggiornato con successo!');
      goto(`/dashboard/contracts/${contractId}`);
    } catch (err: any) {
      console.error('Errore salvataggio contratto:', err);
      errorMsg = err.message || 'Errore durante l\'aggiornamento del contratto.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Contratto | Gestoray</title>
</svelte:head>

<div class="add-contract-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/contracts/{contractId}" class="back-link">← Torna al Dettaglio Contratto</a>
    <h2>✏️ Modifica Contratto Aziendale</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if !contract}
    <div class="alert error-box">⚠️ Contratto non trovato o eliminato.</div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">⚠️ {errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="contract-form">
      <!-- 1. CLIENTE E RIFERIMENTI -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">👤 Cliente & Riferimenti</h3>
          <p class="card-subtitle">Seleziona il cliente intestatario del contratto.</p>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="contract-num">N° Contratto *</label>
            <input id="contract-num" type="text" bind:value={contractNumber} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="client-select">Cliente *</label>
            <Autocomplete 
              options={clients.map(c => ({ id: c.id, label: c.name }))} 
              bind:value={clientId} 
              placeholder="🔍 Cerca cliente..."
            />
          </div>
        </div>
      </div>

      <!-- 2. DETTAGLI CONTRATTO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">ℹ️ Dettagli del Contratto</h3>
          <p class="card-subtitle">Oggetto del contratto, tipologia, importo e periodo di validità.</p>
        </div>

        <div class="form-group mb-16">
          <label for="contract-title">Titolo / Oggetto del Contratto *</label>
          <input 
            id="contract-title" 
            type="text" 
            bind:value={title} 
            placeholder="es. Canone Manutenzione Annuale Impianti Tecnologici" 
            required 
            class="form-control" 
          />
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="contract-type">Tipologia Contratto</label>
            <select id="contract-type" bind:value={type} class="form-control">
              <option value="Canone Ricorrente">Canone Ricorrente</option>
              <option value="Monte Ore">Monte Ore / Assistenza</option>
              <option value="SLA Garantito">SLA Garantito</option>
              <option value="Licenza / Abbonamento">Licenza / Abbonamento</option>
            </select>
          </div>

          <div class="form-group">
            <label for="contract-freq">Frequenza Fatturazione</label>
            <select id="contract-freq" bind:value={billingFrequency} class="form-control">
              <option value="mensile">Mensile</option>
              <option value="bimestrale">Bimestrale</option>
              <option value="trimestrale">Trimestrale</option>
              <option value="semestrale">Semestrale</option>
              <option value="annuale">Annuale</option>
            </select>
          </div>

          <div class="form-group">
            <label for="contract-val">Valore Totale (€) *</label>
            <input id="contract-val" type="number" step="0.01" bind:value={totalAmount} required class="form-control" />
          </div>
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="contract-start">Data Decorrenza *</label>
            <input id="contract-start" type="date" bind:value={startDate} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="contract-end">Data Scadenza *</label>
            <input id="contract-end" type="date" bind:value={endDate} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="contract-status">Stato Contratto</label>
            <select id="contract-status" bind:value={status} class="form-control">
              <option value="attivo">🟢 Attivo</option>
              <option value="in_scadenza">⚠️ In Scadenza</option>
              <option value="scaduto">🔴 Scaduto</option>
              <option value="sospeso">⏸️ Sospeso</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="contract-notes">Note & Note Riservate</label>
          <textarea id="contract-notes" bind:value={notes} rows="3" placeholder="Clausole o note interne..." class="form-control"></textarea>
        </div>
      </div>

      <!-- 3. CAMPI PERSONALIZZATI -->
      {#if customFieldsList.length > 0}
        <div class="card form-card">
          <div class="card-header">
            <h3 class="card-title">🧩 Campi Personalizzati</h3>
          </div>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/contracts/{contractId}" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          {saving ? 'Salvataggio...' : '💾 Aggiorna Contratto'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-contract-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  .page-top { margin-bottom: 20px; }

  .back-link {
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
  }
  .back-link:hover { color: var(--color-primary-600); }

  .page-top h2 {
    margin: 6px 0 0 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }

  .form-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: var(--shadow-sm);
  }

  .card-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .mb-16 { margin-bottom: 16px; }

  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

  .form-control {
    padding: 10px 14px;
    font-size: 14px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    box-sizing: border-box;
    width: 100%;
  }

  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
  }

  .btn-cancel {
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-600);
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    text-decoration: none;
  }

  .btn-submit {
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-white);
    background: var(--color-primary-600);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .alert { padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; font-weight: 600; }
  .error-box { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
