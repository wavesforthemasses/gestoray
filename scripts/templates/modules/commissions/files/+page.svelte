<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { CommissionsService } from './commissions.service';
  import type { CommissionItem, CommissionStatus } from './schema';
  import { toast } from '$lib/stores/toast.svelte';

  let commissions = $state<CommissionItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | CommissionStatus>('tutti');

  onMount(async () => {
    try {
      commissions = await CommissionsService.getCommissions();
    } catch (e) {
      console.error('Errore caricamento provvigioni:', e);
    } finally {
      loading = false;
    }
  });

  let filteredCommissions = $derived(
    commissions.filter(c => {
      const matchSearch = !searchQuery.trim() || 
        c.commissionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.dealTitle.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab = activeStatusTab === 'tutti' || c.status === activeStatusTab;
      return matchSearch && matchTab;
    })
  );

  let totalEarned = $derived(commissions.filter(c => c.status === 'maturata').reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0));
  let totalLiquidated = $derived(commissions.filter(c => c.status === 'liquidata').reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0));

  async function handleDelete(id?: string) {
    if (!id || !confirm('Sei sicuro di voler eliminare questa provvigione?')) return;
    try {
      await CommissionsService.deleteCommission(id);
      commissions = commissions.filter(c => c.id !== id);
      toast.success('Provvigione eliminata con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione provvigione: ' + err.message);
    }
  }

  function getStatusBadge(status: CommissionStatus) {
    switch (status) {
      case 'maturata': return { label: '🟢 Maturata', class: 'badge-success' };
      case 'liquidata': return { label: '💶 Liquidata', class: 'badge-info' };
      case 'in_attesa': return { label: '⏳ In Attesa', class: 'badge-warning' };
      case 'stornata': return { label: '↩️ Stornata', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }
</script>

<svelte:head>
  <title>Gestione Provvigioni Agenti | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="commissions-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title">💼 Gestione Provvigioni Commerciali</h1>
      <p class="page-subtitle">Traccia le provvigioni degli agenti sulle trattative e gli stati di maturazione/liquidazione.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/commissions/add" class="btn btn-primary">+ Registra Provvigione</a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-icon">💼</span>
      <div>
        <div class="kpi-value">{commissions.length}</div>
        <div class="kpi-label">Provvigioni Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">🟢</span>
      <div>
        <div class="kpi-value">€ {totalEarned.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">Maturate (Da Liquidare)</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">💶</span>
      <div>
        <div class="kpi-value">€ {totalLiquidated.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">Totale Liquidate</div>
      </div>
    </div>
  </div>

  <!-- FILTERS & SEARCH -->
  <div class="filter-card">
    <div class="status-tabs">
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'tutti' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'tutti'}
      >
        Tutte ({commissions.length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'maturata' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'maturata'}
      >
        🟢 Maturate ({commissions.filter(c => c.status === 'maturata').length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'liquidata' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'liquidata'}
      >
        💶 Liquidate ({commissions.filter(c => c.status === 'liquidata').length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'in_attesa' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'in_attesa'}
      >
        ⏳ In Attesa ({commissions.filter(c => c.status === 'in_attesa').length})
      </button>
    </div>

    <input 
      type="text" 
      placeholder="🔍 Cerca provvigione per agente, trattativa o numero..." 
      bind:value={searchQuery} 
      class="search-input"
    />
  </div>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento provvigioni...
    </div>
  {:else if filteredCommissions.length === 0}
    <div class="empty-state">
      <span class="empty-icon">💼</span>
      <h3>Nessuna provvigione trovata</h3>
      <p>Registra la prima provvigione commerciale per tracciare i compensi degli agenti.</p>
      <a href="/dashboard/commissions/add" class="btn btn-primary">+ Registra Provvigione</a>
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Scheda</th>
            <th>Agente Commerciale</th>
            <th>Trattativa / Oggetto</th>
            <th>Valore Trattativa</th>
            <th>% Aliquota</th>
            <th>Importo Provvigione</th>
            <th>Stato</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredCommissions as c}
            {@const badge = getStatusBadge(c.status)}
            <tr>
              <td class="font-mono">{c.commissionNumber}</td>
              <td><strong class="text-neutral-800">👷 {c.agentName}</strong></td>
              <td>{c.dealTitle}</td>
              <td>€ {(c.dealAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td><span class="type-pill">{c.commissionRate}%</span></td>
              <td class="font-bold text-primary">€ {(c.commissionAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td><span class="badge {badge.class}">{badge.label}</span></td>
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/commissions/{c.id}" class="btn-icon" title="Dettaglio">👁️</a>
                  <a href="/dashboard/commissions/{c.id}/edit" class="btn-icon" title="Modifica">✏️</a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(c.id)} title="Elimina">🗑️</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .commissions-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  .kpi-icon { font-size: 2rem; }
  .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.8rem; color: var(--color-neutral-500); font-weight: 600; }

  .filter-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .status-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tab-btn { padding: 0.4rem 0.8rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; border: 1px solid var(--color-neutral-300); background: var(--color-neutral-50); color: var(--color-neutral-700); cursor: pointer; }
  .tab-btn.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }

  .search-input { width: 100%; padding: 0.6rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.8rem; text-transform: uppercase; }

  .type-pill { font-size: 0.78rem; background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--color-neutral-700); }
  .badge { font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .action-buttons { display: flex; gap: 0.4rem; justify-content: flex-end; }
  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-icon, .btn-icon-danger { background: none; border: none; cursor: pointer; font-size: 1rem; text-decoration: none; }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
  .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
</style>
