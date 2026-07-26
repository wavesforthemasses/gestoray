<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { CommissionsService } from '../commissions.service';
  import type { CommissionItem, CommissionStatus } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';

  let commissionId = $derived(page.params.id);
  let commission = $state<CommissionItem | null>(null);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('commissions');
      if (commissionId) {
        commission = await CommissionsService.getCommissionById(commissionId);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio provvigione:', e);
    } finally {
      loading = false;
    }
  });

  function getStatusBadge(status: CommissionStatus) {
    switch (status) {
      case 'maturata': return { label: '🟢 Maturata', class: 'badge-success' };
      case 'liquidata': return { label: '💶 Liquidata', class: 'badge-info' };
      case 'in_attesa': return { label: '⏳ In Attesa', class: 'badge-warning' };
      case 'stornata': return { label: '↩️ Stornata', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }

  function printSummary() {
    window.print();
  }
</script>

<svelte:head>
  <title>{commission ? `Provvigione ${commission.commissionNumber}` : 'Dettaglio Provvigione'} | Gestoray</title>
</svelte:head>

<div class="commission-detail-page animate-fade-in">
  <a href="/dashboard/commissions" class="back-link">← Torna alle Provvigioni</a>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento provvigione...
    </div>
  {:else if !commission}
    <div class="alert error-box">⚠️ Scheda provvigione non trovata o eliminata.</div>
  {:else}
    {@const badge = getStatusBadge(commission.status)}

    <!-- HEADER -->
    <header class="detail-header card">
      <div>
        <div class="header-tag">Scheda N° {commission.commissionNumber}</div>
        <h1 class="page-title">€ {(commission.commissionAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h1>
        <p class="page-subtitle">👷 Agente Commerciale: <strong>{commission.agentName}</strong></p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printSummary}>🖨️ Stampa Prospetto</button>
        <a href="/dashboard/commissions/{commissionId}/edit" class="btn btn-secondary">✏️ Modifica Provvigione</a>
      </div>
    </header>

    <!-- INFO CARD -->
    <div class="card info-card">
      <h3 class="card-title">ℹ️ Dettagli Trattativa & Compensi</h3>
      
      <div class="info-row">
        <span class="info-label">Stato Provvigione</span>
        <span class="badge {badge.class}">{badge.label}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Trattativa / Oggetto</span>
        <span class="info-val">{commission.dealTitle}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Valore Trattativa Conclusa</span>
        <span class="info-val">€ {(commission.dealAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Aliquota Spettante</span>
        <span class="info-val font-bold">{commission.commissionRate}%</span>
      </div>

      <div class="info-row">
        <span class="info-label">Importo Provvigionale</span>
        <span class="info-val font-bold text-primary">€ {(commission.commissionAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Data Maturazione</span>
        <span class="info-val">{commission.earnedDate}</span>
      </div>

      {#if commission.notes}
        <div class="notes-box">
          <strong>Note & Accordi Commerciali:</strong>
          <p>{commission.notes}</p>
        </div>
      {/if}
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && commission.customFields}
      <div class="card form-card">
        <h3 class="card-title">🧩 Campi Personalizzati</h3>
        <CustomFieldsRenderer fields={customFieldsList} values={commission.customFields} readonly={true} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .commission-detail-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
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
  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-700); border: 1px solid var(--color-neutral-300); }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  .font-bold { font-weight: 700; }
</style>
