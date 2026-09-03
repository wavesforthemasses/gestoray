<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    Receipt, 
    Plus, 
    Settings, 
    Search, 
    Filter, 
    RefreshCw, 
    Eye, 
    ArrowUpRight, 
    FileSpreadsheet, 
    Clock, 
    CreditCard,
    RotateCcw
  } from '@lucide/svelte';
  import { InvoicesService } from './invoices.service';
  import { InvoiceSettingsService } from './invoiceSettingsService';
  import type { InvoiceItem, InvoiceSettings } from './schema';
  import InvoiceStatusBadge from './components/InvoiceStatusBadge.svelte';
  import { formatCurrency } from '$lib/utils/math';

  let invoices = $state<InvoiceItem[]>([]);
  let settings = $state<InvoiceSettings | null>(null);
  let loading = $state(true);

  // Filtri
  let searchQuery = $state('');
  let selectedYear = $state<number>(new Date().getFullYear());
  let selectedSezionale = $state<string>('all');
  let selectedStatus = $state<string>('all');
  let selectedPayment = $state<string>('all');

  const availableYears = [2027, 2026, 2025, 2024];

  onMount(async () => {
    await Promise.all([loadSettings(), loadInvoices()]);
  });

  async function loadSettings() {
    try {
      settings = await InvoiceSettingsService.getSettings();
    } catch (e) {
      console.warn('Errore lettura impostazioni:', e);
    }
  }

  async function loadInvoices() {
    loading = true;
    try {
      invoices = await InvoicesService.getInvoices({
        year: selectedYear,
        sezionaleId: selectedSezionale,
        status: selectedStatus !== 'all' ? (selectedStatus as any) : undefined,
        paymentStatus: selectedPayment !== 'all' ? selectedPayment : undefined
      });
    } catch (e) {
      console.error('Errore caricamento fatture:', e);
    } finally {
      loading = false;
    }
  }

  let filteredInvoices = $derived(
    invoices.filter(inv => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.clientName || '').toLowerCase().includes(q) ||
        (inv.notes || '').toLowerCase().includes(q);

      const matchesSezionale = selectedSezionale === 'all' || inv.sezionaleId === selectedSezionale;
      const matchesStatus = selectedStatus === 'all' || inv.status === selectedStatus;
      const matchesPayment = selectedPayment === 'all' || inv.paymentStatus === selectedPayment;

      return matchesSearch && matchesSezionale && matchesStatus && matchesPayment;
    })
  );

  let totalRevenue = $derived(
    filteredInvoices
      .filter(i => i.status !== 'annullata' && i.status !== 'bozza')
      .reduce((sum, i) => sum + (i.totalNet || 0), 0)
  );

  let totalPending = $derived(
    filteredInvoices
      .filter(i => i.status !== 'annullata' && i.paymentStatus !== 'pagata_saldata')
      .reduce((sum, i) => sum + (i.remainingAmount || i.netToPay || 0), 0)
  );
</script>

