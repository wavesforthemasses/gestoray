<script lang="ts">
  import { Table, Card } from '$lib';
  import { FileText } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { exportToCSV, exportToExcel, triggerPrint } from '$lib/export-utils';
  import { formatDate } from '$lib/utils/formatters';
  import { activeRole } from '$lib/auth';

  interface Props {
    contractsList: any[];
    usersList: any[];
    activeTab: 'all' | 'pending' | 'approved';
    onTabChange: (tab: 'all' | 'pending' | 'approved') => void;
    selectedPeriod: { start: Date; end: Date } | null;
  }

  let { 
    contractsList,
    usersList,
    activeTab,
    onTabChange,
    selectedPeriod
  } = $props();

  let filteredContracts = $derived.by(() => {
    let result = contractsList;

    if (selectedPeriod) {
      result = result.filter(c => {
        const d = new Date(c.edits?.createdAt || c.original?.createdAt);
        return d >= selectedPeriod.start && d <= selectedPeriod.end;
      });
    }

    return result.map(c => ({
      id: c.id,
      createdAt: c.edits?.createdAt || c.original?.createdAt,
      clientName: c.original?.clientName,
      clientEmail: c.original?.clientEmail,
      totalPrice: c.original?.totalPrice,
      vendorEmail: c.original?.vendorEmail,
      vendorUid: c.original?.vendorUid,
      secondVendorUid: c.original?.secondVendorUid,
      secondVendorEmail: c.original?.secondVendorEmail,
      secondVendorShare: c.original?.secondVendorShare,
      status: c.original?.status,
      hasWarning: c.original?.hasWarning,
      derived: c.derived || {}
    }));
  });

  const columns = $derived.by(() => {
    const list = [
      { key: 'createdAt', header: 'Data Ordine' },
      { key: 'clientName', header: 'Cliente' },
      { key: 'totalPrice', header: 'Importo Venduto' },
      { key: 'status', header: 'Stato' }
    ];
    
    if ($activeRole !== 'commerciale') {
      list.splice(2, 0, { key: 'vendorEmail', header: 'Consulente' });
    }
    
    return list;
  });

  function getConsultantName(uid: string, fallback: string) {
    if (!uid) return fallback || 'N/D';
    const u = usersList.find(x => x.uid === uid);
    if (!u) return fallback || 'N/D';
    return `${u.nome || ''} ${u.cognome || ''}`.trim() || fallback || 'N/D';
  }

  function handleSelectContract(row: any) {
    goto(`/dashboard/contracts/${row.id}`);
  }
</script>

<div class="contracts-shell">
  <Card title="Database Contratti Commerciali" description="Fai clic su un contratto per vederne i dettagli o approvare la transazione.">
    {#snippet icon()}
      <FileText size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 12px;">
        <div class="filter-tabs" style="margin: 0;">
          <button class="tab-btn" class:active={activeTab === 'all'} onclick={() => onTabChange('all')}>Tutti</button>
          <button class="tab-btn" class:active={activeTab === 'pending'} onclick={() => onTabChange('pending')}>In Attesa</button>
          <button class="tab-btn" class:active={activeTab === 'approved'} onclick={() => onTabChange('approved')}>Approvati</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button onclick={() => exportToCSV(filteredContracts, [
            { key: 'id', header: 'ID Contratto' },
            { key: 'createdAt', header: 'Data Creazione' },
            { key: 'clientName', header: 'Cliente' },
            { key: 'vendorEmail', header: 'Commerciale' },
            { key: 'totalPrice', header: 'Valore Lordo' },
            { key: 'status', header: 'Stato' }
          ], 'gestoray_contratti')} class="export-btn" title="Esporta in formato CSV">
            CSV
          </button>
          <button onclick={() => exportToExcel(filteredContracts, [
            { key: 'id', header: 'ID Contratto' },
            { key: 'createdAt', header: 'Data Creazione' },
            { key: 'clientName', header: 'Cliente' },
            { key: 'vendorEmail', header: 'Commerciale' },
            { key: 'totalPrice', header: 'Valore Lordo' },
            { key: 'status', header: 'Stato' }
          ], 'gestoray_contratti')} class="export-btn" title="Esporta in Excel (XLS)">
            Excel
          </button>
          <button onclick={triggerPrint} class="export-btn" title="Stampa l'elenco / Salva PDF">
            Stampa / PDF
          </button>
        </div>
      </div>
    {/snippet}

    {#snippet cell(col: any, row: any)}
      {#if col.key === 'createdAt'}
        <span class="date-cell">{formatDate(row.createdAt)}</span>
      {:else if col.key === 'clientName'}
        <div style="display: flex; flex-direction: column;">
          <span class="strong-cell">{row.clientName || 'N/D'}</span>
          {#if row.clientEmail}
            <span class="sub-cell">{row.clientEmail}</span>
          {/if}
        </div>
      {:else if col.key === 'vendorEmail'}
        <div style="display: flex; flex-direction: column;">
          <span class="strong-cell" style="color: var(--color-primary-700);">{getConsultantName(row.vendorUid, row.vendorEmail)}</span>
          {#if row.secondVendorUid}
            <span class="sub-cell" style="color: var(--color-neutral-600); font-weight: 500;">
              + {getConsultantName(row.secondVendorUid, row.secondVendorEmail)} ({row.secondVendorShare}%)
            </span>
          {/if}
        </div>
      {:else if col.key === 'totalPrice'}
        <span class="currency-cell">€ {(row.totalPrice || 0).toFixed(2)}</span>
      {:else if col.key === 'status'}
        <div style="display: flex; align-items: center; gap: 6px;">
          {#if row.status === 'approved'}
            <span class="status-badge-lbl status-approved">Approvato</span>
          {:else}
            <span class="status-badge-lbl status-pending">In Revisione</span>
          {/if}
          {#if row.hasWarning}
            <span class="warning-dot" title="Richiede Attenzione"></span>
          {/if}
        </div>
      {/if}
    {/snippet}

    <div class="table-wrapper">
      <Table
        {columns}
        data={filteredContracts}
        cellSnippet={cell}
        onRowClick={handleSelectContract}
        emptyText="Nessun contratto registrato in base ai filtri correnti."
      />
    </div>
  </Card>
</div>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .export-btn {
    background: var(--color-white);
    color: var(--color-neutral-600);
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .export-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 4px;
    border-radius: var(--radius-md);
  }

  .tab-btn {
    background: transparent;
    border: none;
    padding: 6px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: var(--color-neutral-800);
  }

  .tab-btn.active {
    background: var(--color-white);
    color: var(--color-neutral-800);
    box-shadow: var(--shadow-sm);
  }

  .accent-tab.active {
    color: var(--color-primary-600);
  }

  .date-cell {
    font-size: 12px;
    color: var(--color-neutral-600);
  }

  .strong-cell {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .sub-cell {
    font-size: 12px;
    color: var(--color-neutral-500);
    margin-top: 2px;
  }

  .currency-cell {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 600;
  }

  .commission-text {
    color: var(--color-success-600);
  }

  .status-badge-lbl {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-approved {
    background: var(--color-success-100);
    color: var(--color-success-700);
  }

  .status-pending {
    background: var(--color-warning-100);
    color: var(--color-warning-700);
  }

  .warning-dot {
    width: 8px;
    height: 8px;
    background: var(--color-error-500);
    border-radius: 50%;
    display: inline-block;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }
</style>
