<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { menuConfigStore } from '$lib/stores/menu';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { TeamsService } from '../teams.service';
  import { TeamSettingsService } from '../teamSettingsService';
  import type { TeamItem, TeamSettings } from '../schema';
  import { Card, StatusBadge, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { 
    Users, 
    List, 
    Edit3, 
    Trash2, 
    UserCheck, 
    Truck, 
    Calendar, 
    Crown, 
    ClipboardList, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    ExternalLink,
    MapPin,
    BarChart3,
    FileText
  } from '@lucide/svelte';

  let teamId = $derived($page.params.id || '');
  let team = $state<TeamItem | null>(null);
  let settings = $state<TeamSettings>({
    entityNaming: 'squadra',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'SQD-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva'
  });

  let activeTab = $state<'overview' | 'members' | 'activities'>('overview');
  let loading = $state(true);
  let deleting = $state(false);

  // Activities linked to this team
  let teamActivities = $state<any[]>([]);
  let loadingActivities = $state(false);

  let labels = $derived(TeamSettingsService.getLabels(settings));
  let hasActivitiesModule = $derived($menuConfigStore.some(m => m.id === 'activities'));

  onMount(async () => {
    try {
      if (!teamId) return;
      const [s, data] = await Promise.all([
        TeamSettingsService.getSettings(),
        TeamsService.getTeamById(teamId)
      ]);
      settings = s;
      team = data;
      if (data) {
        pageTitle.set(`${data.code} - ${data.name}`);
        loadTeamActivities();
      }
    } catch (e) {
      console.error('[TeamsDetail] Errore caricamento:', e);
      toast.error('Impossibile caricare il dettaglio');
    } finally {
      loading = false;
    }
  });

  async function loadTeamActivities() {
    if (!hasActivitiesModule || !teamId) return;
    loadingActivities = true;
    try {
      // Dynamic import to keep pure plugin architecture
      // @ts-ignore
      const mod = await import('../../activities/activities.service');
      if (mod?.ActivitiesService) {
        // Query using zero-expansion filter key
        const list = await mod.ActivitiesService.getActivities({
          assigneeFilterKey: `team:${teamId}`
        });
        teamActivities = list;
      }
    } catch (e) {
      console.warn('[TeamsDetail] Impossibile caricare attività collegate:', e);
    } finally {
      loadingActivities = false;
    }
  }

  async function handleDelete() {
    if (!team) return;
    const confirmed = await confirmStore.prompt(`Sei sicuro di voler eliminare questa ${labels.singular.toLowerCase()}?`);
    if (!confirmed) return;

    deleting = true;
    try {
      await TeamsService.deleteTeam(team.id);
      toast.success(`${labels.singular} eliminata con successo`);
      goto('/dashboard/teams');
    } catch (e) {
      console.error('[TeamsDetail] Errore eliminazione squadra:', e);
      toast.error('Errore durante l\'eliminazione');
    } finally {
      deleting = false;
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'attiva': return 'Attiva';
      case 'in_servizio': return 'In Servizio';
      case 'inattiva': return 'Inattiva';
      default: return status;
    }
  }
</script>

<svelte:head>
  <title>{team ? `${team.code} - ${team.name}` : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="team-detail-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Caricamento dettagli...</p>
    </div>
  {:else if !team}
    <Card class="empty-card">
      <h2>{labels.singular} non trovata</h2>
      <p>L'elemento richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/teams" class="btn-module-list" title="Vai all'elenco {labels.plural}" aria-label="Vai all'elenco {labels.plural}">
        <List size={20} />
      </a>
    </Card>
  {:else}
    <header class="page-header">
      <div class="header-title-box">
        <a href="/dashboard/teams" class="btn-module-list" title="Vai all'elenco {labels.plural}" aria-label="Vai all'elenco {labels.plural}">
          <List size={20} />
        </a>
        <div class="header-icon">
          <Users size={24} color="var(--color-primary-500)" />
        </div>
        <div>
          <div class="code-badge">{team.code}</div>
          <h1 class="page-main-title">{team.name}</h1>
        </div>
      </div>

      <div class="header-actions">
        <a href={`/dashboard/teams/${team.id}/edit`} class="btn-edit">
          <Edit3 size={16} />
          <span>Modifica</span>
        </a>
        <Button variant="danger" onclick={handleDelete} disabled={deleting} class="btn-delete">
          <Trash2 size={16} color="white" />
          <span>{deleting ? 'Eliminazione...' : 'Elimina'}</span>
        </Button>
      </div>
    </header>

    <!-- TAB NAVIGATION -->
    <div class="tabs-nav">
      <button 
        class="tab-btn" 
        class:active={activeTab === 'overview'} 
        onclick={() => activeTab = 'overview'}
      >
        <Users size={16} />
        <span>Panoramica</span>
      </button>

      <button 
        class="tab-btn" 
        class:active={activeTab === 'members'} 
        onclick={() => activeTab = 'members'}
      >
        <UserCheck size={16} />
        <span>Componenti ({team.members ? team.members.length : 0})</span>
      </button>

      {#if hasActivitiesModule}
        <button 
          class="tab-btn" 
          class:active={activeTab === 'activities'} 
          onclick={() => activeTab = 'activities'}
        >
          <ClipboardList size={16} />
          <span>Attività Assegnate ({teamActivities.length})</span>
        </button>
      {/if}
    </div>

    <!-- TAB CONTENT -->
    {#if activeTab === 'overview'}
      <div class="detail-grid">
        <Card class="detail-card">
          <h2 class="card-title">Informazioni Operative</h2>
          
          <div class="info-list">
            <div class="info-item">
              <span class="info-label">Stato Operativo</span>
              <StatusBadge status={team.status} label={getStatusLabel(team.status)} />
            </div>
            <div class="info-item">
              <span class="info-label">Caposquadra Designato</span>
              <span class="info-value">
                {#if team.leaderName}
                  <span class="leader-badge"><Crown size={14} /> {team.leaderName}</span>
                {:else}
                  <span class="text-muted">Nessun caposquadra designato</span>
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Mezzo / Furgone Assegnato</span>
              <span class="info-value">
                {#if team.vehicleName}
                  <span class="vehicle-badge"><Truck size={14} /> {team.vehicleName}</span>
                {:else}
                  <span class="text-muted">Nessun mezzo assegnato</span>
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Metodo Tariffazione / Valutazione</span>
              <span class="info-value font-mono">
                {team.evaluationType ? team.evaluationType.toUpperCase() : 'METRI CUBI (MC)'}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Data Registrazione</span>
              <span class="info-value">{team.createdAt ? new Date(team.createdAt).toLocaleDateString('it-IT') : '-'}</span>
            </div>
          </div>
        </Card>

        <Card class="detail-card">
          <h2 class="card-title">Riepilogo Rapido</h2>
          <div class="stat-summary-boxes">
            <div class="stat-box">
              <div class="stat-num">{team.members ? team.members.length : 0}</div>
              <div class="stat-lbl">Operatori Assegnati</div>
            </div>
            <div class="stat-box">
              <div class="stat-num">{teamActivities.length}</div>
              <div class="stat-lbl">Attività Collegate</div>
            </div>
          </div>

          <div class="notes-section">
            <h3 class="notes-title">Note & Specializzazioni</h3>
            <p class="notes-content">{team.notes || 'Nessuna nota aggiuntiva presente per questa squadra.'}</p>
          </div>
        </Card>
      </div>

    {:else if activeTab === 'members'}
      <Card class="detail-card">
        <div class="card-header-row">
          <h2 class="card-title">Componenti della Squadra ({team.members ? team.members.length : 0})</h2>
          <a href={`/dashboard/teams/${team.id}/edit`} class="btn-edit-members">
            <Edit3 size={14} />
            <span>Gestisci Membri</span>
          </a>
        </div>

        {#if !team.members || team.members.length === 0}
          <div class="empty-substate">
            <Users size={32} color="var(--color-neutral-400)" />
            <p>Nessun operatore attualmente inserito in questa squadra.</p>
          </div>
        {:else}
          <div class="members-grid">
            {#each team.members as member (member.userId)}
              <div class="member-card-full" class:is-leader={member.isLeader}>
                <div class="member-top-row">
                  <div class="member-avatar-lg">
                    <UserCheck size={20} color={member.isLeader ? "var(--color-primary-600)" : "var(--color-neutral-600)"} />
                  </div>
                  <div>
                    <div class="member-name-lg">{member.userName}</div>
                    <div class="member-role-lbl">{member.roleInTeam || 'Operatore'}</div>
                  </div>
                  {#if member.isLeader}
                    <span class="leader-pill-lg">
                      <Crown size={12} />
                      CAPOSQUADRA
                    </span>
                  {/if}
                </div>

                <div class="member-bottom-meta">
                  <span class="meta-tag">
                    Tariffa: <strong>{member.evaluationType || 'giornata'}</strong>
                  </span>
                  {#if member.hourlyRate}
                    <span class="meta-tag">€{member.hourlyRate}/h</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

    {:else if activeTab === 'activities'}
      <Card class="detail-card">
        <h2 class="card-title">Attività Assegnate alla Squadra ({teamActivities.length})</h2>
        <p class="section-desc">Elenco delle attività operative pianificate o eseguite da questa squadra.</p>

        {#if loadingActivities}
          <div class="loading-state">Caricamento attività...</div>
        {:else if teamActivities.length === 0}
          <div class="empty-substate">
            <ClipboardList size={32} color="var(--color-neutral-400)" />
            <p>Nessuna attività operativa attualmente assegnata a questa squadra.</p>
          </div>
        {:else}
          <div class="activities-table-wrap">
            <table class="activities-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Titolo Attività</th>
                  <th>Data Esecuzione</th>
                  <th>Stato</th>
                  <th class="text-right">Azione</th>
                </tr>
              </thead>
              <tbody>
                {#each teamActivities as act (act.id)}
                  <tr>
                    <td class="font-mono">{act.code || act.id.slice(0, 8)}</td>
                    <td class="font-semibold">{act.title}</td>
                    <td>{act.executionDate || act.dueDate || '-'}</td>
                    <td><StatusBadge status={act.status} /></td>
                    <td class="text-right">
                      <a href={`/dashboard/activities/${act.id}`} class="btn-link-act">
                        <span>Dettaglio</span>
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>
    {/if}
  {/if}
</div>

<style>
  .team-detail-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-module-list {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
    transition: background 0.15s;
  }
  .btn-module-list:hover {
    background: var(--color-neutral-200);
  }

  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .code-badge {
    font-size: 12px;
    font-weight: 700;
    font-family: monospace;
    color: var(--color-primary-600);
  }

  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-edit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--color-primary-600);
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: var(--radius-md);
    text-decoration: none;
  }

  .tabs-nav {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--color-neutral-200);
    padding-bottom: 8px;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--color-neutral-600);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    background: var(--color-neutral-100);
  }

  .tab-btn.active {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 900px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 16px 0;
    color: var(--color-neutral-800);
  }

  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-neutral-100);
  }

  .info-label {
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  .info-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .leader-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-primary-700);
    background: var(--color-primary-50);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .vehicle-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-neutral-800);
  }

  .stat-summary-boxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .stat-box {
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    padding: 14px;
    text-align: center;
    border: 1px solid var(--color-neutral-100);
  }

  .stat-num {
    font-size: 24px;
    font-weight: 800;
    color: var(--color-primary-600);
  }

  .stat-lbl {
    font-size: 12px;
    color: var(--color-neutral-500);
    margin-top: 2px;
  }

  .notes-section {
    border-top: 1px solid var(--color-neutral-100);
    padding-top: 14px;
  }

  .notes-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-600);
    margin: 0 0 6px 0;
  }

  .notes-content {
    font-size: 13px;
    color: var(--color-neutral-700);
    line-height: 1.5;
    margin: 0;
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .btn-edit-members {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary-600);
    text-decoration: none;
  }

  .members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }

  .member-card-full {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .member-card-full.is-leader {
    background: var(--color-primary-50, #F5F3FF);
    border-color: var(--color-primary-200);
  }

  .member-top-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .member-avatar-lg {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-neutral-200);
  }

  .member-name-lg {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }

  .member-role-lbl {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .leader-pill-lg {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 800;
    background: var(--color-primary-600);
    color: white;
    padding: 3px 7px;
    border-radius: 12px;
  }

  .member-bottom-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--color-neutral-600);
    border-top: 1px solid rgba(0,0,0,0.05);
    padding-top: 8px;
  }

  .meta-tag {
    background: white;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--color-neutral-200);
  }

  .empty-substate {
    padding: 36px;
    text-align: center;
    color: var(--color-neutral-400);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .activities-table-wrap {
    overflow-x: auto;
  }

  .activities-table {
    width: 100%;
    border-collapse: collapse;
  }

  .activities-table th, .activities-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-100);
  }

  .activities-table th {
    font-size: 12px;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
  }

  .btn-link-act {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary-600);
    text-decoration: none;
  }

  .section-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: -10px 0 16px 0;
  }

  .font-mono { font-family: monospace; font-size: 12px; }
  .font-semibold { font-weight: 600; }
  .text-right { text-align: right; }
  .text-muted { color: var(--color-neutral-400); }

  .loading-state {
    padding: 60px;
    text-align: center;
    color: var(--color-neutral-500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
