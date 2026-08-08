<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { TeamsService } from './teams.service';
  import { TeamSettingsService } from './teamSettingsService';
  import { UsersService, type UserData } from '../users/users.service';
  import type { TeamItem, TeamSettings, TeamEvaluationType, MemberEvaluationType, TeamMember } from './schema';
  import { Card, PageHeader } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { Users, Plus, GripVertical, CheckCircle2, UserPlus, Trash2 } from '@lucide/svelte';

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

  let teams = $state<TeamItem[]>([]);
  let allUsers = $state<UserData[]>([]);
  let loading = $state(true);

  let labels = $derived(TeamSettingsService.getLabels(settings));

  // Extract unassigned technical users
  let unassignedWorkers = $derived.by(() => {
    const assignedIds = new Set<string>();
    teams.forEach(t => {
      (t.members || []).forEach(m => assignedIds.add(m.userId));
    });
    return allUsers.filter(u => 
      !assignedIds.has(u.uid) && 
      u.roles.some(r => r === 'tecnico' || r === 'operaio')
    ).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  });

  onMount(async () => {
    try {
      const [s, list, uList] = await Promise.all([
        TeamSettingsService.getSettings(),
        TeamsService.getTeams(),
        UsersService.getUsers(undefined, 'active')
      ]);
      settings = s;
      teams = list;
      allUsers = uList;
      pageTitle.set(labels.plural);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });

  // DRAG AND DROP
  function handleDragStart(e: DragEvent, userId: string, userName: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('userId', userId);
      e.dataTransfer.setData('userName', userName);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  async function handleDropOnTeam(e: DragEvent, targetTeam: TeamItem) {
    e.preventDefault();
    const userId = e.dataTransfer?.getData('userId');
    const userName = e.dataTransfer?.getData('userName');
    
    if (!userId || !userName) return;

    // Check if user is already in this team
    if (targetTeam.members?.some(m => m.userId === userId)) {
      return; // Already in this team
    }

    // Remove user from any other team first
    for (const t of teams) {
      if (t.id !== targetTeam.id && t.members?.some(m => m.userId === userId)) {
        t.members = t.members.filter(m => m.userId !== userId);
        await TeamsService.updateTeam(t.id, { members: t.members });
      }
    }

    // Add to target team
    if (!targetTeam.members) targetTeam.members = [];
    targetTeam.members.push({
      userId,
      userName,
      evaluationType: 'giornata'
    });

    // Force reactivity and save
    teams = [...teams]; 
    try {
      await TeamsService.updateTeam(targetTeam.id, { members: targetTeam.members });
      toast.success(`${userName} assegnato a ${targetTeam.name}`);
    } catch (err) {
      toast.error('Errore durante l\'assegnazione');
    }
  }

  async function removeFromTeam(team: TeamItem, userId: string) {
    team.members = team.members.filter(m => m.userId !== userId);
    teams = [...teams];
    try {
      await TeamsService.updateTeam(team.id, { members: team.members });
      toast.success('Operatore rimosso dalla squadra');
    } catch (e) {
      toast.error('Errore durante la rimozione');
    }
  }

  // UPDATES
  async function updateTeamEval(team: TeamItem, newEval: string) {
    team.evaluationType = newEval as TeamEvaluationType;
    teams = [...teams];
    try {
      await TeamsService.updateTeam(team.id, { evaluationType: team.evaluationType });
      toast.success('Configurazione squadra aggiornata');
    } catch (e) {
      toast.error('Errore aggiornamento');
    }
  }
  
  async function updateMemberEval(team: TeamItem, memberId: string, newEval: string) {
    const member = team.members.find(m => m.userId === memberId);
    if (member) {
      member.evaluationType = newEval as MemberEvaluationType;
      teams = [...teams];
      try {
        await TeamsService.updateTeam(team.id, { members: team.members });
      } catch (e) {
        toast.error('Errore aggiornamento');
      }
    }
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="personnel-page">
  <PageHeader 
    icon={Users} 
    title="Gestione Personale" 
    subtitle={`Configurazione ${labels.plural.toLowerCase()} operative e paghe/valutazioni.`}
  >
    {#snippet actions()}
      <div class="stats">
        <span class="stat-badge"><Users size={14}/> {allUsers.filter(u => u.roles.some(r => r === 'tecnico' || r === 'operaio')).length} Operai Totali</span>
        <span class="stat-badge"><CheckCircle2 size={14}/> {teams.length} Squadre</span>
      </div>
      <a href="/dashboard/teams/add" class="btn-create-team">
        <Plus size={18} />
        <span>Crea {labels.singular}</span>
      </a>
    {/snippet}
  </PageHeader>

  {#if loading}
    <div class="loading-state">Caricamento in corso...</div>
  {:else}
    <div class="personnel-layout">
      
      <!-- LEFT COLUMN: TEAMS -->
      <div class="teams-column">
        <h3 class="column-title">SQUADRE ({teams.length})</h3>
        
        <div class="teams-list">
          {#each teams as team (team.id)}
            <div 
              class="team-card"
              role="region"
              aria-label="Squadra"
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => handleDropOnTeam(e, team)}
            >
              <div class="team-header">
                <div class="team-title-row">
                  <div class="dot-indicator" class:active={team.status === 'attiva' || team.status === 'in_servizio'}></div>
                  <h4 class="team-name">{team.name}</h4>
                </div>
                <div class="team-eval-select">
                  <select 
                    value={team.evaluationType || 'mc'} 
                    onchange={(e) => updateTeamEval(team, (e.target as HTMLSelectElement).value)}
                  >
                    <option value="mc">mc (Metri Cubi)</option>
                    <option value="mq">mq (Metri Quadri)</option>
                    <option value="mc_plus_mq">mc + mq</option>
                    <option value="giornata">Giornata</option>
                  </select>
                </div>
              </div>

              <div class="team-members">
                {#if !team.members || team.members.length === 0}
                  <div class="empty-members">Nessun operatore in questa squadra. Trascina qui un operaio.</div>
                {:else}
                  {#each team.members as member}
                    <div class="member-row">
                      <div class="member-info">
                        <GripVertical size={14} class="drag-handle" />
                        <span class="member-name">{member.userName}</span>
                      </div>
                      <div class="member-actions">
                        <select 
                          class="member-eval-select"
                          value={member.evaluationType || 'giornata'}
                          onchange={(e) => updateMemberEval(team, member.userId, (e.target as HTMLSelectElement).value)}
                        >
                          <option value="giornata">Giornata</option>
                          <option value="mc">mc</option>
                          <option value="mq">mq</option>
                        </select>
                        <button class="btn-remove-member" onclick={() => removeFromTeam(team, member.userId)} title="Rimuovi dalla squadra">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- RIGHT COLUMN: UNASSIGNED WORKERS -->
      <div class="unassigned-column">
        <h3 class="column-title">OPERAI NON ASSEGNATI ({unassignedWorkers.length})</h3>
        
        <div class="unassigned-list">
          {#if unassignedWorkers.length === 0}
            <Card class="empty-unassigned">
              <CheckCircle2 size={32} color="var(--color-success-500)" />
              <p>Tutti gli operatori sono assegnati a una squadra!</p>
            </Card>
          {:else}
            {#each unassignedWorkers as worker}
              <div 
                class="unassigned-card"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, worker.uid, `${worker.nome} ${worker.cognome}`.trim())}
              >
                <div class="worker-drag-handle">
                  <GripVertical size={16} />
                </div>
                <div class="worker-info">
                  <span class="worker-name">{worker.nome} {worker.cognome}</span>
                  <span class="worker-role">Non assegnato</span>
                </div>
                <div class="worker-default-pay">
                  <span class="pay-tag">Giornata (Default)</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

    </div>
  {/if}
</div>

<style>
  .personnel-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
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
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-main-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .stats {
    display: flex;
    gap: 12px;
  }
  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
    background: white;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--color-neutral-200);
  }
  .btn-create-team {
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
    transition: background 0.15s;
  }
  .btn-create-team:hover {
    background: var(--color-primary-700);
  }

  .personnel-layout {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  .teams-column {
    flex: 2;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .unassigned-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: 24px;
  }
  .column-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-600);
    margin: 0;
    letter-spacing: 0.5px;
  }
  
  .teams-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .team-card {
    background: white;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .team-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-neutral-100);
    background: #fcfcfc;
  }
  .team-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dot-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-neutral-300);
  }
  .dot-indicator.active {
    background: var(--color-primary-500);
  }
  .team-name {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
    text-transform: uppercase;
    color: var(--color-neutral-800);
  }
  .team-eval-select select {
    padding: 6px 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary-700);
    background: white;
    cursor: pointer;
  }

  .team-members {
    padding: 8px 20px 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 50px;
  }
  .empty-members {
    font-size: 13px;
    color: var(--color-neutral-400);
    font-style: italic;
    padding: 12px 0;
  }
  .member-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--color-neutral-100);
  }
  .member-row:last-child {
    border-bottom: none;
  }
  .member-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .drag-handle {
    color: var(--color-neutral-400);
    cursor: grab;
  }
  .member-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-neutral-700);
  }
  .member-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .member-eval-select {
    padding: 4px 8px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    background: var(--color-neutral-50);
    color: var(--color-neutral-700);
    cursor: pointer;
  }
  .btn-remove-member {
    background: none;
    border: none;
    color: var(--color-neutral-400);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  .btn-remove-member:hover {
    background: #FEF2F2;
    color: #EF4444;
  }

  .unassigned-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .unassigned-card {
    display: flex;
    align-items: center;
    padding: 12px;
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    cursor: grab;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .unassigned-card:active {
    cursor: grabbing;
    transform: scale(0.98);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .worker-drag-handle {
    color: var(--color-neutral-400);
    padding-right: 12px;
  }
  .worker-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .worker-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .worker-role {
    font-size: 11px;
    color: var(--color-warning-600);
    font-weight: 500;
  }
  .worker-default-pay {
    padding-left: 12px;
  }
  .pay-tag {
    font-size: 11px;
    background: var(--color-neutral-100);
    padding: 4px 8px;
    border-radius: 12px;
    color: var(--color-neutral-600);
    font-weight: 600;
  }
  .empty-unassigned {
    padding: 32px;
    text-align: center;
    color: var(--color-neutral-500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
