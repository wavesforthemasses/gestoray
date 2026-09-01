<script lang="ts">
  import { onMount } from 'svelte';
  import { WarehouseService } from '../warehouse.service';
  import type { StockMovementItem, StockMovementType } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { authState } from '$lib/auth.svelte';
  import { 
    RefreshCw, 
    Boxes, 
    Truck, 
    Building2, 
    Plus, 
    ArrowDownLeft, 
    ArrowUpRight, 
    ArrowLeftRight, 
    FileText, 
    Download 
  } from '@lucide/svelte';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';
  import FilterSelect from '$lib/components/FilterSelect.svelte';

  let movements = $state<StockMovementItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedTypeFilter = $state<string>('all');

  const movementTypeOptions = [
    { value: 'all', label: 'Tutte le Movimentazioni' },
    { value: 'IN_PURCHASE', label: 'Carico da Ordine Fornitore' },
    { value: 'IN_INITIAL', label: 'Carico / Rettifica Positiva' },
    { value: 'IN_RETURN', label: 'Reso da Cantiere o Cliente' },
    { value: 'OUT_SITE_USAGE', label: 'Scarico per Consumo Cantiere' },
    { value: 'OUT_SALE', label: 'Scarico per Vendita Cliente' },
    { value: 'OUT_SCRAP', label: 'Scarico per Rottamazione' },
    { value: 'TRANSFER', label: 'Trasferimento tra Depositi' }
  ];

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadMovements();
    }
  });

  async function loadMovements() {
    loading = true;
    try {
      movements = await WarehouseService.getMovements(200);
    } catch (err) {
      console.error('Errore caricamento movimenti:', err);
      toast.error('Impossibile caricare il registro movimenti');
    } finally {
      loading = false;
    }
  }

  let filteredMovements = $derived(
    movements.filter(m => {
      if (selectedTypeFilter !== 'all' && m.movementType !== selectedTypeFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.movementNumber.toLowerCase().includes(q) ||
        m.productName.toLowerCase().includes(q) ||
        (m.sku && m.sku.toLowerCase().includes(q)) ||
        (m.batchNumber && m.batchNumber.toLowerCase().includes(q)) ||
        (m.performedByName && m.performedByName.toLowerCase().includes(q))
      );
    })
  );

  function getMovementBadge(type: StockMovementType) {
    switch (type) {
      case 'IN_PURCHASE':
      case 'IN_INITIAL':
      case 'IN_RETURN':
        return { label: 'CARICO', class: 'badge-in', icon: ArrowDownLeft };
      case 'OUT_SITE_USAGE':
      case 'OUT_SALE':
      case 'OUT_SCRAP':
        return { label: 'SCARICO', class: 'badge-out', icon: ArrowUpRight };
      case 'TRANSFER':
        return { label: 'TRASFERIMENTO', class: 'badge-transfer', icon: ArrowLeftRight };
      default:
        return { label: type, class: 'badge-default', icon: RefreshCw };
    }
  }

  function exportCSV() {
    if (filteredMovements.length === 0) {
      toast.error('Nessun dato da esportare');
      return;
    }

    const headers = ['Numero Movimento', 'Data', 'Tipo', 'Articolo', 'SKU', 'Quantità', 'Unità', 'Costo Unitario', 'Totale Valore', 'Operatore', 'Note'];
    const rows = filteredMovements.map(m => [
      m.movementNumber,
      m.movementDate ? new Date(m.movementDate).toLocaleDateString('it-IT') : '',
      m.movementType,
      `"${m.productName.replace(/"/g, '""')}"`,
      m.sku || '',
      m.quantity,
      m.unit || 'pz',
      (m.unitCost || 0).toFixed(2),
      (m.totalCost || 0).toFixed(2),
      `"${(m.performedByName || '').replace(/"/g, '""')}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `movimentazioni_magazzino_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('File CSV esportato con successo');
  }
</script>

<svelte:head>
  <title>Registro Movimentazioni Magazzino - Gestoray</title>
</svelte:head>

<div class="movements-page">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <RefreshCw size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Registro Movimentazioni</h1>
          <p class="page-subtitle">Audit trail immutabile di carichi, scarichi e trasferimenti interni</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <div class="sub-nav-chips">
        <a href="/dashboard/warehouse" class="nav-chip">
          <Boxes size={14} />
          <span>Giacenze</span>
        </a>
        <a href="/dashboard/warehouse/orders" class="nav-chip">
          <Truck size={14} />
          <span>Ordini Fornitore</span>
        </a>
        <a href="/dashboard/warehouse/movements" class="nav-chip active">
          <RefreshCw size={14} />
          <span>Movimentazioni</span>
        </a>
        <a href="/dashboard/warehouse/suppliers" class="nav-chip">
          <Building2 size={14} />
          <span>Fornitori</span>
        </a>
      </div>

      <button type="button" class="btn-secondary" onclick={exportCSV}>
        <Download size={15} />
        <span>Export CSV</span>
      </button>

      <a href="/dashboard/warehouse/movements/add" class="btn-primary">
        <Plus size={16} />
        <span>Registra Movimento</span>
      </a>
    </div>
  </div>

  <!-- Search Toolbar -->
  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca movimento per numero, articolo o operatore..."
  >
    {#snippet filtersSnippet()}
      <FilterSelect
        bind:value={selectedTypeFilter}
        options={movementTypeOptions}
      />
    {/snippet}
  </SearchToolbar>

  <!-- Data Card -->
  <div class="data-card">
    {#if loading}
      <div class="loading-state">
        <RefreshCw size={28} class="animate-spin text-primary-500" />
        <p>Caricamento registro movimentazioni...</p>
      </div>
    {:else if filteredMovements.length === 0}
      <div class="empty-state">
        <RefreshCw size={48} class="text-slate-300" />
        <h3>Nessun movimento registrato</h3>
        <p>Non sono presenti movimentazioni corrispondenti ai filtri impostati.</p>
        <a href="/dashboard/warehouse/movements/add" class="btn-primary">
          <Plus size={16} />
          <span>Nuovo Movimento Manuale</span>
        </a>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Movimento / Data</th>
              <th>Tipo</th>
              <th>Articolo / SKU</th>
              <th class="text-right">Quantità</th>
              <th class="text-right">Costo Unit.</th>
              <th class="text-right">Valore Totale</th>
              <th>Operatore / Origine-Destinazione</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredMovements as mov (mov.id)}
              {@const badge = getMovementBadge(mov.movementType)}
              <tr>
                <td>
                  <div class="mov-num-cell">
                    <span class="font-semibold text-slate-900">{mov.movementNumber}</span>
                    <span class="mov-date">{mov.movementDate ? new Date(mov.movementDate).toLocaleString('it-IT') : 'N/D'}</span>
                  </div>
                </td>
                <td>
                  <span class="badge {badge.class}">
                    <badge.icon size={12} />
                    <span>{badge.label}</span>
                  </span>
                </td>
                <td>
                  <div class="prod-cell">
                    <span class="font-medium text-slate-800">{mov.productName}</span>
                    <span class="text-xs text-slate-400">SKU: {mov.sku || 'N/D'}</span>
                  </div>
                </td>
                <td class="text-right font-bold text-slate-900">
                  {mov.quantity} <span class="unit-text">{mov.unit || 'pz'}</span>
                </td>
                <td class="text-right">
                  € {(mov.unitCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-right font-semibold text-slate-800">
                  € {(mov.totalCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>
                  <div class="loc-op-cell">
                    <span class="text-xs font-medium text-slate-700">{mov.performedByName || 'Sistema'}</span>
                    {#if mov.fromPlaceName || mov.toPlaceName}
                      <span class="text-xs text-slate-400">
                        {mov.fromPlaceName ? `Da: ${mov.fromPlaceName} ` : ''}
                        {mov.toPlaceName ? `➔ A: ${mov.toPlaceName}` : ''}
                      </span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .movements-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-left .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-bubble {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--color-primary-50, #eff6ff);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-slate-900, #0f172a);
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--color-slate-500, #64748b);
    margin: 0.125rem 0 0 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .sub-nav-chips {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-slate-100, #f1f5f9);
    padding: 0.25rem;
    border-radius: 9999px;
  }

  .nav-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-600, #475569);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .nav-chip:hover {
    color: var(--color-slate-900, #0f172a);
    background: rgba(255, 255, 255, 0.6);
  }

  .nav-chip.active {
    background: #ffffff;
    color: var(--color-primary-600, #2563eb);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    font-weight: 600;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;
    border: none;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    border: 1px solid var(--color-slate-300, #cbd5e1);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .data-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    background: var(--color-slate-50, #f8fafc);
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--color-slate-600, #475569);
    border-bottom: 1px solid var(--color-slate-200, #e2e8f0);
    text-align: left;
  }

  .data-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
    color: var(--color-slate-700, #334155);
  }

  .mov-num-cell, .prod-cell, .loc-op-cell {
    display: flex;
    flex-direction: column;
  }

  .mov-date {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .badge-in { background: #ecfdf5; color: #047857; }
  .badge-out { background: #fff1f2; color: #e11d48; }
  .badge-transfer { background: #eff6ff; color: #2563eb; }
  .badge-default { background: #f1f5f9; color: #475569; }

  .unit-text {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
    font-weight: normal;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    gap: 0.75rem;
    color: var(--color-slate-500, #64748b);
  }

  .text-right { text-align: right; }
</style>
