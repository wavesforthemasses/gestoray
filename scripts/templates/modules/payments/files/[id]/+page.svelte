<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { PaymentsService } from '../payments.service';
  import type { PaymentItem, PaymentStatus } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';

  let paymentId = $derived(page.params.id);
  let payment = $state<PaymentItem | null>(null);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('payments');
      if (paymentId) {
        payment = await PaymentsService.getPaymentById(paymentId);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio incasso:', e);
    } finally {
      loading = false;
    }
  });

  function getStatusBadge(status: PaymentStatus) {
    switch (status) {
      case 'pagato': return { label: '🟢 Pagato', class: 'badge-success' };
      case 'in_attesa': return { label: '⏳ In Attesa', class: 'badge-warning' };
      case 'scaduto': return { label: '🔴 Scaduto', class: 'badge-danger' };
      case 'stornato': return { label: '↩️ Stornato', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }

  function printReceipt() {
    window.print();
  }
</script>

<svelte:head>
  <title>{payment ? `Incasso ${payment.paymentNumber}` : 'Dettaglio Incasso'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="payment-detail-page animate-fade-in">
  <a href="/dashboard/payments" class="back-link">← Torna alla Gestione Incassi</a>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento incasso...
    </div>
  {:else if !payment}
    <div class="alert error-box">⚠️ Movimento di incasso non trovato o eliminato.</div>
  {:else}
    {@const badge = getStatusBadge(payment.status)}

    <!-- HEADER -->
    <header class="detail-header card">
      <div>
        <div class="header-tag">Movimento N° {payment.paymentNumber}</div>
        <h1 class="page-title">€ {(payment.amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h1>
        <p class="page-subtitle">👤 Cliente: <strong>{payment.clientName}</strong></p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printReceipt}>🖨️ Stampa Ricevuta</button>
        <a href="/dashboard/payments/{paymentId}/edit" class="btn btn-secondary">✏️ Modifica Movimento</a>
      </div>
    </header>

    <!-- INFO CARD -->
    <div class="card info-card">
      <h3 class="card-title">ℹ️ Dettagli Transazione</h3>
      
      <div class="info-row">
        <span class="info-label">Stato Movimento</span>
        <span class="badge {badge.class}">{badge.label}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Metodo di Pagamento</span>
        <span class="info-val capitalize">{payment.method}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Data Incasso</span>
        <span class="info-val">{payment.paymentDate}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Importo Totale</span>
        <span class="info-val font-bold text-primary">€ {(payment.amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
      </div>

      {#if payment.notes}
        <div class="notes-box">
          <strong>Note & Causale Bonifico:</strong>
          <p>{payment.notes}</p>
        </div>
      {/if}
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && payment.customFields}
      <div class="card form-card">
        <h3 class="card-title">🧩 Campi Personalizzati</h3>
        <CustomFieldsRenderer fields={customFieldsList} values={payment.customFields} readonly={true} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .payment-detail-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 0.85rem; font-weight: 600; }

  .detail-header { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm); }
  .header-tag { font-family: monospace; font-size: 0.85rem; color: var(--color-primary-600); font-weight: 700; }
  .page-title { font-size: 1.8rem; font-weight: 800; margin: 0.2rem 0; color: var(--color-neutral-900); }
  .page-subtitle { font-size: 0.9rem; color: var(--color-neutral-600); margin: 0; }
  .header-actions { display: flex; gap: 0.8rem; }

  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem 0; color: var(--color-neutral-800); }

  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--color-neutral-100); font-size: 0.9rem; }
  .info-label { color: var(--color-neutral-500); font-weight: 600; }
  .info-val { font-weight: 600; color: var(--color-neutral-900); }

  .notes-box { margin-top: 1rem; background: var(--color-neutral-50); padding: 0.8rem; border-radius: var(--radius-md); font-size: 0.85rem; }

  .badge { font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-700); border: 1px solid var(--color-neutral-300); }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  .font-bold { font-weight: 700; }
  .capitalize { text-transform: capitalize; }
</style>
