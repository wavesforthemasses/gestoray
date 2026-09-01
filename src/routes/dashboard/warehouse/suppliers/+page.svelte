<script lang="ts">
  import { onMount } from 'svelte';
  import { WarehouseService } from '../warehouse.service';
  import type { SupplierItem } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { authState } from '$lib/auth.svelte';
  import { 
    Building2, 
    Plus, 
    Search, 
    Mail, 
    Phone, 
    MapPin, 
    Trash2, 
    Pencil, 
    List, 
    Boxes, 
    Truck, 
    RefreshCw, 
    Warehouse 
  } from '@lucide/svelte';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';

  let suppliers = $state<SupplierItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadSuppliers();
    }
  });

  async function loadSuppliers() {
    loading = true;
    try {
      suppliers = await WarehouseService.getSuppliers();
    } catch (err) {
      console.error('Errore caricamento fornitori:', err);
      toast.error('Impossibile caricare i fornitori');
    } finally {
      loading = false;
    }
  }

  let filteredSuppliers = $derived(
    suppliers.filter(s => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.companyName.toLowerCase().includes(q) ||
        (s.supplierNumber && s.supplierNumber.toLowerCase().includes(q)) ||
        (s.vatNumber && s.vatNumber.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
      );
    })
  );

  async function handleDelete(id: string) {
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo fornitore?');
    if (!confirmed) return;
    try {
      await WarehouseService.deleteSupplier(id);
      suppliers = suppliers.filter(s => s.id !== id);
      toast.success('Fornitore eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione fornitore: ' + err.message);
    }
  }
</script>

<svelte:head>
  <title>Anagrafica Fornitori - Gestoray</title>
</svelte:head>

<div class="suppliers-page">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Building2 size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Anagrafica Fornitori</h1>
          <p class="page-subtitle">Gestione fornitori, condizioni di pagamento e recapiti fiscali</p>
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
        <a href="/dashboard/warehouse/movements" class="nav-chip">
          <RefreshCw size={14} />
          <span>Movimentazioni</span>
        </a>
        <a href="/dashboard/warehouse/suppliers" class="nav-chip active">
          <Building2 size={14} />
          <span>Fornitori</span>
        </a>
      </div>

      <a href="/dashboard/warehouse/suppliers/add" class="btn-primary">
        <Plus size={16} />
        <span>Nuovo Fornitore</span>
      </a>
    </div>
  </div>

  <!-- Search Toolbar -->
  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca fornitore per ragione sociale, P.IVA o città..."
  />

  <!-- Data Card -->
  <div class="data-card">
    {#if loading}
      <div class="loading-state">
        <RefreshCw size={28} class="animate-spin text-primary-500" />
        <p>Caricamento fornitori in corso...</p>
      </div>
    {:else if filteredSuppliers.length === 0}
      <div class="empty-state">
        <Building2 size={48} class="text-slate-300" />
        <h3>Nessun fornitore registrato</h3>
        <p>Aggiungi il tuo primo fornitore per associare ordini di acquisto e carichi merce.</p>
        <a href="/dashboard/warehouse/suppliers/add" class="btn-primary">
          <Plus size={16} />
          <span>Aggiungi Fornitore</span>
        </a>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Codice / Ragione Sociale</th>
              <th>P.IVA / SDI</th>
              <th>Contatti</th>
              <th>Condizioni Pagamento</th>
              <th class="text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredSuppliers as s (s.id)}
              <tr>
                <td>
                  <div class="company-cell">
                    <span class="company-name">{s.companyName}</span>
                    <span class="company-num">{s.supplierNumber}</span>
                  </div>
                </td>
                <td>
                  <div class="vat-cell">
                    <span>{s.vatNumber || s.taxCode || 'N/D'}</span>
                    {#if s.sdiCode}
                      <span class="sdi-tag">SDI: {s.sdiCode}</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="contact-cell">
                    {#if s.email}
                      <span class="contact-item"><Mail size={12} /> {s.email}</span>
                    {/if}
                    {#if s.phone}
                      <span class="contact-item"><Phone size={12} /> {s.phone}</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <span class="payment-terms">{s.paymentTerms || 'Standard'}</span>
                </td>
                <td class="text-right">
                  <div class="action-buttons">
                    <a href="/dashboard/warehouse/suppliers/{s.id}" class="btn-icon" title="Modifica">
                      <Pencil size={15} />
                    </a>
                    <button type="button" class="btn-icon text-rose-600" title="Elimina" onclick={() => handleDelete(s.id)}>
                      <Trash2 size={15} />
                    </button>
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
  .suppliers-page {
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

  .company-cell {
    display: flex;
    flex-direction: column;
  }

  .company-name {
    font-weight: 600;
    color: var(--color-slate-900, #0f172a);
  }

  .company-num {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .vat-cell, .contact-cell {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .sdi-tag {
    font-size: 0.75rem;
    color: var(--color-slate-500, #64748b);
  }

  .contact-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-slate-600, #475569);
  }

  .payment-terms {
    font-size: 0.8125rem;
    color: var(--color-slate-600, #475569);
  }

  .action-buttons {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .btn-icon {
    padding: 0.375rem;
    border-radius: 6px;
    color: var(--color-slate-500, #64748b);
    border: 1px solid var(--color-slate-200, #e2e8f0);
    background: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
