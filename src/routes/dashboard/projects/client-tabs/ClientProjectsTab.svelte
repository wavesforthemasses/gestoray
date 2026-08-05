<script lang="ts">
  import { onMount } from 'svelte';
  import { ProjectsService } from '../projects.service';
  import { ProjectSettingsService } from '../projectSettingsService';
  import type { ProjectItem, ProjectSettings } from '../schema';
  import { FolderKanban, Plus, Eye } from '@lucide/svelte';

  let { clientId }: { clientId: string } = $props();

  let projects = $state<ProjectItem[]>([]);
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

  let loading = $state(true);

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        ProjectSettingsService.getSettings(),
        ProjectsService.getProjects(clientId)
      ]);
      settings = s;
      projects = list;
    } catch (e) {
      console.error('Errore caricamento progetti cliente:', e);
    } finally {
      loading = false;
    }
  });

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<div class="client-projects-tab">
  <div class="tab-header-row">
    <h4><FolderKanban size={18} /> {labels.plural} del Cliente ({projects.length})</h4>
    <a href="/dashboard/projects/add?clientId={clientId}" class="btn-sm-action">
      <Plus size={14} /> {labels.newBtn}
    </a>
  </div>

  {#if loading}
    <p class="loading-text">Caricamento {labels.plural.toLowerCase()}...</p>
  {:else if projects.length === 0}
    <div class="empty-state">
      <FolderKanban size={32} color="var(--color-neutral-400)" />
      <p>Nessun {labels.singular.toLowerCase()} associato a questo cliente.</p>
    </div>
  {:else}
    <div class="projects-list">
      {#each projects as item}
        <div class="project-item-card">
          <div class="card-main-info">
            <span class="project-code">{item.code}</span>
            <h5 class="project-name">{item.name}</h5>
            <span class="project-status-chip {item.status}">{item.status}</span>
          </div>

          <div class="card-meta-info">
            <span class="progress-badge">Avanzamento: {item.progress || 0}%</span>
            <span class="amount-badge">{formatCurrency(item.estimatedAmount)}</span>
            <a href="/dashboard/projects/{item.id}" class="view-btn" title="Dettaglio">
              <Eye size={16} />
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .client-projects-tab {
    padding: 12px 0;
  }
  .tab-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .tab-header-row h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
  }
  .btn-sm-action {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-600);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
    font-size: 12px;
    font-weight: 600;
  }
  .empty-state {
    text-align: center;
    padding: 30px;
    color: var(--color-neutral-500);
  }
  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .project-item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: 8px;
    padding: 12px 16px;
  }
  .card-main-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .project-code {
    font-family: monospace;
    font-weight: 700;
    color: var(--color-primary-700);
    font-size: 12px;
  }
  .project-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .project-status-chip {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-100);
  }
  .card-meta-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .progress-badge {
    font-size: 12px;
    color: var(--color-neutral-600);
  }
  .amount-badge {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .view-btn {
    color: var(--color-neutral-600);
    padding: 4px;
  }
</style>
