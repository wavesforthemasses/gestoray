<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { ProjectsService } from './projects.service';
  import { ProjectSettingsService } from './projectSettingsService';
  import type { ProjectItem, ProjectSettings } from './schema';
  import { Card, Button, StatusBadge } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { 
    FolderKanban, 
    Plus, 
    Search, 
    TrendingUp, 
    User, 
    Calendar, 
    DollarSign,
    CheckCircle2,
    Clock,
    Eye
  } from '@lucide/svelte';

  let settings = $state<ProjectSettings>({
    entityNaming: 'progetto',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'PROG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'fase_contrattuale'
  });

  let projects = $state<ProjectItem[]>([]);
  let loading = $state(true);
  let searchFilter = $state('');
  let statusFilter = $state<string>('all');

  let labels = $derived(ProjectSettingsService.getLabels(settings));

  let filteredProjects = $derived(
    projects.filter(p => {
      const matchSearch = searchFilter === '' || 
        p.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.clientName || '').toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    })
  );

  let activeProjectsCount = $derived(
    projects.filter(p => p.status === 'aperto' || p.status === 'fase_contrattuale').length
  );

  let totalPortfolioValue = $derived(
    projects.reduce((sum, p) => sum + (p.estimatedAmount || 0), 0)
  );

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        ProjectSettingsService.getSettings(),
        ProjectsService.getProjects()
      ]);
      settings = s;
      projects = list;
      pageTitle.set(labels.plural);
    } catch (e) {
      console.error('Errore caricamento progetti:', e);
    } finally {
      loading = false;
    }
  });

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="projects-page-container">
  <header class="page-header">
    <div class="header-title-box">
      <div class="header-icon">
        <FolderKanban size={26} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.plural}</h1>
        <p class="page-main-subtitle">Gestione agnostica dei contenitori di progetto, commesse ed avanzamento lavori.</p>
      </div>
    </div>

    <a href="/dashboard/projects/add" class="btn-create-project">
      <Plus size={18} />
      <span>{labels.newBtn}</span>
    </a>
  </header>

  <div class="stats-overview-grid">
    <Card class="stat-card">
      <div class="stat-content">
        <div class="stat-icon-bg primary">
          <FolderKanban size={20} color="var(--color-primary-600)" />
        </div>
        <div>
          <span class="stat-label">{labels.plural} Attivi</span>
          <span class="stat-value">{activeProjectsCount}</span>
        </div>
      </div>
    </Card>

    <Card class="stat-card">
      <div class="stat-content">
        <div class="stat-icon-bg success">
          <DollarSign size={20} color="var(--color-success-600)" />
        </div>
        <div>
          <span class="stat-label">Portafoglio Lavori</span>
          <span class="stat-value">{formatCurrency(totalPortfolioValue)}</span>
        </div>
      </div>
    </Card>
  </div>

  <div class="filters-bar">
    <div class="search-input-box">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        bind:value={searchFilter} 
        placeholder="Cerca per codice, nome o cliente..." 
        class="search-field"
      />
    </div>

    <div class="status-filter-select">
      <select bind:value={statusFilter} class="filter-select">
        <option value="all">Tutti gli stati</option>
        <option value="fase_contrattuale">Fase Contrattuale</option>
        <option value="aperto">Aperto / In Corso</option>
        <option value="in_pausa">In Pausa</option>
        <option value="completato">Completato</option>
      </select>
    </div>
  </div>

  {#if loading}
    <div class="loading-box">
      <p>Caricamento elenco {labels.plural.toLowerCase()}...</p>
    </div>
  {:else if filteredProjects.length === 0}
    <div class="empty-projects-card">
      <FolderKanban size={48} color="var(--color-neutral-400)" />
      <h3>Nessun {labels.singular.toLowerCase()} trovato</h3>
      <p>Non ci sono {labels.plural.toLowerCase()} corrispondenti ai filtri di ricerca selezionati.</p>
      <a href="/dashboard/projects/add" class="btn-create-project-empty">
        <Plus size={16} /> {labels.newBtn}
      </a>
    </div>
  {:else}
    <div class="projects-table-box">
      <table class="projects-table">
        <thead>
          <tr>
            <th>CODICE</th>
            <th>DENOMINAZIONE</th>
            <th>CLIENTE</th>
            <th>STATO</th>
            <th>AVANZAMENTO</th>
            <th>IMPORTO STIMATO</th>
            <th class="text-right">AZIONI</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProjects as item}
            <tr>
              <td class="font-mono font-bold">
                <a href="/dashboard/projects/{item.id}" class="code-link">{item.code}</a>
              </td>
              <td class="font-semibold">{item.name}</td>
              <td>{item.clientName || '-'}</td>
              <td>
                <span class="status-chip {item.status}">{item.status}</span>
              </td>
              <td>
                <div class="progress-bar-container">
                  <div class="progress-fill" style="width: {item.progress || 0}%"></div>
                  <span class="progress-text">{item.progress || 0}%</span>
                </div>
              </td>
              <td class="font-bold">{formatCurrency(item.estimatedAmount)}</td>
              <td class="text-right">
                <a href="/dashboard/projects/{item.id}" class="action-btn" title="Dettaglio">
                  <Eye size={16} />
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .projects-page-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-main-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900);
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .btn-create-project {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
  }
  .stats-overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .stat-icon-bg {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stat-icon-bg.primary { background: var(--color-primary-50); }
  .stat-icon-bg.success { background: var(--color-success-50); }
  .stat-label {
    display: block;
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .filters-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
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
  .search-field {
    width: 100%;
    padding: 10px 12px 10px 36px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
  }
  .filter-select {
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
    background: white;
  }
  .projects-table-box {
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200);
    overflow-x: auto;
  }
  .projects-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .projects-table th {
    text-align: left;
    padding: 12px 16px;
    background: var(--color-neutral-50);
    color: var(--color-neutral-600);
    font-size: 12px;
    font-weight: 600;
  }
  .projects-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .code-link {
    color: var(--color-primary-600);
    text-decoration: none;
  }
  .status-chip {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    background: var(--color-neutral-100);
  }
  .progress-bar-container {
    position: relative;
    width: 100px;
    height: 16px;
    background: var(--color-neutral-200);
    border-radius: 8px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--color-primary-500);
  }
  .progress-text {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }
  .empty-projects-card {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200);
  }
</style>