<div class="invoices-page">
  <!-- PAGE HEADER -->
  <div class="page-top-actions">
    <div class="title-group">
      <div class="icon-wrap">
        <Receipt size={24} />
      </div>
      <div>
        <h1>{settings?.entityNaming?.documentLabel || 'Fatture'} & Documenti Fiscali</h1>
        <p class="subtitle">Emissione fatture ordinarie, differite da bolle, acconti e note di credito</p>
      </div>
    </div>
    <div class="actions-group">
      <a href="/dashboard/invoices/settings" class="btn btn-secondary">
        <Settings size={16} /> Impostazioni Sezionali
      </a>
      <a href="/dashboard/invoices/add" class="btn btn-primary">
        <Plus size={16} /> Nuova Fattura
      </a>
    </div>
  </div>

  <!-- KPI SUMMARY CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrap primary">
        <Receipt size={20} />
      </div>
      <div class="kpi-content">
        <span class="kpi-label">Fatturato Netto ({selectedYear})</span>
        <span class="kpi-value">{formatCurrency(totalRevenue)}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap warning">
        <Clock size={20} />
      </div>
      <div class="kpi-content">
        <span class="kpi-label">Totale da Incassare</span>
        <span class="kpi-value">{formatCurrency(totalPending)}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrap neutral">
        <FileSpreadsheet size={20} />
      </div>
      <div class="kpi-content">
        <span class="kpi-label">Documenti nel Filtro</span>
        <span class="kpi-value">{filteredInvoices.length}</span>
      </div>
    </div>
  </div>

  <!-- FILTERS TOOLBAR -->
  <div class="filters-card">
    <div class="search-input-wrap">
      <Search size={16} />
      <input 
        type="text" 
        placeholder="Cerca per numero, cliente o nota..." 
        bind:value={searchQuery} 
        class="search-input"
      />
    </div>

    <div class="filter-controls">
      <!-- Anno -->
      <select bind:value={selectedYear} onchange={loadInvoices} class="select-filter">
        {#each availableYears as y}
          <option value={y}>Anno {y}</option>
        {/each}
      </select>

      <!-- Sezionale -->
      <select bind:value={selectedSezionale} onchange={loadInvoices} class="select-filter">
        <option value="all">Tutti i Sezionali</option>
        {#if settings?.sezionali}
          {#each settings.sezionali as s}
            <option value={s.id}>{s.name} ({s.code || 'Base'})</option>
          {/each}
        {/if}
      </select>

      <!-- Stato Fiscale SDI -->
      <select bind:value={selectedStatus} onchange={loadInvoices} class="select-filter">
        <option value="all">Tutti gli Stati</option>
        <option value="bozza">Bozze</option>
        <option value="emessa">Emesse</option>
        <option value="inviata_sdi">Inviate SDI</option>
        <option value="consegnata">Consegnate</option>
        <option value="scartata">Scartate SDI</option>
        <option value="annullata">Annullate / Stornate</option>
      </select>

      <!-- Stato Pagamento -->
      <select bind:value={selectedPayment} onchange={loadInvoices} class="select-filter">
        <option value="all">Tutti i Pagamenti</option>
        <option value="non_pagata">Da Incassare</option>
        <option value="pagata_parziale">Acconto Parziale</option>
        <option value="pagata_saldata">Saldate</option>
      </select>

      <button class="btn btn-icon" onclick={loadInvoices} title="Ricarica">
        <RefreshCw size={16} class={loading ? 'spin' : ''} />
      </button>
    </div>
  </div>

  <!-- INVOICES TABLE -->
  <div class="data-card">
    {#if loading}
      <div class="empty-state">
        <RefreshCw size={32} class="spin" />
        <p>Caricamento documenti fiscali in corso...</p>
      </div>
    {:else if filteredInvoices.length === 0}
      <div class="empty-state">
        <Receipt size={40} />
        <h3>Nessuna fattura trovata</h3>
        <p>Non ci sono documenti fiscali corrispondenti ai filtri impostati.</p>
        <a href="/dashboard/invoices/add" class="btn btn-primary" style="margin-top: 0.5rem;">
          <Plus size={16} /> Crea Nuova Fattura
        </a>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 140px;">Numero Doc</th>
              <th style="width: 95px;">Tipo</th>
              <th style="width: 105px;">Data</th>
              <th>Cliente</th>
              <th style="width: 120px; text-align: right;">Imponibile</th>
              <th style="width: 120px; text-align: right;">Totale Lordo</th>
              <th style="width: 110px; text-align: center;">Stato Fiscale</th>
              <th style="width: 110px; text-align: center;">Pagamento</th>
              <th style="width: 80px; text-align: right;">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredInvoices as inv (inv.id)}
              <tr onclick={() => goto(`/dashboard/invoices/${inv.id}`)} class="table-row-clickable">
                <td>
                  <span class="invoice-num-badge">
                    {inv.invoiceNumber}
                  </span>
                </td>
                <td>
                  <span class="type-badge">{inv.type}</span>
                </td>
                <td>
                  <span class="date-text">{inv.date}</span>
                </td>
                <td>
                  <div class="client-cell">
                    <span class="client-name">{inv.clientName}</span>
                    {#if inv.bolleIds && inv.bolleIds.length > 0}
                      <span class="bolle-count-tag">{inv.bolleIds.length} Bolle</span>
                    {/if}
                  </div>
                </td>
                <td style="text-align: right; font-weight: 600;">
                  {formatCurrency(inv.totalNet || 0)}
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--text-primary, #0f172a);">
                  {formatCurrency(inv.totalGross || 0)}
                </td>
                <td style="text-align: center;">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td style="text-align: center;">
                  <InvoiceStatusBadge paymentStatus={inv.paymentStatus} showPayment={true} />
                </td>
                <td style="text-align: right;">
                  <a 
                    href="/dashboard/invoices/{inv.id}" 
                    class="icon-btn" 
                    onclick={e => e.stopPropagation()} 
                    title="Visualizza Dettaglio"
                  >
                    <ArrowUpRight size={16} />
                  </a>
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
  .invoices-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .icon-wrap {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: var(--color-primary-50, rgba(59, 130, 246, 0.1));
    color: var(--color-primary-600, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary, #0f172a);
  }

  .subtitle {
    margin: 0.15rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
  }

  .actions-group {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  .btn-secondary {
    background: var(--surface-secondary, #f1f5f9);
    color: var(--text-primary, #334155);
    border: 1px solid var(--border-color, #cbd5e1);
  }

  .btn-icon {
    padding: 0.55rem;
    background: var(--surface-secondary, #f1f5f9);
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-primary, #334155);
    border-radius: 8px;
    cursor: pointer;
  }

  /* KPI GRID */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 1.15rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .kpi-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-icon-wrap.primary {
    background: rgba(37, 99, 235, 0.1);
    color: var(--color-primary-600, #2563eb);
  }

  .kpi-icon-wrap.warning {
    background: rgba(217, 119, 6, 0.1);
    color: #d97706;
  }

  .kpi-icon-wrap.neutral {
    background: rgba(100, 116, 139, 0.1);
    color: #64748b;
  }

  .kpi-content {
    display: flex;
    flex-direction: column;
  }

  .kpi-label {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
    font-weight: 500;
  }

  .kpi-value {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-primary, #0f172a);
    margin-top: 0.15rem;
  }

  /* FILTRI */
  .filters-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 0.875rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .search-input-wrap {
    flex: 1;
    min-width: 240px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input-wrap :global(svg) {
    position: absolute;
    left: 0.75rem;
    color: #94a3b8;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
  }

  .filter-controls {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .select-filter {
    padding: 0.5rem 0.75rem;
    font-size: 0.825rem;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    background: var(--surface-card, #ffffff);
    color: var(--text-primary, #334155);
  }

  /* TABELLA */
  .data-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .data-table th {
    padding: 0.85rem 1.25rem;
    background: var(--surface-secondary, #f8fafc);
    color: var(--text-muted, #475569);
    font-weight: 600;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .data-table td {
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
    color: var(--text-primary, #1e293b);
  }

  .table-row-clickable {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .table-row-clickable:hover {
    background: #f8fafc;
  }

  .invoice-num-badge {
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
    background: rgba(37, 99, 235, 0.07);
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    display: inline-block;
  }

  .type-badge {
    font-size: 0.75rem;
    font-weight: 700;
    background: #f1f5f9;
    color: #475569;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .date-text {
    font-size: 0.825rem;
    color: var(--text-muted, #64748b);
  }

  .client-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .client-name {
    font-weight: 600;
  }

  .bolle-count-tag {
    font-size: 0.7rem;
    background: #e0f2fe;
    color: #0369a1;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .icon-btn {
    display: inline-flex;
    padding: 0.35rem;
    color: var(--text-muted, #64748b);
    border-radius: 6px;
  }

  .icon-btn:hover {
    color: var(--color-primary-600, #2563eb);
    background: #eff6ff;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    color: var(--text-muted, #64748b);
    text-align: center;
  }

  .empty-state h3 {
    margin: 0.5rem 0 0.25rem 0;
    color: var(--text-primary, #0f172a);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
