<script module lang="ts">
  export const bridgeMetadata = {
    id: 'job_costing',
    sourceModule: 'job_costing',
    label: 'Controllo di Gestione'
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { 
    Calculator, 
    TrendingUp, 
    TrendingDown, 
    Plus, 
    Briefcase, 
    ArrowRight,
    Layers,
    AlertCircle
  } from '@lucide/svelte';
  import { db, collection, query, where, getDocs } from '$lib/firebase';
  import { formatCurrency } from '$lib/utils/math';

  let { placeId, clientId }: { placeId?: string; clientId?: string } = $props();

  let projects = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (!placeId) {
      loading = false;
      return;
    }

    try {
      const snap = await getDocs(query(collection(db, 'job_costing_projects'), where('placeId', '==', placeId)));
      projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Errore lettura commesse cantiere:', e);
    } finally {
      loading = false;
    }
  });

  let totalRevenue = $derived(
    projects.reduce((acc, p) => acc + (Number(p.revenues?.contractValue) || Number(p.revenues?.invoicedTotal) || 0), 0)
  );
  let totalCosts = $derived(
    projects.reduce((acc, p) => acc + (Number(p.actuals?.total) || 0), 0)
  );
  let totalMargin = $derived(totalRevenue - totalCosts);
  let marginPercent = $derived(totalRevenue > 0 ? (Number((totalMargin / totalRevenue) * 100) || 0).toFixed(1) : '0.0');
</script>

<div class="place-job-costing-tab animate-fade-in">
  <div class="bridge-header-row">
    <div>
      <h3 class="bridge-title">Controllo di Gestione & Marginalità Cantiere</h3>
      <p class="bridge-sub">Monitoraggio in tempo reale dei costi di manodopera, materiali FIFO e redditività di questo cantiere.</p>
    </div>
    <a 
      href="/dashboard/job_costing/add?placeId={placeId || ''}&clientId={clientId || ''}" 
      class="btn btn-primary btn-sm"
      title="Avvia una nuova commessa su questo cantiere"
    >
      <Plus size={15} />
      <span>Nuova Commessa Cantiere</span>
    </a>
  </div>

  {#if loading}
    <div class="loading-state card">
      <div class="spinner"></div>
      <p>Caricamento dati economici cantiere...</p>
    </div>
  {:else if projects.length === 0}
    <div class="empty-state card">
      <Calculator size={40} class="text-muted" />
      <h4>Nessuna commessa di controllo gestione associata</h4>
      <p>Attiva una commessa economica per questo cantiere per aggregare automaticamente ore e materiali.</p>
      <a href="/dashboard/job_costing/add?placeId={placeId || ''}&clientId={clientId || ''}" class="btn btn-primary btn-sm">
        <Plus size={14} />
        <span>Avvia Commessa</span>
      </a>
    </div>
  {:else}
    <!-- Mini KPI Cantiere -->
    <div class="place-kpi-grid">
      <div class="mini-kpi-card">
        <span class="mini-kpi-label">Valore Contrattuale Cantiere</span>
        <span class="mini-kpi-val text-primary">{formatCurrency(totalRevenue)}</span>
      </div>
      <div class="mini-kpi-card">
        <span class="mini-kpi-label">Spesa Consuntivata Totale</span>
        <span class="mini-kpi-val">{formatCurrency(totalCosts)}</span>
      </div>
      <div class="mini-kpi-card">
        <span class="mini-kpi-label">Utile / Margine Cantiere</span>
        <span class="mini-kpi-val" class:text-success={totalMargin >= 0} class:text-danger={totalMargin < 0}>
          {formatCurrency(totalMargin)} ({marginPercent}%)
        </span>
      </div>
    </div>

    <!-- Lista Commesse Cantiere -->
    <div class="projects-list-card card">
      <h4 class="card-title-sm">Commesse Attive su questo Cantiere ({projects.length})</h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Codice & Oggetto</th>
              <th>Stato</th>
              <th class="text-right">Valore</th>
              <th class="text-right">Costi Reali</th>
              <th class="text-right">Margine</th>
              <th class="text-center">Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {#each projects as p}
              <tr class="table-row" onclick={() => goto(`/dashboard/job_costing/${p.id}`)}>
                <td>
                  <span class="code-tag">{p.code}</span>
                  <strong>{p.title}</strong>
                </td>
                <td>
                  <span class="badge-status {p.status}">{p.status}</span>
                </td>
                <td class="text-right font-medium">
                  {formatCurrency(p.revenues?.contractValue || p.revenues?.invoicedTotal || 0)}
                </td>
                <td class="text-right">
                  {formatCurrency(p.actuals?.total || 0)}
                </td>
                <td class="text-right">
                  <span class="margin-badge" class:negative={(p.profitability?.grossMarginAmount || 0) < 0}>
                    {formatCurrency(p.profitability?.grossMarginAmount || 0)} ({p.profitability?.grossMarginPercent || 0}%)
                  </span>
                </td>
                <td class="text-center" onclick={e => e.stopPropagation()}>
                  <a href="/dashboard/job_costing/{p.id}" class="btn-icon" title="Vedi radiografia economica">
                    <ArrowRight size={15} />
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .place-job-costing-tab {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .bridge-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    padding-bottom: 0.5rem;
  }

  .bridge-title {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-main, #0f172a);
  }

  .bridge-sub {
    font-size: 0.85rem;
    color: var(--color-text-muted, #64748b);
    margin: 0.2rem 0 0 0;
  }

  .place-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .mini-kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }

  .mini-kpi-label {
    font-size: 0.725rem;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--color-text-muted, #64748b);
  }

  .mini-kpi-val {
    font-size: 1.35rem;
    font-weight: 700;
    margin-top: 0.25rem;
  }

  .projects-list-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .card-title-sm {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .table-responsive {
    overflow-x: auto;
    width: 100%;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    background: var(--color-bg-subtle, #f8fafc);
    color: var(--color-text-muted, #475569);
    font-weight: 600;
    padding: 0.7rem 0.85rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    text-align: left;
  }

  .data-table td {
    padding: 0.75rem 0.85rem;
    border-bottom: 1px solid var(--color-border, #f1f5f9);
    vertical-align: middle;
  }

  .table-row {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .table-row:hover {
    background-color: var(--color-bg-subtle, #f8fafc);
  }

  .code-tag {
    font-size: 0.725rem;
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
    margin-right: 0.5rem;
  }

  .badge-status {
    padding: 0.2rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .badge-status.in_corso { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
  .badge-status.chiusa { background: rgba(107, 114, 128, 0.12); color: #374151; }

  .margin-badge {
    font-weight: 600;
    color: #059669;
  }

  .margin-badge.negative {
    color: #dc2626;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--color-bg-subtle, #f1f5f9);
    color: var(--color-text-main, #334155);
  }

  .btn-icon:hover {
    background: #3b82f6;
    color: #ffffff;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1.5rem;
    text-align: center;
    gap: 0.65rem;
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .text-success { color: #059669; }
  .text-danger { color: #dc2626; }
  .text-primary { color: #2563eb; }
</style>
