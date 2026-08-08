<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { TeamsService } from '../teams.service';
  import { TeamSettingsService } from '../teamSettingsService';
  import type { TeamItem, TeamSettings } from '../schema';
  import { Card, StatusBadge, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { Users, ArrowLeft, Edit3, Trash2, UserCheck, Truck } from '@lucide/svelte';

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

  let loading = $state(true);
  let deleting = $state(false);

  let labels = $derived(TeamSettingsService.getLabels(settings));

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
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio squadra:', e);
      toast.error('Impossibile caricare il dettaglio');
    } finally {
      loading = false;
    }
  });

  async function handleDelete() {
    if (!team) return;
    if (!confirm(`Sei sicuro di voler eliminare questa ${labels.singular.toLowerCase()}?`)) return;

    deleting = true;
    try {
      await TeamsService.deleteTeam(team.id);
      toast.success(`${labels.singular} eliminata con successo`);
      goto('/dashboard/teams');
    } catch (e) {
      console.error('Errore eliminazione squadra:', e);
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
  <title>{team ? team.name : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="team-detail-container">
  {#if loading}
    <div class="loading-state">Caricamento in corso...</div>
  {:else if !team}
    <Card class="empty-card">
      <h2>{labels.singular} non trovata</h2>
      <p>L'elemento richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/teams" class="btn-back-link">Torna alla lista</a>
    </Card>
  {:else}
    <header class="page-header">
      <div class="header-title-box">
        <a href="/dashboard/teams" class="btn-back" title="Torna alla lista">
          <ArrowLeft size={20} />
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

    <div class="detail-grid">
      <Card class="detail-card">
        <h2 class="card-title">Informazioni Generali</h2>
        
        <div class="info-list">
          <div class="info-item">
            <span class="info-label">Stato Operativo</span>
            <StatusBadge status={team.status} label={getStatusLabel(team.status)} />
          </div>
          <div class="info-item">
            <span class="info-label">Caposquadra</span>
            <span class="info-value">
              {#if team.leaderName}
                <span class="leader-badge"><UserCheck size={14} /> {team.leaderName}</span>
              {:else}
                <span class="text-muted">Non assegnato</span>
              {/if}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Mezzo Assegnato</span>
            <span class="info-value">
              {#if team.vehicleName}
                <span class="vehicle-badge"><Truck size={14} /> {team.vehicleName}</span>
              {:else}
                <span class="text-muted">Nessun mezzo</span>
              {/if}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Registrazione</span>
            <span class="info-value">{new Date(team.createdAt).toLocaleDateString('it-IT')}</span>
          </div>
        </div>
      </Card>

      <Card class="detail-card">
        <h2 class="card-title">Componenti Squadra ({team.members ? team.members.length : 0})</h2>
        {#if !team.members || team.members.length === 0}
          <p class="text-muted">Nessun membro inserito in questa squadra.</p>
        {:else}
          <div class="members-list">
            {#each team.members as member}
              <div class="member-card" class:is-leader={member.isLeader}>
                <div class="member-avatar">
                  <UserCheck size={18} color="var(--color-primary-600)" />
                </div>
                <div class="member-info">
                  <div class="name-row">
                    <span class="member-name">{member.userName}</span>
                    {#if member.isLeader}
                      <span class="leader-pill">CAPOSQUADRA</span>
                    {/if}
                  </div>
                  <span class="member-role">{member.roleInTeam || 'Operatore'}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>

    <Card class="detail-card">
      <h2 class="card-title">Note & Specializzazioni</h2>
      <p class="notes-content">{team.notes || 'Nessuna nota aggiuntiva presente.'}</p>
    </Card>
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
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
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
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
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
  }
  .leader-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-primary-700);
  }
  .vehicle-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-neutral-800);
  }
  .members-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .member-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
  }
  .member-card.is-leader {
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-100);
  }
  .member-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .member-info {
    display: flex;
    flex-direction: column;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .member-name {
    font-size: 14px;
    font-weight: 600;
  }
  .leader-pill {
    font-size: 9px;
    font-weight: 700;
    background: var(--color-primary-600);
    color: white;
    padding: 1px 5px;
    border-radius: 4px;
  }
  .member-role {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  .notes-content {
    font-size: 14px;
    color: var(--color-neutral-700);
    line-height: 1.5;
  }
  .loading-state {
    padding: 40px;
    text-align: center;
  }
  .empty-card {
    padding: 40px;
    text-align: center;
  }
  .text-muted { color: var(--color-neutral-400); font-weight: normal; }
</style>
