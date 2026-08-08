<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { PaymentsService } from '../../payments.service';
  import type { PaymentItem, PaymentMethod, PaymentStatus } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let paymentId = $derived(page.params.id);
  let payment = $state<PaymentItem | null>(null);

  let clients = $state<{ id: string; name: string }[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let paymentNumber = $state('');
  let clientId = $state('');
  let amount = $state<number>(0);
  let paymentDate = $state('');
  let method = $state<PaymentMethod>('bonifico');
  let status = $state<PaymentStatus>('pagato');
  let notes = $state('');

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('payments');
      clients = await CacheLookupService.getLookup('clients');

      if (paymentId) {
        payment = await PaymentsService.getPaymentById(paymentId);
        if (payment) {
          paymentNumber = payment.paymentNumber || '';
          clientId = payment.clientId || '';
          amount = payment.amount || 0;
          paymentDate = payment.paymentDate || '';
          method = payment.method || 'bonifico';
          status = payment.status || 'pagato';
          notes = payment.notes || '';
          customFieldsValues = payment.customFields ? { ...payment.customFields } : {};
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati modifica incasso:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!paymentId || !clientId || amount <= 0) {
      errorMsg = 'Seleziona un cliente ed inserisci un importo valido.';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedClient = clients.find(c => c.id === clientId);

      await PaymentsService.updatePayment(paymentId, {
        paymentNumber: paymentNumber.trim(),
        clientId,
        clientName: selectedClient ? selectedClient.name : (payment?.clientName || ''),
        amount,
        paymentDate,
        method,
        status,
        notes: notes.trim(),
        customFields: customFieldsValues
      });

      toast.success('Incasso aggiornato con successo!');
      goto(`/dashboard/payments/${paymentId}`);
    } catch (err: any) {
      console.error('Errore salvataggio incasso:', err);
      errorMsg = err.message || 'Errore durante l\'aggiornamento dell\'incasso.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Incasso | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-payment-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/payments/{paymentId}" class="back-link">← Torna al Dettaglio Incasso</a>
    <h2>✏️ Modifica Movimento Incasso</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if !payment}
    <div class="alert error-box">⚠️ Movimento non trovato o eliminato.</div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">⚠️ {errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="payment-form">
      <!-- 1. CLIENTE & RIFERIMENTI -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">👤 Cliente Intestatario</h3>
          <p class="card-subtitle">Seleziona il cliente per cui stai modificando l'incasso.</p>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="payment-num">N° Incasso / Ricevuta *</label>
            <input id="payment-num" type="text" bind:value={paymentNumber} required class="form-control" />
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

      <!-- 2. DETTAGLI MOVIMENTO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">ℹ️ Dettagli Transazione Financial</h3>
          <p class="card-subtitle">Importo, data, metodo di incasso e stato del pagamento.</p>
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="payment-amt">Importo Incassato (€) *</label>
            <input id="payment-amt" type="number" step="0.01" bind:value={amount} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="payment-date">Data Incasso *</label>
            <input id="payment-date" type="date" bind:value={paymentDate} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="payment-method">Metodo di Pagamento</label>
            <select id="payment-method" bind:value={method} class="form-control">
              <option value="bonifico">Bonifico Bancario</option>
              <option value="carta">Carta di Credito / POS</option>
              <option value="rid">Addebito Diretto / RID</option>
              <option value="contanti">Contanti</option>
              <option value="assegno">Assegno</option>
            </select>
          </div>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="payment-status">Stato Incasso</label>
            <select id="payment-status" bind:value={status} class="form-control">
              <option value="pagato">🟢 Pagato / Incassato</option>
              <option value="in_attesa">⏳ In Attesa di Riscontro</option>
              <option value="scaduto">🔴 Scaduto</option>
              <option value="stornato">↩️ Stornato</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="payment-notes">Note & Riferimenti Bonifico/Transazione</label>
          <textarea id="payment-notes" bind:value={notes} rows="3" placeholder="TRN bonifico, causale o note interne..." class="form-control"></textarea>
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
        <a href="/dashboard/payments/{paymentId}" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          {saving ? 'Salvataggio...' : '💾 Aggiorna Incasso'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-payment-page { width: 100%; box-sizing: border-box; }
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

  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); background: white; outline: none; width: 100%; box-sizing: border-box; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 32px; }
  .btn-cancel { padding: 12px 24px; font-size: 14px; font-weight: 600; color: var(--color-neutral-600); background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); text-decoration: none; }
  .btn-submit { padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }

  .alert { padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; font-weight: 600; }
  .error-box { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
