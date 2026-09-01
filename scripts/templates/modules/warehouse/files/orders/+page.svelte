<script lang="ts">
  import { onMount } from 'svelte';
  import { WarehouseService } from '../warehouse.service';
  import type { PurchaseOrderItem, PurchaseOrderStatus } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { authState } from '$lib/auth.svelte';
  import { 
    Truck, 
    Plus, 
    Search, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    FileText, 
    Building2, 
    Boxes, 
    RefreshCw, 
    Pencil, 
    Trash2, 
    Eye 
  } from '@lucide/svelte';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';
  import FilterSelect from '$lib/components/FilterSelect.svelte';

  let orders = $state<PurchaseOrderItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedStatus = $state<string>('all');

  const statusOptions = [
    { value: 'all', label: 'Tutti gli Stati' },
    { value: 'bozza', label: 'Bozza' },
    { value: 'inviato', label: 'Inviato al Fornitore' },
    { value: 'ricevuto_parziale', label: 'Ricevuto Parziale' },
    { value: 'ricevuto_totale', label: 'Ricevuto Completo' },
    { value: 'annullato', label: 'Annullato' }
  ];

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadOrders();
    }
  });

  async function loadOrders() {
    loading = true;
    try {
      orders = await WarehouseService.getPurchaseOrders();
    } catch (err) {
      console.error('Errore caricamento ordini:', err);
      toast.error('Impossibile caricare gli ordini di acquisto');
    } finally {
      loading = false;
    }
  }

  let filteredOrders = $derived(
    orders.filter(o => {
      if (selectedStatus !== 'all' && o.status !== selectedStatus) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.poNumber.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        (o.deliveryNotes && o.deliveryNotes.toLowerCase().includes(q))
      );
    })
  );

  function getStatusBadge(status: PurchaseOrderStatus) {
    switch (status) {
      case 'bozza':
        return { label: 'Bozza', class: 'badge-draft', icon: Clock };
      case 'inviato':
        return { label: 'Inviato', class: 'badge-sent', icon: Truck };
      case 'ricevuto_parziale':
        return { label: 'Parziale', class: 'badge-partial', icon: Clock };
      case 'ricevuto_totale':
        return { label: 'Ricevuto', class: 'badge-completed', icon: CheckCircle2 };
      case 'annullato':
        return { label: 'Annullato', class: 'badge-cancelled', icon: AlertCircle };
      default:
        return { label: status, class: 'badge-draft', icon: Clock };
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo ordine?');
    if (!confirmed) return;
    try {
      await WarehouseService.deletePurchaseOrder(id);
      orders = orders.filter(o => o.id !== id);
      toast.success('Ordine eliminato');
    } catch (err: any) {
      toast.error(err.message || 'Errore eliminazione ordine');
    }
  }
</script>

<svelte:head>
  <title>Ordini di Acquisto - Gestoray</title>
</svelte:head>

<div class="orders-page">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Truck size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Ordini di Acquisto (PO)</h1>
          <p class="page-subtitle">Pianificazione acquisti fornitore e tracciamento ricezione merci</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <div class="sub-nav-chips">
        <a href="/dashboard/warehouse" class="nav-chip">
          <Boxes size={14} />
          <span>Giacenze</span>
        </a>
        <a href="/dashboard/warehouse/orders" class="nav-chip active">
          <Truck size={14} />
          <span>Ordini Fornitore</span>
        </a>
        <a href="/dashboard/warehouse/movements" class="nav-chip">
          <RefreshCw size={14} />
          <span>Movimentazioni</span>
        </a>
        <a href="/dashboard/warehouse/suppliers" class="nav-chip">
          <Building2 size={14} />
          <span>Fornitori</span>
        </a>
      </div>

      <a href="/dashboard/warehouse/orders/add" class="btn-primary">
        <Plus size={16} />
        <span>Nuovo Ordine</span>
      </a>
    </div>
  </div>

  <!-- Search Toolbar -->
  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca ordine per numero PO o fornitore..."
  >
    {#snippet filtersSnippet()}
      <FilterSelect
        bind:value={selectedStatus}
        options={statusOptions}
      />
    {/snippet}
  </SearchToolbar>

  <!-- Data Card -->
  <div class="data-card">
    {#if loading}
      <div class="loading-state">
        <RefreshCw size={28} class="animate-spin text-primary-500" />
        <p>Caricamento ordini di acquisto...</p>
      </div>
    {:else if filteredOrders.length === 0}
      <div class="empty-state">
        <Truck size={48} class="text-slate-300" />
        <h3>Nessun ordine trovato</h3>
        <p>Non sono presenti ordini di acquisto corrispondenti ai filtri.</p>
        <a href="/dashboard/warehouse/orders/add" class="btn-primary">
          <Plus size={16} />
          <span>Crea Nuovo Ordine</span>
        </a>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Numero PO / Data</th>
              <th>Fornitore</th>
              <th>Articoli Ordinati</th>
              <th class="text-right">Totale Netto</th>
              <th class="text-right">Totale Lordo</th>
              <th class="text-center">Stato</th>
              <th class="text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredOrders as order (order.id)}
              {@const badge = getStatusBadge(order.status)}
              <tr>
                <td>
                  <div class="po-number-cell">
                    <a href="/dashboard/warehouse/orders/{order.id}" class="po-link font-semibold text-primary-600">
                      {order.poNumber}
                    </a>
                    <span class="po-date">{order.orderDate ? new Date(order.orderDate).toLocaleDateString('it-IT') : 'N/D'}</span>
                  </div>
                </td>
                <td>
                  <span class="supplier-name font-medium text-slate-800">{order.supplierName}</span>
                </td>
                <td>
                  <span class="items-count">
                    {order.items?.length || 0} articoli ({order.items?.reduce((acc, i) => acc + (i.orderedQty || 0), 0) || 0} un.)
                  </span>
                </td>
                <td class="text-right font-medium">
                  € {(order.totalNetAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-right font-bold text-slate-900">
                  € {(order.totalGrossAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-center">
                  <span class="badge {badge.class}">
                    <badge.icon size={12} />
                    <span>{badge.label}</span>
                  </span>
                </td>
                <td class="text-right">
                  <div class="action-buttons">
                    <a href="/dashboard/warehouse/orders/{order.id}" class="btn-action" title="Vedi Dettaglio / Ricevi Merci">
                      <Eye size={14} />
                      <span>Dettagli</span>
                    </a>
                    {#if order.status === 'bozza' || order.status === 'annullato'}
                      <button type="button" class="btn-icon text-rose-600" title="Elimina" onclick={() => handleDelete(order.id)}>
                        <Trash2 size={15} />
                      </button>
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
  .orders-page {
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
    gap: 1rem;
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

  .po-number-cell {
    display: flex;
    flex-direction: column;
  }

  .po-link {
    text-decoration: none;
  }

  .po-link:hover {
    text-decoration: underline;
  }

  .po-date {
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
    font-weight: 600;
  }

  .badge-draft { background: #f1f5f9; color: #475569; }
  .badge-sent { background: #eff6ff; color: #2563eb; }
  .badge-partial { background: #fffbeb; color: #b45309; }
  .badge-completed { background: #ecfdf5; color: #047857; }
  .badge-cancelled { background: #fff1f2; color: #e11d48; }

  .action-buttons {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    text-decoration: none;
  }

  .btn-action:hover {
    background: var(--color-slate-100, #f1f5f9);
  }

  .btn-icon {
    padding: 0.375rem;
    border-radius: 6px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    background: #ffffff;
    cursor: pointer;
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
  .text-center { text-align: center; }
</style>
