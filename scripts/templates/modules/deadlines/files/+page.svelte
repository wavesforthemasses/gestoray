<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { DeadlinesService } from './deadlines.service';
  import { DeadlineSettingsService } from './deadlineSettingsService';
  import type { DeadlineEntry, DeadlineSettings, DeadlineCategory } from './schema';
  import { Card, StatusBadge, Button, EmptyState, PageHeader } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { 
    AlertTriangle, 
    Plus, 
    Search, 
    Eye, 
    Truck, 
    UserCheck, 
    FileText, 
    ShieldCheck, 
    Calendar,
    Clock
  } from '@lucide/svelte';

  let settings = $state<DeadlineSettings>({
    entityNaming: 'scadenzario',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'DDL-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva',
    defaultReminderDays: [30, 15, 7, 1],
    enablePushNotifications: false
  });

  let deadlines = $state<DeadlineEntry[]>([]);
  let loading = $state(true);
  let searchFilter = $state('');
  let categoryFilter = $state<string>('all');
  let statusFilter = $state<string>('all');

  let labels = $derived(DeadlineSettingsService.getLabels(settings));

  let filteredDeadlines = $derived(
    deadlines.filter(d => {
      const matchSearch = searchFilter === '' ||
        d.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (d.linkedEntityName || '').toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchCat = categoryFilter === 'all' || d.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    })
  );

  let upcomingCount = $derived.by(() => {
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return deadlines.filter(item => {
      if (item.status === 'archiviata' || item.status === 'rinnovata') return false;
      if (!item.expiryDate) return false;
      const exp = new Date(item.expiryDate);
      return exp >= now && exp <= next30Days;
    }).length;
  });

  let overdueCount = $derived.by(() => {
    const today = new Date().toISOString().slice(0, 10);
    return deadlines.filter(item => {
      if (item.status === 'archiviata' || item.status === 'rinnovata') return false;
      return item.expiryDate < today;
    }).length;
  });

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        DeadlineSettingsService.getSettings(),
        DeadlinesService.getDeadlines()
      ]);
      settings = s;
      deadlines = list;
      pageTitle.set(labels.plural);
    } catch (e) {
      console.error('Errore caricamento scadenze:', e);
    } finally {
      loading = false;
    }
  });

  function getCategoryInfo(cat: DeadlineCategory) {
    switch (cat) {
      case 'vehicle_inspection': return { label: 'Revisione Mezzo', Icon: Truck, color: '#B45309' };
      case 'vehicle_tax': return { label: 'Bollo Mezzo', Icon: Truck, color: '#B45309' };
      case 'vehicle_insurance': return { label: 'Assicurazione', Icon: ShieldCheck, color: '#047857' };
      case 'medical_checkup': return { label: 'Visita Medica', Icon: UserCheck, color: 'var(--color-primary-600)' };
      case 'safety_course': return { label: 'Corso Sicurezza', Icon: ShieldCheck, color: '#4F46E5' };
      case 'contract_expiry': return { label: 'Scadenza Contratto', Icon: FileText, color: '#0284C7' };
      case 'certification': return { label: 'Certificazione', Icon: ShieldCheck, color: '#7C3AED' };
      default: return { label: 'Personalizzato', Icon: AlertTriangle, color: 'var(--color-neutral-600)' };
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'attiva': return 'Attiva';
      case 'in_scadenza': return 'In Scadenza';
      case 'scaduta': return 'SCADUTA';
      case 'rinnovata': return 'Rinnovata';
      case 'archiviata': return 'Archiviata';
      default: return status;
    }
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="deadlines-page-container">
  <PageHeader 
    icon={AlertTriangle} 
    title={labels.plural} 
    subtitle="Monitoraggio allarmi ed avvisi di scadenza per mezzi, persone, contratti e corsi."
  >
    {#snippet actions()}
      <a href="/dashboard/deadlines/add" class="btn-create">
        <Plus size={18} />
        <span>{labels.newBtn}</span>
      </a>
    {/snippet}
  </PageHeader>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <Card class="stat-card">
      <div class="kpi-card-content">
        <div class="kpi-icon-wrapper active">
          <AlertTriangle size={20} />
        </div>
        <div class="kpi-text">
          <span class="kpi-label">Scadenze Imminenti (30 giorni)</span>
          <span class="kpi-value text-warning">{upcomingCount}</span>
        </div>
      </div>
    </Card>

    <Card class="stat-card">
      <div class="kpi-card-content">
        <div class="kpi-icon-wrapper danger">
          <Clock size={20} />
        </div>
        <div class="kpi-text">
          <span class="kpi-label">Scadenze Scadute</span>
          <span class="kpi-value text-danger">{overdueCount}</span>
        </div>
      </div>
    </Card>
  </div>

  <!-- TOOLBAR FILTRI -->
  <div class="toolbar-box">
    <div class="search-input-box">
      <Search size={18} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca per codice, titolo o entità collegata..." 
        bind:value={searchFilter} 
        class="search-input"
      />
    </div>

    <div class="filters-box">
      <select bind:value={categoryFilter} class="filter-select">
        <option value="all">Tutte le categorie</option>
        <option value="vehicle_inspection">Revisione Mezzo</option>
        <option value="vehicle_tax">Bollo Mezzo</option>
        <option value="vehicle_insurance">Assicurazione</option>
        <option value="medical_checkup">Visita Medica</option>
        <option value="safety_course">Corso Sicurezza</option>
        <option value="contract_expiry">Scadenza Contratto</option>
        <option value="certification">Certificazione</option>
        <option value="custom">Personalizzato</option>
      </select>

      <select bind:value={statusFilter} class="filter-select">
        <option value="all">Tutti gli stati</option>
        <option value="attiva">Attiva</option>
        <option value="in_scadenza">In Scadenza</option>
        <option value="scaduta">Scaduta</option>
        <option value="rinnovata">Rinnovata</option>
        <option value="archiviata">Archiviata</option>
      </select>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">Caricamento scadenze in corso...</div>
  {:else if filteredDeadlines.length === 0}
    <EmptyState 
      icon={AlertTriangle} 
      title={`Nessuna ${labels.singular.toLowerCase()} trovata`}
      subtitle="Non ci sono avvisi o allarmi corrispondenti ai filtri impostati."
    >
      <a href="/dashboard/deadlines/add" class="btn-create-secondary">
        <Plus size={16} />
        <span>Crea {labels.singular.toLowerCase()}</span>
      </a>
    </EmptyState>
  {:else}
    <Card class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Codice</th>
            <th>Oggetto / Scadenza</th>
            <th>Categoria</th>
            <th>Entità Collegata</th>
            <th>Data Scadenza</th>
            <th>Stato</th>
            <th class="text-right">Azione</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredDeadlines as item (item.id)}
            {@const catInfo = getCategoryInfo(item.category)}
            {@const CatIcon = catInfo.Icon}
            <tr>
              <td class="font-mono font-bold">{item.code}</td>
              <td class="font-semibold">{item.title}</td>
              <td>
                <span class="category-chip" style="color: {catInfo.color}; background: {catInfo.color}15;">
                  <CatIcon size={13} />
                  <span>{catInfo.label}</span>
                </span>
              </td>
              <td>
                {#if item.linkedEntityName}
                  <span class="linked-name">{item.linkedEntityName}</span>
                {:else}
                  <span class="text-muted">-</span>
                {/if}
              </td>
              <td class="font-semibold">{item.expiryDate}</td>
              <td>
                <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
              </td>
              <td class="text-right">
                <a href={`/dashboard/deadlines/${item.id}`} class="btn-icon" title="Vedi dettaglio">
                  <Eye size={18} />
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card>
  {/if}
</div>

<style>
  .deadlines-page-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }
  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--color-primary-600);
    color: white;
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-md);
    text-decoration: none;
  }
  .btn-create-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-md);
    text-decoration: none;
    margin-top: 10px;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .kpi-card-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .kpi-icon-wrapper {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kpi-icon-wrapper.active { background: #FFFBEB; color: #D97706; }
  .kpi-icon-wrapper.danger { background: #FEF2F2; color: #DC2626; }
  .kpi-text { display: flex; flex-direction: column; }
  .kpi-label { font-size: 12px; color: var(--color-neutral-500); font-weight: 500; }
  .kpi-value { font-size: 20px; font-weight: 700; }
  .text-warning { color: #D97706; }
  .text-danger { color: #DC2626; }
  .toolbar-box {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .search-input-box {
    position: relative;
    flex: 1;
  }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400);
  }
  .search-input {
    width: 100%;
    padding: 10px 12px 10px 38px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: white;
  }
  .filters-box {
    display: flex;
    gap: 10px;
  }
  .filter-select {
    padding: 10px 14px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 13px;
    background: white;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table th, .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-100);
  }
  .data-table th {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
  }
  .category-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .linked-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-neutral-800);
  }
  .btn-icon {
    color: var(--color-neutral-500);
    padding: 6px;
    border-radius: var(--radius-md);
    display: inline-flex;
  }
  .btn-icon:hover { background: var(--color-neutral-100); color: var(--color-primary-600); }
  .loading-state {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
  }
  .font-mono { font-family: monospace; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
  .text-muted { color: var(--color-neutral-400); font-size: 13px; }
</style>
