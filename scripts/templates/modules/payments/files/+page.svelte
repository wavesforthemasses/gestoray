<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { PaymentsService } from './payments.service';
  import type { PaymentItem, PaymentStatus } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { 
    CreditCard, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    RotateCcw, 
    Plus, 
    Search, 
    Eye, 
    Pencil, 
    Trash2, 
    Receipt 
  } from '@lucide/svelte';

  let payments = $state<PaymentItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | PaymentStatus>('tutti');

  onMount(async () => {
    try {
      payments = await PaymentsService.getPayments();
    } catch (e) {
      console.error('Errore caricamento incassi:', e);
    } finally {
      loading = false;
    }
  });

  let filteredPayments = $derived(
    payments.filter(p => {
      const matchSearch = !searchQuery.trim() || 
        p.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab = activeStatusTab === 'tutti' || p.status === activeStatusTab;
      return matchSearch && matchTab;
    })
  );

  let totalCollected = $derived(payments.filter(p => p.status === 'pagato').reduce((acc, curr) => acc + (curr.amount || 0), 0));
  let totalPending = $derived(payments.filter(p => p.status === 'in_attesa').reduce((acc, curr) => acc + (curr.amount || 0), 0));

  async function handleDelete(id?: string) {
    if (!id) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo movimento di incasso?');
    if (!confirmed) return;
    try {
      await PaymentsService.deletePayment(id);
      payments = payments.filter(p => p.id !== id);
      toast.success('Incasso eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione incasso: ' + err.message);
    }
  }

  function getStatusBadge(status: PaymentStatus) {
    switch (status) {
      case 'pagato': return { label: 'Pagato', class: 'badge-success' };
      case 'in_attesa': return { label: 'In Attesa', class: 'badge-warning' };
      case 'scaduto': return { label: 'Scaduto', class: 'badge-danger' };
      case 'stornato': return { label: 'Stornato', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }
</script>

<svelte:head>
  <title>Gestione Incassi & Pagamenti | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="payments-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title"><CreditCard size={26} /> Gestione Incassi & Flussi di Cassa</h1>
      <p class="page-subtitle">Registra e monitora i pagamenti ricevuti dai clienti ed il flusso finanziario.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/payments/add" class="btn btn-primary"><Plus size={16} /> Registra Incasso</a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-box"><Receipt size={22} /></div>
      <div>
        <div class="kpi-value">{payments.length}</div>
        <div class="kpi-label">Movimenti Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-box success"><CheckCircle2 size={22} /></div>
      <div>
        <div class="kpi-value">€ {totalCollected.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">Totale Incassato</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-box warning"><Clock size={22} /></div>
      <div>
        <div class="kpi-value">€ {totalPending.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">In Attesa di Incasso</div>
      </div>
    </div>
  </div>

  <!-- FILTER & SEARCH -->
  <div class="filter-card">
    <div class="status-tabs">
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'tutti' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'tutti'}
      >
        Tutti ({payments.length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'pagato' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'pagato'}
      >
        Pagati ({payments.filter(p => p.status === 'pagato').length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'in_attesa' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'in_attesa'}
      >
        In Attesa ({payments.filter(p => p.status === 'in_attesa').length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'scaduto' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'scaduto'}
      >
        Scaduti ({payments.filter(p => p.status === 'scaduto').length})
      </button>
    </div>

    <div class="search-wrap">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca incasso per N° o ragione sociale cliente..." 
        bind:value={searchQuery} 
        class="search-input"
      />
    </div>
  </div>

  <!-- PAYMENTS TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento incassi...
    </div>
  {:else if filteredPayments.length === 0}
    <div class="empty-state">
      <div class="empty-icon-box"><CreditCard size={36} /></div>
      <h3>Nessun movimento trovato</h3>
      <p>Registra il tuo primo incasso per monitorare il flusso di cassa.</p>
      <a href="/dashboard/payments/add" class="btn btn-primary"><Plus size={16} /> Registra Incasso</a>
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Movimento</th>
            <th>Cliente</th>
            <th>Metodo</th>
            <th>Data Incasso</th>
            <th>Importo</th>
            <th>Stato</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredPayments as p}
            {@const badge = getStatusBadge(p.status)}
            <tr>
              <td class="font-mono">{p.paymentNumber}</td>
              <td><strong class="text-neutral-800">{p.clientName}</strong></td>
              <td><span class="type-pill capitalize">{p.method}</span></td>
              <td>{p.paymentDate}</td>
              <td class="font-bold text-primary">€ {(p.amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td><span class="badge {badge.class}">{badge.label}</span></td>
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/payments/{p.id}" class="btn-icon" title="Dettaglio" aria-label="Dettaglio"><Eye size={16} /></a>
                  <a href="/dashboard/payments/{p.id}/edit" class="btn-icon" title="Modifica" aria-label="Modifica"><Pencil size={16} /></a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(p.id)} title="Elimina" aria-label="Elimina"><Trash2 size={16} /></button>
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
  .payments-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 10px; }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  .kpi-icon-box { width: 44px; height: 44px; border-radius: 10px; background: var(--color-primary-50, #eff6ff); color: var(--color-primary-600, #2563eb); display: flex; align-items: center; justify-content: center; }
  .kpi-icon-box.success { background: #dcfce7; color: #16a34a; }
  .kpi-icon-box.warning { background: #fef3c7; color: #d97706; }
  .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.8rem; color: var(--color-neutral-500); font-weight: 600; }

  .filter-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .status-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tab-btn { padding: 0.4rem 0.8rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; border: 1px solid var(--color-neutral-300); background: var(--color-neutral-50); color: var(--color-neutral-700); cursor: pointer; }
  .tab-btn.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }

  .search-wrap { position: relative; width: 100%; }
  :global(.search-icon) { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-400); }
  .search-input { width: 100%; padding: 0.6rem 0.9rem 0.6rem 2.4rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.8rem; text-transform: uppercase; }

  .type-pill { font-size: 0.78rem; background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--color-neutral-700); }
  .badge { font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .action-buttons { display: flex; gap: 0.4rem; justify-content: flex-end; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-icon, .btn-icon-danger { display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: var(--radius-md); background: none; border: 1px solid transparent; cursor: pointer; color: var(--color-neutral-600); text-decoration: none; }
  .btn-icon:hover { background: var(--color-neutral-100); color: var(--color-neutral-900); }
  .btn-icon-danger:hover { background: #fee2e2; color: #b91c1c; }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
  .empty-icon-box { margin: 0 auto 12px; width: 64px; height: 64px; border-radius: 16px; background: var(--color-neutral-100); display: flex; align-items: center; justify-content: center; color: var(--color-neutral-500); }
  .font-mono { font-family: monospace; font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
  .capitalize { text-transform: capitalize; }
</style>
