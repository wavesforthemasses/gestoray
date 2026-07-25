<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { CommissionsService } from '../commissions.service';
  import type { CommissionStatus } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let agents = $state<{ id: string; name: string }[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let commissionNumber = $state(`PRV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  let agentUid = $state('');
  let dealTitle = $state('');
  let dealAmount = $state<number>(10000);
  let commissionRate = $state<number>(10);
  let earnedDate = $state(new Date().toISOString().slice(0, 10));
  let status = $state<CommissionStatus>('maturata');
  let notes = $state('');

  let commissionAmount = $derived(
    Math.round(((dealAmount || 0) * (commissionRate || 0)) / 100 * 100) / 100
  );

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('commissions');
      agents = await CacheLookupService.getLookup('users');
    } catch (e) {
      console.error('Errore caricamento dati creazione provvigione:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!agentUid || !dealTitle.trim()) {
      errorMsg = 'Compila i campi obbligatori (Agente e Oggetto Trattativa).';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedAgent = agents.find(a => a.id === agentUid);

      const commId = await CommissionsService.createCommission({
        commissionNumber: commissionNumber.trim(),
        agentUid,
        agentName: selectedAgent ? selectedAgent.name : 'Agente',
        dealTitle: dealTitle.trim(),
        dealAmount,
        commissionRate,
        commissionAmount,
        earnedDate,
        status,
        notes: notes.trim(),
        customFields: customFieldsValues
      });

      toast.success('Provvigione registrata con successo!');
      goto(`/dashboard/commissions/${commId}`);
    } catch (err: any) {
      console.error('Errore salvataggio provvigione:', err);
      errorMsg = err.message || 'Errore durante il salvataggio della provvigione.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuova Provvigione | Gestoray</title>
</svelte:head>

<div class="add-commission-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/commissions" class="back-link">← Torna alle Provvigioni</a>
    <h2>💼 Registra Nuova Provvigione Agente</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">⚠️ {errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="commission-form">
      <!-- 1. AGENTE & TRATTATIVA -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">👷 Agente Commerciale & Trattativa</h3>
          <p class="card-subtitle">Seleziona l'agente ed inserisci il titolo della trattativa conclusa.</p>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="comm-num">N° Scheda Provvigione *</label>
            <input id="comm-num" type="text" bind:value={commissionNumber} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="agent-select">Agente Commerciale *</label>
            <Autocomplete 
              options={agents.map(a => ({ id: a.id, label: a.name }))} 
              bind:value={agentUid} 
              placeholder="🔍 Cerca agente/utente..."
            />
          </div>
        </div>

        <div class="form-group mt-16">
          <label for="deal-title">Oggetto / Titolo Trattativa *</label>
          <input 
            id="deal-title" 
            type="text" 
            bind:value={dealTitle} 
            placeholder="es. Vendita Contratto Annuale Sede Centrale" 
            required 
            class="form-control" 
          />
        </div>
      </div>

      <!-- 2. CALCOLO PROVVIGIONE -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">💶 Valori & Aliquota Provvigionale</h3>
          <p class="card-subtitle">Inserisci il valore della trattativa e la percentuale spettante all'agente.</p>
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="deal-amount">Valore Trattativa (€) *</label>
            <input id="deal-amount" type="number" step="0.01" bind:value={dealAmount} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="comm-rate">Aliquota Provvigionale (%) *</label>
            <input id="comm-rate" type="number" step="0.1" bind:value={commissionRate} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="comm-calculated">Importo Provvigione (€)</label>
            <input id="comm-calculated" type="number" value={commissionAmount} disabled class="form-control font-bold" />
          </div>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="earned-date">Data Maturazione *</label>
            <input id="earned-date" type="date" bind:value={earnedDate} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="comm-status">Stato Provvigione</label>
            <select id="comm-status" bind:value={status} class="form-control">
              <option value="maturata">🟢 Maturata (Pronta per Liquidazione)</option>
              <option value="liquidata">💶 Liquidata (Già Pagata)</option>
              <option value="in_attesa">⏳ In Attesa</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="comm-notes">Note & Note Riservate</label>
          <textarea id="comm-notes" bind:value={notes} rows="3" placeholder="Note per l'amministrazione o accordi particolari..." class="form-control"></textarea>
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
        <a href="/dashboard/commissions" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          {saving ? 'Salvataggio...' : '💾 Registra Provvigione'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-commission-page { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  .page-top { margin-bottom: 20px; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 600; }
  .back-link:hover { color: var(--color-primary-600); }
  .page-top h2 { margin: 6px 0 0 0; font-size: 22px; font-weight: 700; color: var(--color-neutral-900); }

  .form-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow-sm); }
  .card-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .mb-16 { margin-bottom: 16px; }
  .mt-16 { margin-top: 16px; }

  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); background: white; outline: none; width: 100%; box-sizing: border-box; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 32px; }
  .btn-cancel { padding: 12px 24px; font-size: 14px; font-weight: 600; color: var(--color-neutral-600); background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); text-decoration: none; }
  .btn-submit { padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }

  .alert { padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; font-weight: 600; }
  .error-box { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  .font-bold { font-weight: 700; }
</style>
