<script lang="ts">
  import { onMount } from 'svelte';
  import { CantieriService } from '../cantieri.service';
  import type { CantiereItem } from '../schema';
  import { Building2, Plus, CheckCircle2, MapPin, Eye } from '@lucide/svelte';

  let { clientId }: { clientId: string } = $props();

  let cantieri = $state<CantiereItem[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (!clientId) return;
    try {
      cantieri = await CantieriService.getCantieri(clientId);
    } catch (e) {
      console.error('Errore caricamento cantieri cliente:', e);
    } finally {
      loading = false;
    }
  });

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<div class="client-cantieri-tab">
  <div class="tab-top">
    <h4><Building2 size={18} /> Cantieri & Commesse del Cliente ({cantieri.length})</h4>
    <a href="/dashboard/cantieri/add" class="btn-sm-action">
      <Plus size={14} /> Nuovo Cantiere
    </a>
  </div>

  {#if loading}
    <p class="loading-text">Caricamento cantieri...</p>
  {:else if cantieri.length === 0}
    <div class="empty-tab">
      <Building2 size={36} color="var(--color-neutral-400)" />
      <p>Nessun cantiere associato a questo cliente.</p>
    </div>
  {:else}
    <div class="cantieri-list">
      {#each cantieri as item}
        <div class="cantiere-item-card">
          <div class="cic-left">
            <span class="code font-mono">{item.code}</span>
            <span class="name font-bold">{item.name}</span>
            {#if item.address?.city}
              <span class="location"><MapPin size={12} /> {item.address.street} {item.address.city}</span>
            {/if}
          </div>

          <div class="cic-right">
            <div class="progress-mini">
              <span class="prog-text">{item.progress}%</span>
              <div class="pbar"><div class="pfill" style="width: {item.progress}%;"></div></div>
            </div>

            <span class="amount font-bold">{formatCurrency(item.estimatedAmount)}</span>

            <a href="/dashboard/cantieri/{item.id}" class="view-btn" title="Dettaglio Cantiere">
              <Eye size={16} />
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .client-cantieri-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 10px 0;
  }
  .tab-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tab-top h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    color: var(--color-neutral-800);
  }
  .btn-sm-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-primary-600);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }

  .cantieri-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cantiere-item-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .cic-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .code {
    font-size: 11px;
    color: var(--color-neutral-500);
  }
  .name {
    font-size: 14px;
    color: var(--color-neutral-800);
  }
  .location {
    font-size: 12px;
    color: var(--color-neutral-500);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cic-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .progress-mini {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 90px;
  }
  .prog-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-600);
  }
  .pbar {
    flex: 1;
    height: 6px;
    background: var(--color-neutral-200);
    border-radius: 3px;
    overflow: hidden;
  }
  .pfill {
    height: 100%;
    background: var(--color-primary-500);
  }

  .amount {
    font-size: 14px;
    color: var(--color-neutral-900);
  }
  .view-btn {
    color: var(--color-neutral-500);
    padding: 4px;
  }
  .view-btn:hover { color: var(--color-primary-600); }

  .empty-tab {
    text-align: center;
    padding: 24px;
    color: var(--color-neutral-500);
  }
  .loading-text {
    color: var(--color-neutral-500);
    font-size: 13px;
  }
</style>
