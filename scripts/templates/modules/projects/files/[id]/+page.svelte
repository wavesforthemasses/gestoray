<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ProjectsService } from '../projects.service';
  import { ProjectSettingsService } from '../projectSettingsService';
  import type { ProjectItem, ProjectStatus, ProjectSettings, ProjectAddress } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { Card, Button, StatusBadge } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import { 
    FolderKanban, 
    List, 
    User, 
    Calendar, 
    Clock,
    FileText, 
    Trash2, 
    DollarSign,
    MapPin,
    Navigation,
    ExternalLink,
    Pencil
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
        const meta = mod.bridgeMetadata || mod.default?.bridgeMetadata || {};
        let defaultLabel = 'Tab Collegata';
        if (path.includes('Contract')) defaultLabel = 'Preventivi & Contratti';
        if (path.includes('Interventi')) defaultLabel = 'Interventi & Rapportini';
        if (path.includes('Ticket')) defaultLabel = 'Ticket & Supporto';
        return {
          id: meta.id || path.split('/').pop()?.replace('.svelte', '').toLowerCase() || 'tab',
          sourceModule: meta.sourceModule || (path.includes('Contract') ? 'contracts' : ''),
          label: meta.label || defaultLabel,
          component: mod.default
        };
      })
      .filter(t => {
        if (!t.sourceModule) return true;
        if ($menuConfigStore.length === 0) return true;
        return activeModuleIds.has(t.sourceModule);
      })
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
    const confirmed = await confirmStore.prompt(`Sei sicuro di voler eliminare definitivamente il ${labels.singular.toLowerCase()} ${project.code}?`);
    if (!confirmed) return;
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

  function getFullAddress(addr?: ProjectAddress): string {
    if (!addr) return '';
    const parts = [addr.street, addr.zip, addr.city, addr.province ? `(${addr.province.toUpperCase()})` : ''].filter(Boolean);
    return parts.join(' ');
  }

  function getGoogleMapsUrl(addr?: ProjectAddress): string {
    const full = getFullAddress(addr);
    if (!full) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
  }

  function getMapEmbedUrl(addr?: ProjectAddress): string {
    const full = getFullAddress(addr);
    if (!full) return '';
    return `https://maps.google.com/maps?q=${encodeURIComponent(full)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  }
</script>

<svelte:head>
  <title>{project ? `${project.code} - ${project.name}` : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="project-detail-container">
  <div class="top-nav-bar">
    <a href="/dashboard/projects" class="btn-module-list" title="Vai all'elenco {labels.plural}" aria-label="Vai all'elenco {labels.plural}">
      <List size={20} />
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
          <p class="project-client-name">Cliente Intestatario: <strong>{project.clientName || 'Nessuno'}</strong></p>
        </div>
      </div>

      <div class="header-actions">
        <a href="/dashboard/projects/{project.id}/edit" class="btn-secondary-action">
          <Pencil size={15} /> Modifica {labels.singular}
        </a>
        <button class="btn-danger-action" onclick={handleDelete}>
          <Trash2 size={15} /> Elimina {labels.singular}
        </button>
      </div>
    </header>

    <div class="metrics-row">
      <div class="metric-card">
        <span class="metric-label">Avanzamento Lavori</span>
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
        <span class="metric-label">Stato {labels.singular}</span>
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
        Panoramica & Ubicazione
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
          <!-- Card 1: Dati Operativi -->
          <div class="info-card-block">
            <div class="card-header-row">
              <div class="header-icon-badge">
                <Calendar size={18} />
              </div>
              <div class="header-text-group">
                <h3 class="card-section-title">Dati Operativi & Tempistiche</h3>
                <span class="card-section-subtitle">Date chiave e note del contenitore</span>
              </div>
            </div>

            <div class="info-details-list">
              <div class="info-item">
                <span class="info-item-label"><User size={14} /> Cliente Intestatario</span>
                <span class="info-item-value">{project.clientName || 'Nessun cliente associato'}</span>
              </div>

              <div class="info-item">
                <span class="info-item-label"><Clock size={14} /> Data Inizio Lavori</span>
                <span class="info-item-value">{project.startDate || 'Non specificata'}</span>
              </div>

              <div class="info-item">
                <span class="info-item-label"><Calendar size={14} /> Data Fine Prevista</span>
                <span class="info-item-value">{project.endDate || 'Non specificata'}</span>
              </div>

              <div class="info-item full-width">
                <span class="info-item-label"><FileText size={14} /> Note & Istruzioni Cantiere</span>
                <p class="info-item-text">{project.notes || 'Nessuna nota presente per questo contenitore.'}</p>
              </div>
            </div>
          </div>

          <!-- Card 2: Ubicazione Cantiere & Mappe -->
          <div class="info-card-block">
            <div class="card-header-row">
              <div class="header-icon-badge accent-map">
                <MapPin size={18} />
              </div>
              <div class="header-text-group">
                <h3 class="card-section-title">Ubicazione & Mappa {labels.singular}</h3>
                <span class="card-section-subtitle">Indirizzo cantiere e geolocalizzazione stradale</span>
              </div>
            </div>

            {#if getFullAddress(project.address)}
              <div class="location-box">
                <div class="address-display-bar">
                  <div class="address-text-group">
                    <span class="address-main">{project.address?.street || 'Indirizzo non specificato'}</span>
                    <span class="address-sub">{project.address?.zip || ''} {project.address?.city || ''} {project.address?.province ? `(${project.address.province.toUpperCase()})` : ''}</span>
                  </div>
                  <a 
                    href={getGoogleMapsUrl(project.address)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    class="btn-maps-action"
                    title="Apri indicazioni stradali su Google Maps"
                  >
                    <Navigation size={15} />
                    <span>Mappe & Navigatore</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div class="map-embed-container">
                  <iframe
                    title="Mappa Cantiere"
                    width="100%"
                    height="210"
                    frameborder="0"
                    scrolling="no"
                    marginheight="0"
                    marginwidth="0"
                    src={getMapEmbedUrl(project.address)}
                    class="map-iframe"
                  ></iframe>
                </div>
              </div>
            {:else}
              <div class="empty-address-placeholder">
                <div class="empty-icon-circle">
                  <MapPin size={28} />
                </div>
                <h4 class="empty-addr-title">Nessun Indirizzo Specificato</h4>
                <p class="empty-addr-sub">Inserisci l'indirizzo del {labels.singular.toLowerCase()} (via, città e provincia) per attivare la mappa interattiva e le indicazioni stradali.</p>
              </div>
            {/if}
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
  .project-detail-container { padding: 24px; width: 100%; max-width: none; }
  .top-nav-bar { margin-bottom: 16px; }
  .back-link { display: flex; align-items: center; gap: 6px; color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 500; }
  .back-link:hover { color: var(--color-primary-600); }
  
  .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .header-main-box { display: flex; align-items: center; gap: 16px; }
  .project-icon-badge { width: 52px; height: 52px; border-radius: 12px; background: var(--color-primary-50); display: flex; align-items: center; justify-content: center; }
  .code-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .code-badge { font-family: monospace; font-weight: 700; font-size: 12px; color: var(--color-primary-700); background: var(--color-primary-50); padding: 2px 6px; border-radius: 4px; }
  .status-chip { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: var(--color-neutral-100); }

  .project-title { font-size: 22px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 2px 0; }
  .project-client-name { font-size: 13px; color: var(--color-neutral-600); margin: 0; }

  .header-actions { display: flex; align-items: center; gap: 10px; }
  .btn-secondary-action { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--color-neutral-300); background: white; color: var(--color-neutral-700); font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .btn-secondary-action:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-400); color: var(--color-neutral-900); }
  .btn-danger-action { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid #fee2e2; background: #fff5f5; color: #dc2626; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
  .btn-danger-action:hover { background: #fee2e2; }

  .metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .metric-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
  .metric-label { font-size: 12px; font-weight: 600; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.03em; }
  .metric-val { font-size: 18px; font-weight: 700; color: var(--color-neutral-900); }

  .progress-edit-row { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
  .range-input { flex: 1; height: 6px; accent-color: var(--color-primary-600); cursor: pointer; }
  .status-select { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-neutral-300); font-size: 14px; font-weight: 600; background: white; margin-top: 2px; }

  .tabs-nav-bar { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--color-neutral-200); margin-bottom: 20px; }
  .tab-btn { padding: 10px 16px; border: none; background: none; font-size: 14px; font-weight: 600; color: var(--color-neutral-600); border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s ease; }
  .tab-btn:hover { color: var(--color-primary-600); }
  .tab-btn.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); }

  .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .info-card-block { background: white; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }

  .card-header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px dashed var(--color-neutral-200); }
  .header-icon-badge { width: 38px; height: 38px; border-radius: 10px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; }
  .header-icon-badge.accent-map { background: #e0e7ff; color: #3730a3; }
  .header-text-group { display: flex; flex-direction: column; }
  .card-section-title { font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0; }
  .card-section-subtitle { font-size: 12px; color: var(--color-neutral-500); }

  .info-details-list { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .info-item { display: flex; flex-direction: column; gap: 4px; }
  .info-item.full-width { grid-column: span 2; margin-top: 6px; }
  .info-item-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--color-neutral-500); }
  .info-item-value { font-size: 14px; font-weight: 600; color: var(--color-neutral-800); }
  .info-item-text { font-size: 13px; color: var(--color-neutral-700); margin: 2px 0 0 0; line-height: 1.5; background: var(--color-neutral-50); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--color-neutral-200); }

  .location-box { display: flex; flex-direction: column; gap: 14px; }
  .address-display-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--color-neutral-50); padding: 12px 14px; border-radius: 10px; border: 1px solid var(--color-neutral-200); }
  .address-text-group { display: flex; flex-direction: column; }
  .address-main { font-size: 14px; font-weight: 700; color: var(--color-neutral-900); }
  .address-sub { font-size: 12px; color: var(--color-neutral-600); }

  .btn-maps-action { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; background: #4f46e5; color: white; font-size: 12px; font-weight: 600; text-decoration: none; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.2); }
  .btn-maps-action:hover { background: #4338ca; transform: translateY(-1px); }

  .map-embed-container { width: 100%; border-radius: 10px; overflow: hidden; border: 1px solid var(--color-neutral-200); box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
  .map-iframe { display: block; width: 100%; }

  .empty-address-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 16px; text-align: center; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 10px; }
  .empty-icon-circle { width: 52px; height: 52px; border-radius: 50%; background: var(--color-neutral-200); display: flex; align-items: center; justify-content: center; color: var(--color-neutral-500); margin-bottom: 10px; }
  .empty-addr-title { font-size: 14px; font-weight: 700; color: var(--color-neutral-800); margin: 0 0 4px 0; }
  .empty-addr-sub { font-size: 12px; color: var(--color-neutral-500); margin: 0; max-width: 320px; }

  @media (max-width: 900px) {
    .overview-grid { grid-template-columns: 1fr; }
    .metrics-row { grid-template-columns: 1fr; }
  }
</style>
