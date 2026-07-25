<script lang="ts">
  import { onMount } from 'svelte';
  import { ContractsService } from './contracts.service';
  import type { ContractItem, ContractStatus } from './schema';
  import { toast } from '$lib/stores/toast.svelte';

  let contracts = $state<ContractItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | ContractStatus>('tutti');

  onMount(async () => {
    try {
      contracts = await ContractsService.getContracts();
    } catch (e) {
      console.error('Errore caricamento contratti:', e);
    } finally {
      loading = false;
    }
  });

  let filteredContracts = $derived(
    contracts.filter(c => {
      const matchSearch = !searchQuery.trim() || 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clientName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab = activeStatusTab === 'tutti' || c.status === activeStatusTab;
      return matchSearch && matchTab;
    })
  );

  let activeCount = $derived(contracts.filter(c => c.status === 'attivo').length);
  let expiringCount = $derived(contracts.filter(c => c.status === 'in_scadenza').length);
  let totalValue = $derived(contracts.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0));

  async function handleDelete(id?: string) {
    if (!id || !confirm('Sei sicuro di voler eliminare questo contratto?')) return;
    try {
      await ContractsService.deleteContract(id);
      contracts = contracts.filter(c => c.id !== id);
      toast.success('Contratto eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione contratto: ' + err.message);
    }
  }

  function getStatusBadge(status: ContractStatus) {
    switch (status) {
      case 'attivo': return { label: '🟢 Attivo', class: 'badge-success' };
      case 'in_scadenza': return { label: '⚠️ In Scadenza', class: 'badge-warning' };
      case 'scaduto': return { label: '🔴 Scaduto', class: 'badge-danger' };
      case 'sospeso': return { label: '⏸️ Sospeso', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }
</script>

<svelte:head>
  <title>Gestione Contratti | Gestoray</title>
</svelte:head>

<div class="contracts-page animate-fade-in">
  <!-- PAGE HEADER -->
  <header class="page-header">
    <div>
      <h1 class="page-title">📄 Gestione Contratti & Canoni</h1>
      <p class="page-subtitle">Pianifica, monitora e gestisci tutti i contratti aziendali e le frequenze di fatturazione.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/contracts/add" class="btn btn-primary">+ Nuovo Contratto</a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-icon">📄</span>
      <div>
        <div class="kpi-value">{contracts.length}</div>
        <div class="kpi-label">Contratti Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">🟢</span>
      <div>
        <div class="kpi-value">{activeCount}</div>
        <div class="kpi-label">Contratti Attivi</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">⚠️</span>
      <div>
        <div class="kpi-value">{expiringCount}</div>
        <div class="kpi-label">In Scadenza</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">💶</span>
      <div>
        <div class="kpi-value">€ {totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">Valore Portafoglio</div>
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
        Tutti ({contracts.length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'attivo' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'attivo'}
      >
        🟢 Attivi ({activeCount})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'in_scadenza' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'in_scadenza'}
      >
        ⚠️ In Scadenza ({expiringCount})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'scaduto' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'scaduto'}
      >
        🔴 Scaduti ({contracts.filter(c => c.status === 'scaduto').length})
      </button>
    </div>

    <input 
      type="text" 
      placeholder="🔍 Cerca contratto per titolo, numero o cliente..." 
      bind:value={searchQuery} 
      class="search-input"
    />
  </div>

  <!-- CONTRACTS LIST TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento contratti in corso...
    </div>
  {:else if filteredContracts.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📄</span>
      <h3>Nessun contratto trovato</h3>
      <p>Crea il tuo primo contratto aziendale per tracciare canoni e scadenze.</p>
      <a href="/dashboard/contracts/add" class="btn btn-primary">+ Crea Nuovo Contratto</a>
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Contratto</th>
            <th>Titolo & Cliente</th>
            <th>Tipologia</th>
            <th>Frequenza</th>
            <th>Valore Totale</th>
            <th>Scadenza</th>
            <th>Stato</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredContracts as c}
            {@const badge = getStatusBadge(c.status)}
            <tr>
              <td class="font-mono">{c.contractNumber}</td>
              <td>
                <a href="/dashboard/contracts/{c.id}" class="contract-link">{c.title}</a>
                <div class="sub-text">👤 {c.clientName}</div>
              </td>
              <td><span class="type-pill">{c.type}</span></td>
              <td class="capitalize">{c.billingFrequency}</td>
              <td class="font-bold">€ {(c.totalAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td>{c.endDate || 'N.D.'}</td>
              <td><span class="badge {badge.class}">{badge.label}</span></td>
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/contracts/{c.id}" class="btn-icon" title="Dettaglio">👁️</a>
                  <a href="/dashboard/contracts/{c.id}/edit" class="btn-icon" title="Modifica">✏️</a>
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
  .contracts-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-neutral-900);
  }

  .page-subtitle {
    color: var(--color-neutral-500);
    font-size: 0.9rem;
    margin: 0.2rem 0 0 0;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 1rem 1.2rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: var(--shadow-sm);
  }

  .kpi-icon {
    font-size: 2rem;
  }

  .kpi-value {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-neutral-900);
  }

  .kpi-label {
    font-size: 0.8rem;
    color: var(--color-neutral-500);
    font-weight: 600;
  }

  .filter-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .status-tabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .tab-btn {
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid var(--color-neutral-300);
    background: var(--color-neutral-50);
    color: var(--color-neutral-700);
    cursor: pointer;
  }

  .tab-btn.active {
    background: var(--color-primary-600);
    color: var(--color-white);
    border-color: var(--color-primary-600);
  }

  .search-input {
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    outline: none;
    box-sizing: border-box;
  }

  .table-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .data-table th, .data-table td {
    padding: 0.8rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .data-table th {
    background: var(--color-neutral-50);
    font-weight: 700;
    color: var(--color-neutral-700);
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .contract-link {
    font-weight: 700;
    color: var(--color-primary-700);
    text-decoration: none;
  }

  .contract-link:hover {
    text-decoration: underline;
  }

  .sub-text {
    font-size: 0.78rem;
    color: var(--color-neutral-500);
  }

  .type-pill {
    font-size: 0.78rem;
    background: var(--color-neutral-100);
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    color: var(--color-neutral-700);
  }

  .badge {
    font-size: 0.78rem;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .action-buttons {
    display: flex;
    gap: 0.4rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    border: none;
    text-decoration: none;
    font-size: 0.88rem;
  }

  .btn-primary { background: var(--color-primary-600); color: white; }

  .btn-icon, .btn-icon-danger {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
  }

  .loading-state, .empty-state {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
  }

  .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
  .capitalize { text-transform: capitalize; }
</style>
