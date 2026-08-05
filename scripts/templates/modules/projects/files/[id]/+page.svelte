<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ProjectsService } from '../projects.service';
  import { ProjectSettingsService } from '../projectSettingsService';
  import type { ProjectItem, ProjectStatus, ProjectSettings } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, Button, StatusBadge } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import { 
    FolderKanban, 
    ArrowLeft, 
    User, 
    Calendar, 
    TrendingUp, 
    FileText, 
    Trash2, 
    DollarSign
  } from '@lucide/svelte';

  const projectId = $page.params.id || '';

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
  let labels = $derived(ProjectSettingsService.getLabels(settings));

  let project = $state<ProjectItem | null>(null);
  let loading = $state(true);
  let activeTab = $state<'overview' | string>('overview');

  // Dynamic Bridge Tabs Discovery (WordPress/Drupal Hook Pattern)
  const globTabs = import.meta.glob('../projects-tabs/*.svelte', { eager: true });
  const activeModuleIds = $derived(new Set($menuConfigStore.map(m => m.id)));

  // Available Bridge Sub-Tabs registered by installed modules
  const installedBridgeTabs = $derived(
    Object.entries(globTabs)
      .map(([path, mod]: [string, any]) => {
        const meta = mod.bridgeMetadata || {};
        return {
          id: meta.id || path.split('/').pop()?.replace('.svelte', ''),
          sourceModule: meta.sourceModule || '',
          label: meta.label || 'Tab Collegata',
          component: mod.default
        };
      })
      .filter(t => !t.sourceModule || activeModuleIds.has(t.sourceModule))
  );

  onMount(async () => {
    try {
      const [s, item] = await Promise.all([
        ProjectSettingsService.getSettings(),
        ProjectsService.getProjectById(projectId)
      ]);
      settings = s;
      project = item;
      if (item) {
        pageTitle.set(`${labels.singular} ${item.code}`);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio progetto:', e);
    } finally {
      loading = false;
    }
  });

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (!project) return;
    try {
      await ProjectsService.updateProject(project.id!, { status: newStatus });
      project.status = newStatus;
      toast.success(`Stato ${labels.singular.toLowerCase()} aggiornato in "${newStatus}".`);
    } catch (e: any) {
      toast.error('Errore aggiornamento stato: ' + e.message);
    }
  }

  async function handleProgressChange(newProgress: number) {
    if (!project) return;
    try {
      await ProjectsService.updateProject(project.id!, { progress: newProgress });
      project.progress = newProgress;
      toast.success('Avanzamento lavori aggiornato.');
    } catch (e: any) {
      toast.error('Errore aggiornamento avanzamento: ' + e.message);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il ${labels.singular.toLowerCase()} ${project.code}?`)) return;
    try {
      await ProjectsService.deleteProject(project.id!);
      toast.success(`${labels.singular} eliminato.`);
      goto('/dashboard/projects');
    } catch (e: any) {
      toast.error('Errore eliminazione: ' + e.message);
    }
  }

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<svelte:head>
  <title>{project ? `${project.code} - ${project.name}` : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="project-detail-container">
  <div class="top-nav-bar">
    <a href="/dashboard/projects" class="back-link">
      <ArrowLeft size={16} /> Torna all'Elenco {labels.plural}
    </a>
  </div>

  {#if loading}
    <div class="loading-box">
      <p>Caricamento scheda {labels.singular.toLowerCase()}...</p>
    </div>
  {:else if !project}
    <div class="error-box">
      <h3>{labels.singular} non trovato</h3>
      <p>Il contenitore di progetto richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/projects" class="btn-primary-action">Torna all'Elenco</a>
    </div>
  {:else}
    <header class="detail-header">
      <div class="header-main-box">
        <div class="project-icon-badge">
          <FolderKanban size={28} color="var(--color-primary-500)" />
        </div>
        <div>
          <div class="code-row">
            <span class="code-badge">{project.code}</span>
            <span class="status-chip {project.status}">{project.status}</span>
          </div>
          <h1 class="project-title">{project.name}</h1>
          <p class="project-client-name">Cliente: <strong>{project.clientName || 'Nessuno'}</strong></p>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn-danger-action" onclick={handleDelete}>
          <Trash2 size={16} /> Elimina
        </button>
      </div>
    </header>

    <div class="metrics-row">
      <div class="metric-card">
        <span class="metric-label">Avanzamento</span>
        <div class="progress-edit-row">
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="5" 
            value={project.progress || 0} 
            onchange={(e: any) => handleProgressChange(Number(e.target.value))}
            class="range-input" 
          />
          <span class="metric-val">{project.progress || 0}%</span>
        </div>
      </div>

      <div class="metric-card">
        <span class="metric-label">Importo Stimato</span>
        <span class="metric-val">{formatCurrency(project.estimatedAmount)}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Cambia Stato</span>
        <select 
          value={project.status} 
          onchange={(e: any) => handleStatusChange(e.target.value)}
          class="status-select"
        >
          <option value="fase_contrattuale">Fase Contrattuale</option>
          <option value="aperto">Aperto / In Corso</option>
          <option value="in_pausa">In Pausa</option>
          <option value="completato">Completato</option>
        </select>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav-bar">
      <button 
        class="tab-btn {activeTab === 'overview' ? 'active' : ''}" 
        onclick={() => activeTab = 'overview'}
      >
        Panoramica & Note
      </button>

      {#each installedBridgeTabs as tab}
        <button 
          class="tab-btn {activeTab === tab.id ? 'active' : ''}" 
          onclick={() => activeTab = tab.id}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="tab-content-area">
      {#if activeTab === 'overview'}
        <div class="overview-grid">
          <div class="info-card">
            <h3>Dati Generali</h3>
            <p><strong>Data Inizio:</strong> {project.startDate || '-'}</p>
            <p><strong>Data Fine Prevista:</strong> {project.endDate || '-'}</p>
            <p><strong>Note:</strong> {project.notes || 'Nessuna nota presente.'}</p>
          </div>
        </div>
      {:else}
        {#each installedBridgeTabs as tab}
          {#if activeTab === tab.id}
            {@const Component = tab.component}
            <Component projectId={project.id} clientId={project.clientId} />
          {/if}
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .project-detail-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
  .top-nav-bar { margin-bottom: 16px; }
  .back-link { display: flex; align-items: center; gap: 6px; color: var(--color-neutral-600); text-decoration: none; font-size: 13px; }
  .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .header-main-box { display: flex; align-items: center; gap: 16px; }
  .project-icon-badge { width: 52px; height: 52px; border-radius: 12px; background: var(--color-primary-50); display: flex; align-items: center; justify-content: center; }
  .code-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .code-badge { font-family: monospace; font-weight: 700; font-size: 12px; color: var(--color-primary-700); background: var(--color-primary-50); padding: 2px 6px; border-radius: 4px; }
  .status-chip { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: var(--color-neutral-100); }
  .project-title { font-size: 24px; font-weight: 700; margin: 0; }
  .project-client-name { font-size: 14px; color: var(--color-neutral-600); margin: 4px 0 0 0; }
  .metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .metric-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 10px; padding: 16px; }
  .metric-label { font-size: 12px; color: var(--color-neutral-500); display: block; margin-bottom: 6px; }
  .metric-val { font-size: 18px; font-weight: 700; }
  .progress-edit-row { display: flex; align-items: center; gap: 10px; }
  .range-input { flex: 1; }
  .status-select { width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--color-neutral-300); font-size: 13px; }
  .tabs-nav-bar { display: flex; gap: 8px; border-bottom: 2px solid var(--color-neutral-200); margin-bottom: 20px; }
  .tab-btn { padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; font-weight: 600; font-size: 14px; cursor: pointer; color: var(--color-neutral-600); margin-bottom: -2px; }
  .tab-btn.active { border-bottom-color: var(--color-primary-600); color: var(--color-primary-600); }
  .tab-content-area { background: white; border-radius: 12px; border: 1px solid var(--color-neutral-200); padding: 20px; }
  .btn-danger-action { display: flex; align-items: center; gap: 6px; background: var(--color-error-50); color: var(--color-error-700); border: 1px solid var(--color-error-200); padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; }
</style>
