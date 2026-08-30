<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { PaymentsService } from './payments.service';
  import { PaymentSettingsService, DEFAULT_PAYMENT_METHODS } from './paymentSettingsService';
  import type { PaymentItem, PaymentStatus, PaymentMethod, PaymentSettings } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { exportToCSV, exportToExcel } from '$lib/export-utils';
  import { UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { PaymentsKPIBridge } from './payments.kpi.bridge';
  import { 
    CreditCard, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    RotateCcw, 
    Plus, 
    Search, 
    Eye, 
    Trash2, 
    Receipt, 
    FileSpreadsheet,
    Euro,
    Download,
    Building2,
    Calendar,
    ArrowUpRight,
    Pencil
  } from '@lucide/svelte';

  let settings = $state<PaymentSettings>({
    entityNaming: 'payment',
    prefix: 'INC-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true,
    paymentMethods: [...DEFAULT_PAYMENT_METHODS]
  });
  let labels = $derived(PaymentSettingsService.getLabels(settings));

  let payments = $state<PaymentItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | PaymentStatus>('tutti');
  let selectedMethod = $state<string>('tutti');

  // --- CHART ANALYTICS STATE ---
  let activeChartTab = $state<string>('total_incassato');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<any[]>([]);
  let computedChartPoints = $state<number[]>([]);
  let loadingChart = $state(false);

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('payments'));
  let sideKpisPosition = $derived<'right' | 'none'>(
    activeEntityConfig && activeEntityConfig.showSideKpis !== false ? 'right' : 'none'
  );

  // Calcolo KPI puramente unificato delegato al Bridge (SSOT)
  let calculatedKPIs = $derived(PaymentsKPIBridge.calculateKPIs(payments));

  let availableChartMetrics = $derived(
    (activeEntityConfig?.enabled ? activeEntityConfig.kpis || [] : [])
      .filter(k => k.enabled)
      .map(k => ({
        id: k.id,
        label: k.name,
        shortLabel: k.acronym,
        isCurrency: k.isCurrency !== false,
        value: (calculatedKPIs as any)[k.id] ?? (calculatedKPIs as any)[k.acronym?.toLowerCase()] ?? 0
      }))
  );

  $effect(() => {
    chartPeriods = DashboardService.generateChartPeriods(endDateString, granularity);
  });

  async function loadChartData() {
    if (!isGraphExpanded || chartPeriods.length === 0) return;
    loadingChart = true;
    try {
      const roleToUse = activeRoleState.role || '';
      const uidToUse = authState.user?.uid || '';
      const results = await DashboardService.fetchChartAggregations(chartPeriods, roleToUse, uidToUse, activeChartTab);
      computedChartPoints = results || chartPeriods.map(() => 0);
    } catch (e) {
      console.error("Error loading payments chart data:", e);
      computedChartPoints = chartPeriods.map(() => 0);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded || granularity || endDateString || activeChartTab) {
      loadChartData();
    }
  });

  onMount(async () => {
    try {
      const [s, p] = await Promise.all([
        PaymentSettingsService.getSettings(),
        PaymentsService.getPayments()
      ]);
      settings = s;
      payments = p;
    } catch (e) {
      console.error('Errore caricamento incassi:', e);
      toast.error('Errore caricamento incassi');
    } finally {
      loading = false;
    }
  });

  let filteredPayments = $derived(
    payments.filter(p => {
      const matchSearch = !searchQuery.trim() || 
        p.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.transactionReference && p.transactionReference.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = activeStatusTab === 'tutti' || p.status === activeStatusTab;
      const matchMethod = selectedMethod === 'tutti' || p.method === selectedMethod;

      return matchSearch && matchStatus && matchMethod;
    })
  );

  let filteredKPIs = $derived(PaymentsKPIBridge.calculateKPIs(filteredPayments));
  let totalGross = $derived(filteredKPIs.totalIncassatoLordo);
  let totalNet = $derived(filteredKPIs.totalIncassato);
  let totalVat = $derived(filteredKPIs.totalVat);

  async function handleDelete(id?: string) {
    if (!id) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo movimento di incasso?');
    if (!confirmed) return;
    try {
      await PaymentsService.deletePayment(id);
      payments = payments.filter(p => p.id !== id);
      toast.success('Incasso eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione: ' + err.message);
    }
  }

  function getStatusBadge(status: PaymentStatus) {
    switch (status) {
      case 'pagato': case 'registrato': 
        return { label: 'Registrato', class: 'badge-success' };
      case 'in_verifica': 
        return { label: 'In Verifica', class: 'badge-warning' };
      case 'annullato': case 'stornato': 
        return { label: 'Annullato', class: 'badge-danger' };
      default: 
        return { label: status, class: 'badge-neutral' };
    }
  }

  function formatDate(d: string) {
    if (!d) return 'N/D';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  }

  function getMethodLabel(methodId: string) {
    const found = (settings.paymentMethods || []).find(m => m.id === methodId);
    if (found) return found.label;
    switch (methodId) {
      case 'bonifico': return 'Bonifico Bancario';
      case 'contanti': return 'Contanti';
      case 'pos_carta': return 'POS / Carta';
      case 'assegno': return 'Assegno';
      case 'riba': return 'Ri.Ba.';
      case 'paypal_stripe': return 'PayPal / Stripe';
      default: return methodId;
    }
  }

  const exportCols = [
    { key: 'Numero', header: 'Numero' },
    { key: 'Data', header: 'Data' },
    { key: 'Cliente', header: 'Cliente' },
    { key: 'Metodo', header: 'Metodo' },
    { key: 'Riferimento', header: 'Riferimento' },
    { key: 'Imponibile Netto (€)', header: 'Imponibile Netto (€)' },
    { key: 'IVA (€)', header: 'IVA (€)' },
    { key: 'Totale Lordo (€)', header: 'Totale Lordo (€)' },
    { key: 'Stato', header: 'Stato' }
  ];

  function handleExportCSV() {
    exportToCSV(
      filteredPayments.map(p => ({
        Numero: p.paymentNumber,
        Data: p.paymentDate,
        Cliente: p.clientName,
        Metodo: p.method,
        Riferimento: p.transactionReference || '',
        'Imponibile Netto (€)': (Number(p.netAmount) || 0).toFixed(2),
        'IVA (€)': (Number(p.vatAmount) || 0).toFixed(2),
        'Totale Lordo (€)': (Number(p.grossAmount) || 0).toFixed(2),
        Stato: p.status
      })),
      exportCols,
      `Incassi_${new Date().toISOString().slice(0, 10)}`
    );
  }

  function handleExportXLS() {
    exportToExcel(
      filteredPayments.map(p => ({
        Numero: p.paymentNumber,
        Data: p.paymentDate,
        Cliente: p.clientName,
        Metodo: p.method,
        Riferimento: p.transactionReference || '',
        'Imponibile Netto (€)': (Number(p.netAmount) || 0).toFixed(2),
        'IVA (€)': (Number(p.vatAmount) || 0).toFixed(2),
        'Totale Lordo (€)': (Number(p.grossAmount) || 0).toFixed(2),
        Stato: p.status
      })),
      exportCols,
      `Incassi_${new Date().toISOString().slice(0, 10)}`
    );
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="payments-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title"><CreditCard size={26} /> {labels.plural} & Flussi di Cassa</h1>
      <p class="page-subtitle">Registro centralizzato delle transazioni finanziarie ricevute, imponibili ed IVA.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/payments/add" class="btn btn-primary">
        <Plus size={16} /> {labels.newSingular}
      </a>
    </div>
  </header>

  <!-- UNIVERSAL ANALYTICS CHART -->
  {#if activeEntityConfig?.enabled && availableChartMetrics.length > 0}
    <UniversalAnalyticsChart
      title="Trend & Performance {labels.plural}"
      metrics={availableChartMetrics}
      bind:activeMetric={activeChartTab}
      bind:granularity={granularity}
      bind:endDateString={endDateString}
      bind:isExpanded={isGraphExpanded}
      bind:selectedPointIdx={selectedPointIdx}
      chartPeriods={chartPeriods}
      computedChartPoints={computedChartPoints}
      loadingChart={loadingChart}
      kpisPosition={sideKpisPosition}
    />
  {/if}

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-box"><Receipt size={22} /></div>
      <div>
        <div class="kpi-value">{filteredPayments.length}</div>
        <div class="kpi-label">Movimenti Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-box kpi-net"><Euro size={22} /></div>
      <div>
        <div class="kpi-value">€ {totalNet.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-label">Imponibile Netto Incassato</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-box kpi-vat"><Euro size={22} /></div>
      <div>
        <div class="kpi-value">€ {totalVat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-label">Quota IVA Totale</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-box kpi-gross"><Euro size={22} /></div>
      <div>
        <div class="kpi-value font-bold">€ {totalGross.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-label">Totale Lordo Movimenti</div>
      </div>
    </div>
  </div>

  <!-- FILTERS & ACTIONS BAR -->
  <div class="toolbar-card">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Cerca per numero, cliente o riferimento..."
        class="search-input"
      />
    </div>

    <div class="filter-group">
      <select bind:value={selectedMethod} class="filter-select">
        <option value="tutti">Tutti i Metodi</option>
        {#each (settings.paymentMethods || []) as pMethod}
          <option value={pMethod.id}>{pMethod.label}</option>
        {/each}
      </select>

      <button type="button" class="btn btn-secondary btn-sm" onclick={handleExportCSV}>
        <Download size={14} /> CSV
      </button>
      <button type="button" class="btn btn-secondary btn-sm" onclick={handleExportXLS}>
        <FileSpreadsheet size={14} /> Excel
      </button>
    </div>
  </div>

  <!-- STATUS TABS -->
  <div class="status-tabs">
    <button 
      class="tab-item" 
      class:active={activeStatusTab === 'tutti'}
      onclick={() => activeStatusTab = 'tutti'}
    >
      Tutti ({payments.length})
    </button>
    <button 
      class="tab-item" 
      class:active={activeStatusTab === 'registrato'}
      onclick={() => activeStatusTab = 'registrato'}
    >
      Registrati ({payments.filter(p => p.status === 'registrato' || p.status === 'pagato').length})
    </button>
    <button 
      class="tab-item" 
      class:active={activeStatusTab === 'in_verifica'}
      onclick={() => activeStatusTab = 'in_verifica'}
    >
      In Verifica ({payments.filter(p => p.status === 'in_verifica').length})
    </button>
    <button 
      class="tab-item" 
      class:active={activeStatusTab === 'annullato'}
      onclick={() => activeStatusTab = 'annullato'}
    >
      Annullati ({payments.filter(p => p.status === 'annullato' || p.status === 'stornato').length})
    </button>
  </div>

  <!-- PAYMENTS TABLE -->
  {#if loading}
    <div class="loader-box">Caricamento incassi in corso...</div>
  {:else if filteredPayments.length === 0}
    <div class="card empty-card">
      <Receipt size={40} class="empty-icon" />
      <p class="empty-title">Nessun incasso trovato</p>
      <p class="empty-desc">Non ci sono movimenti registrati che corrispondono ai filtri selezionati.</p>
    </div>
  {:else}
    <div class="card table-card">
      <div class="table-wrapper">
        <table class="widescreen-table">
          <thead>
            <tr>
              <th>{labels.numberLabel}</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Metodo</th>
              <th>Riferimento</th>
              <th class="text-right">Imponibile Netto</th>
              <th class="text-right">IVA</th>
              <th class="text-right">Totale Lordo</th>
              <th class="text-center">Stato</th>
              <th class="text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredPayments as payment (payment.id)}
              {@const badge = getStatusBadge(payment.status)}
              <tr>
                <td>
                  <a href="/dashboard/payments/{payment.id}" class="code-link">
                    <strong>{payment.paymentNumber}</strong>
                  </a>
                </td>
                <td>{formatDate(payment.paymentDate)}</td>
                <td>
                  <strong>{payment.clientName}</strong>
                </td>
                <td>
                  <span class="method-tag">{getMethodLabel(payment.method)}</span>
                </td>
                <td>
                  <span class="ref-text">{payment.transactionReference || '-'}</span>
                </td>
                <td class="text-right text-success font-medium">
                  € {payment.netAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-right text-warning">
                  € {payment.vatAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span class="vat-rate-mini">({payment.vatRate}%)</span>
                </td>
                <td class="text-right font-bold text-neutral-900">
                  € {payment.grossAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-center">
                  <span class="badge {badge.class}">{badge.label}</span>
                </td>
                <td class="text-right">
                  <div class="actions-cell">
                    <a href="/dashboard/payments/{payment.id}" class="btn-action" title="Visualizza Dettaglio">
                      <Eye size={15} />
                    </a>
                    <a href="/dashboard/payments/{payment.id}/edit" class="btn-action" title="Modifica Incasso">
                      <Pencil size={15} />
                    </a>
                    <button type="button" class="btn-action text-danger" title="Elimina Incasso" onclick={() => handleDelete(payment.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
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
  .payments-page { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0; color: var(--color-neutral-900); }
  .page-subtitle { font-size: 14px; color: var(--color-neutral-600); margin: 4px 0 0 0; }
  .header-actions { display: flex; gap: 10px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 10px; padding: 18px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
  .kpi-icon-box { width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #e0f2fe; color: #0284c7; }
  .kpi-net { background: #dcfce7; color: #16a34a; }
  .kpi-vat { background: #fef3c7; color: #d97706; }
  .kpi-gross { background: #f3e8ff; color: #9333ea; }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--color-neutral-900); }
  .kpi-label { font-size: 12px; color: var(--color-neutral-500); margin-top: 2px; }

  .toolbar-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .search-box { position: relative; flex: 1; min-width: 260px; }
  :global(.search-icon) { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-400); }
  .search-input { width: 100%; padding: 8px 12px 8px 34px; border: 1px solid var(--color-neutral-300); border-radius: 6px; font-size: 13.5px; box-sizing: border-box; }
  .filter-group { display: flex; gap: 8px; align-items: center; }
  .filter-select { padding: 7px 10px; border: 1px solid var(--color-neutral-300); border-radius: 6px; font-size: 13px; background: white; }

  .status-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 8px; }
  .tab-item { background: none; border: none; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--color-neutral-600); cursor: pointer; border-radius: 6px; }
  .tab-item.active { background: var(--color-neutral-900); color: white; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
  .table-wrapper { width: 100%; overflow-x: auto; }
  .widescreen-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .widescreen-table th { background: var(--color-neutral-50); padding: 12px 14px; text-align: left; font-weight: 600; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-200); }
  .widescreen-table td { padding: 12px 14px; border-bottom: 1px solid var(--color-neutral-200); color: var(--color-neutral-800); }
  .widescreen-table tr:hover { background: var(--color-neutral-50); }

  .code-link { color: var(--color-primary-600); text-decoration: none; }
  .code-link:hover { text-decoration: underline; }
  .method-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; background: var(--color-neutral-100); color: var(--color-neutral-700); font-weight: 500; }
  .ref-text { font-size: 12px; color: var(--color-neutral-500); font-family: monospace; }
  .vat-rate-mini { font-size: 11px; color: var(--color-neutral-400); margin-left: 2px; }

  .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11.5px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: var(--color-neutral-100); color: var(--color-neutral-600); }

  .actions-cell { display: flex; justify-content: flex-end; gap: 6px; }
  .btn-action { background: none; border: 1px solid var(--color-neutral-300); border-radius: 4px; padding: 4px 6px; cursor: pointer; color: var(--color-neutral-700); display: inline-flex; align-items: center; text-decoration: none; }
  .btn-action:hover { background: var(--color-neutral-100); }
  .text-danger { color: #dc2626; }
  .text-success { color: #16a34a; }
  .text-warning { color: #d97706; }
  .font-bold { font-weight: 700; }
  .font-medium { font-weight: 500; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }

  .empty-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 10px; padding: 50px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  :global(.empty-icon) { color: var(--color-neutral-400); }
  .empty-title { font-size: 16px; font-weight: 700; color: var(--color-neutral-800); margin: 0; }
  .empty-desc { font-size: 13.5px; color: var(--color-neutral-500); margin: 0; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }

  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-primary:hover { background: var(--color-primary-700); }
  .btn-secondary { background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
  .btn-sm { padding: 6px 10px; font-size: 12px; }
</style>
