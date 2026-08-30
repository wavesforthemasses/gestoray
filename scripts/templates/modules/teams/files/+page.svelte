<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { TeamsService } from './teams.service';
  import { TeamSettingsService } from './teamSettingsService';
  import { UsersService, type UserData } from '../users/users.service';
  import type { TeamItem, TeamSettings, TeamEvaluationType, MemberEvaluationType, TeamMember, TeamStatus } from './schema';
  import { Card, PageHeader } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { authState } from '$lib/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Users, 
    Plus, 
    GripVertical, 
    CheckCircle2, 
    Trash2, 
    Crown, 
    ShieldCheck, 
    Search, 
    SlidersHorizontal, 
    ExternalLink, 
    Filter,
    UserCheck,
    UserX,
    Building2,
    Calendar
  } from '@lucide/svelte';

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
  let searchQuery = $state('');
  let statusFilter = $state<string>('all');

  let labels = $derived(TeamSettingsService.getLabels(settings));

  // Extract unassigned technical users
  let unassignedWorkers = $derived.by(() => {
    const assignedIds = new Set<string>();
    teams.forEach(t => {
      (t.members || []).forEach(m => assignedIds.add(m.userId));
    });
    return allUsers
      .filter(u => {
        const isAssigned = assignedIds.has(u.uid);
        const isOperator = Array.isArray(u.roles) && u.roles.some(r => r === 'tecnico' || r === 'operaio');
        const matchesSearch = !searchQuery || 
          `${u.nome || ''} ${u.cognome || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        return !isAssigned && isOperator && matchesSearch;
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  });

  // Filtered teams based on search and status
  let filteredTeams = $derived.by(() => {
    return teams.filter(t => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.members || []).some(m => m.userName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  });

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadTeamsData();
    }
  });

  async function loadTeamsData() {
    loading = true;
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
      console.error('[Teams] Errore caricamento squadre:', e);
      toast.error('Impossibile caricare i dati delle squadre');
    } finally {
      loading = false;
    }
  }

  // DRAG AND DROP
  function handleDragStart(e: DragEvent, userId: string, userName: string, sourceTeamId?: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('userId', userId);
      e.dataTransfer.setData('userName', userName);
      if (sourceTeamId) {
        e.dataTransfer.setData('sourceTeamId', sourceTeamId);
      }
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  async function handleDropOnTeam(e: DragEvent, targetTeam: TeamItem) {
    e.preventDefault();
    const userId = e.dataTransfer?.getData('userId');
    const userName = e.dataTransfer?.getData('userName');
    const sourceTeamId = e.dataTransfer?.getData('sourceTeamId') || null;
    
    if (!userId || !userName) return;

    // Check if user is already in this team
    if (targetTeam.members?.some(m => m.userId === userId)) {
      return;
    }

    const previousTeams = JSON.parse(JSON.stringify(teams));
    const newMember: TeamMember = {
      userId,
      userName,
      evaluationType: 'giornata',
      roleInTeam: 'Operatore',
      isLeader: false
    };

    // Optimistic UI update
    if (sourceTeamId) {
      const src = teams.find(t => t.id === sourceTeamId);
      if (src) {
        src.members = (src.members || []).filter(m => m.userId !== userId);
        if (src.leaderId === userId) {
          src.leaderId = undefined;
          src.leaderName = undefined;
        }
      }
    }
    targetTeam.members = [...(targetTeam.members || []), newMember];
    teams = [...teams];

    try {
      const userDisplay = `${authState.user?.nome || ''} ${authState.user?.cognome || ''}`.trim() || authState.user?.email || 'Admin';
      await TeamsService.reassignMember(newMember, sourceTeamId, targetTeam.id, {
        uid: authState.user?.uid || '',
        displayName: userDisplay
      });
      toast.success(`${userName} assegnato a ${targetTeam.name}`);
    } catch (err) {
      console.error('[Teams] Errore riassegnazione membro:', err);
      teams = previousTeams; // Rollback
      toast.error('Errore durante l\'assegnazione del membro');
    }
  }

  async function removeFromTeam(team: TeamItem, userId: string) {
    const member = team.members.find(m => m.userId === userId);
    if (!member) return;

    const previousTeams = JSON.parse(JSON.stringify(teams));

    // Optimistic UI
    team.members = team.members.filter(m => m.userId !== userId);
    if (team.leaderId === userId) {
      team.leaderId = undefined;
      team.leaderName = undefined;
    }
    teams = [...teams];

    try {
      const userDisplay = `${authState.user?.nome || ''} ${authState.user?.cognome || ''}`.trim() || authState.user?.email || 'Admin';
      await TeamsService.reassignMember(member, team.id, null, {
        uid: authState.user?.uid || '',
        displayName: userDisplay
      });
      toast.success(`${member.userName} rimosso dalla squadra`);
    } catch (e) {
      console.error('[Teams] Errore rimozione:', e);
      teams = previousTeams; // Rollback
      toast.error('Errore durante la rimozione');
    }
  }

  async function toggleLeader(team: TeamItem, memberId: string) {
    const previousTeams = JSON.parse(JSON.stringify(teams));
    const member = team.members.find(m => m.userId === memberId);
    if (!member) return;

    const willBeLeader = !member.isLeader;
    
    // Optimistic UI update
    team.members.forEach(m => {
      m.isLeader = m.userId === memberId ? willBeLeader : false;
    });
    team.leaderId = willBeLeader ? member.userId : undefined;
    team.leaderName = willBeLeader ? member.userName : undefined;
    teams = [...teams];

    try {
      await TeamsService.updateTeam(team.id, {
        members: team.members,
        leaderId: team.leaderId || '',
        leaderName: team.leaderName || ''
      });
      toast.success(willBeLeader ? `${member.userName} nominato Caposquadra` : 'Caposquadra rimosso');
    } catch (e) {
      teams = previousTeams;
      toast.error('Errore durante l\'aggiornamento del caposquadra');
    }
  }

  async function updateTeamEval(team: TeamItem, newEval: string) {
    const previousEval = team.evaluationType;
    team.evaluationType = newEval as TeamEvaluationType;
    teams = [...teams];
    try {
      await TeamsService.updateTeam(team.id, { evaluationType: team.evaluationType });
      toast.success('Configurazione squadra aggiornata');
    } catch (e) {
      team.evaluationType = previousEval;
      teams = [...teams];
      toast.error('Errore aggiornamento configurazione');
    }
  }
  
  async function updateMemberEval(team: TeamItem, memberId: string, newEval: string) {
    const member = team.members.find(m => m.userId === memberId);
    if (member) {
      const prev = member.evaluationType;
      member.evaluationType = newEval as MemberEvaluationType;
      teams = [...teams];
      try {
        await TeamsService.updateTeam(team.id, { members: team.members });
        toast.success('Tariffazione operatore aggiornata');
      } catch (e) {
        member.evaluationType = prev;
        teams = [...teams];
        toast.error('Errore aggiornamento tariffazione');
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
    title={labels.plural} 
    subtitle={`Gestione e composizione ${labels.plural.toLowerCase()} operative, ruoli e rendicontazione.`}
  >
    {#snippet actions()}
      <div class="stats">
        <span class="stat-badge">
          <Users size={14} /> 
          {allUsers.filter(u => u.roles && u.roles.some(r => r === 'tecnico' || r === 'operaio')).length} Operatori
        </span>
        <span class="stat-badge">
          <CheckCircle2 size={14} /> 
          {teams.length} {labels.plural}
        </span>
      </div>
      <a href="/dashboard/teams/add" class="btn-create-team">
        <Plus size={18} />
        <span>{labels.newBtn}</span>
      </a>
    {/snippet}
  </PageHeader>

  <!-- Filter & Search Bar -->
  <div class="filter-bar">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder={`Cerca operatore o ${labels.singular.toLowerCase()}...`}
        class="search-input"
      />
    </div>

    <div class="status-filters">
      <button 
        class="filter-pill" 
        class:active={statusFilter === 'all'} 
        onclick={() => statusFilter = 'all'}
      >
        Tutte ({teams.length})
      </button>
      <button 
        class="filter-pill" 
        class:active={statusFilter === 'attiva'} 
        onclick={() => statusFilter = 'attiva'}
      >
        Attive ({teams.filter(t => t.status === 'attiva').length})
      </button>
      <button 
        class="filter-pill" 
        class:active={statusFilter === 'in_servizio'} 
        onclick={() => statusFilter = 'in_servizio'}
      >
        In Servizio ({teams.filter(t => t.status === 'in_servizio').length})
      </button>
      <button 
        class="filter-pill" 
        class:active={statusFilter === 'inattiva'} 
        onclick={() => statusFilter = 'inattiva'}
      >
        Inattive ({teams.filter(t => t.status === 'inattiva').length})
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Caricamento {labels.plural.toLowerCase()} in corso...</p>
    </div>
  {:else}
    <div class="personnel-layout">
      
      <!-- LEFT COLUMN: TEAMS -->
      <div class="teams-column">
        <div class="column-header">
          <h3 class="column-title">{labels.plural.toUpperCase()} ({filteredTeams.length})</h3>
          <span class="column-hint">Trascina gli operatori dentro la squadra desiderata</span>
        </div>
        
        <div class="teams-list">
          {#if filteredTeams.length === 0}
            <Card class="empty-state-card">
              <Users size={36} color="var(--color-neutral-400)" />
              <p>Nessuna {labels.singular.toLowerCase()} trovata con i filtri attuali.</p>
              <a href="/dashboard/teams/add" class="btn-create-sub">
                <Plus size={16} />
                <span>Crea {labels.singular}</span>
              </a>
            </Card>
          {:else}
            {#each filteredTeams as team (team.id)}
              <div 
                class="team-card"
                role="region"
                aria-label={team.name}
                ondragover={(e) => e.preventDefault()}
                ondrop={(e) => handleDropOnTeam(e, team)}
              >
                <div class="team-header">
                  <div class="team-title-box">
                    <div class="dot-indicator" class:active={team.status === 'attiva' || team.status === 'in_servizio'}></div>
                    <div>
                      <div class="team-code">{team.code}</div>
                      <a href={`/dashboard/teams/${team.id}`} class="team-name-link">
                        <h4 class="team-name">{team.name}</h4>
                        <ExternalLink size={14} class="ext-icon" />
                      </a>
                    </div>
                  </div>

                  <div class="team-header-actions">
                    {#if team.leaderName}
                      <span class="leader-badge-header" title="Caposquadra designato">
                        <Crown size={13} />
                        {team.leaderName}
                      </span>
                    {/if}
                    <div class="team-eval-select">
                      <select 
                        value={team.evaluationType || 'mc'} 
                        onchange={(e) => updateTeamEval(team, (e.target as HTMLSelectElement).value)}
                        title="Metodo di valutazione / tariffazione"
                      >
                        <option value="mc">mc (Metri Cubi)</option>
                        <option value="mq">mq (Metri Quadri)</option>
                        <option value="mc_plus_mq">mc + mq</option>
                        <option value="giornata">A Giornata</option>
                        <option value="oraria">Oraria</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="team-members">
                  {#if !team.members || team.members.length === 0}
                    <div class="empty-members">
                      <GripVertical size={16} />
                      <span>Nessun operatore in questa {labels.singular.toLowerCase()}. Trascina qui un operatore.</span>
                    </div>
                  {:else}
                    {#each team.members as member (member.userId)}
                      <div 
                        class="member-row" 
                        class:is-leader-row={member.isLeader}
                        draggable="true"
                        ondragstart={(e) => handleDragStart(e, member.userId, member.userName, team.id)}
                      >
                        <div class="member-info">
                          <GripVertical size={14} class="drag-handle" />
                          <div class="member-avatar">
                            <UserCheck size={14} color={member.isLeader ? "var(--color-primary-600)" : "var(--color-neutral-500)"} />
                          </div>
                          <span class="member-name">{member.userName}</span>
                          {#if member.isLeader}
                            <span class="leader-tag">
                              <Crown size={10} />
                              CAPOSQUADRA
                            </span>
                          {/if}
                        </div>

                        <div class="member-actions">
                          <button 
                            class="btn-toggle-leader" 
                            class:active-leader={member.isLeader}
                            onclick={() => toggleLeader(team, member.userId)}
                            title={member.isLeader ? "Rimuovi da Caposquadra" : "Nomina Caposquadra"}
                          >
                            <Crown size={14} />
                          </button>

                          <select 
                            class="member-eval-select"
                            value={member.evaluationType || 'giornata'}
                            onchange={(e) => updateMemberEval(team, member.userId, (e.target as HTMLSelectElement).value)}
                            title="Tariffazione operatore"
                          >
                            <option value="giornata">Giornata</option>
                            <option value="oraria">Oraria</option>
                            <option value="mc">mc</option>
                            <option value="mq">mq</option>
                          </select>

                          <button 
                            class="btn-remove-member" 
                            onclick={() => removeFromTeam(team, member.userId)} 
                            title="Rimuovi dalla squadra"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- RIGHT COLUMN: UNASSIGNED WORKERS -->
      <div class="unassigned-column">
        <div class="column-header">
          <h3 class="column-title">OPERATORI DISPONIBILI ({unassignedWorkers.length})</h3>
          <span class="column-hint">Trascina in una squadra</span>
        </div>
        
        <div class="unassigned-list">
          {#if unassignedWorkers.length === 0}
            <Card class="empty-unassigned">
              <CheckCircle2 size={32} color="var(--color-success-500)" />
              <p>Tutti gli operatori operativi sono attualmente assegnati ad una {labels.singular.toLowerCase()}!</p>
            </Card>
          {:else}
            {#each unassignedWorkers as worker (worker.uid)}
              <div 
                class="unassigned-card"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, worker.uid, `${worker.nome || ''} ${worker.cognome || ''}`.trim() || worker.email || worker.uid)}
              >
                <div class="worker-drag-handle">
                  <GripVertical size={16} />
                </div>
                <div class="worker-info">
                  <span class="worker-name">{worker.nome} {worker.cognome}</span>
                  <span class="worker-email">{worker.email || 'Nessuna email'}</span>
                </div>
                <div class="worker-default-pay">
                  <span class="pay-tag">Giornata</span>
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
    gap: 20px;
    width: 100%;
  }

  .stats {
    display: flex;
    gap: 10px;
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
    padding: 8px 16px;
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

  .filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    background: white;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 6px 12px;
    flex: 1;
    min-width: 240px;
    max-width: 400px;
  }

  :global(.search-icon) {
    color: var(--color-neutral-400);
  }

  .search-input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    width: 100%;
  }

  .status-filters {
    display: flex;
    gap: 8px;
  }

  .filter-pill {
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--color-neutral-200);
    background: white;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    transition: all 0.15s;
  }

  .filter-pill.active {
    background: var(--color-primary-50);
    border-color: var(--color-primary-500);
    color: var(--color-primary-700);
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

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .column-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700);
    margin: 0;
    letter-spacing: 0.5px;
  }

  .column-hint {
    font-size: 12px;
    color: var(--color-neutral-400);
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
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .team-card:hover {
    border-color: var(--color-neutral-300);
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  }

  .team-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-neutral-100);
    background: #fafafa;
  }

  .team-title-box {
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
    background: var(--color-success-500);
  }

  .team-code {
    font-size: 11px;
    font-weight: 700;
    font-family: monospace;
    color: var(--color-neutral-400);
  }

  .team-name-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    color: inherit;
  }

  .team-name {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-800);
  }

  :global(.ext-icon) {
    color: var(--color-neutral-400);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .team-name-link:hover :global(.ext-icon) {
    opacity: 1;
  }

  .team-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .leader-badge-header {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 3px 8px;
    border-radius: 12px;
    border: 1px solid var(--color-primary-200);
  }

  .team-eval-select select {
    padding: 5px 10px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary-700);
    background: white;
    cursor: pointer;
  }

  .team-members {
    padding: 10px 18px 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 48px;
  }

  .empty-members {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-400);
    font-style: italic;
    padding: 14px 0;
  }

  .member-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    background: white;
    border: 1px solid transparent;
    transition: background 0.1s, border-color 0.1s;
    cursor: grab;
  }

  .member-row:hover {
    background: var(--color-neutral-50);
    border-color: var(--color-neutral-200);
  }

  .member-row.is-leader-row {
    background: var(--color-primary-50, #F5F3FF);
    border-color: var(--color-primary-100);
  }

  .member-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.drag-handle) {
    color: var(--color-neutral-300);
    cursor: grab;
  }

  .member-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-neutral-100);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .member-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .leader-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    background: var(--color-primary-600);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .member-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-toggle-leader {
    background: none;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-sm);
    color: var(--color-neutral-400);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .btn-toggle-leader:hover {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    border-color: var(--color-primary-300);
  }

  .btn-toggle-leader.active-leader {
    background: var(--color-primary-600);
    color: white;
    border-color: var(--color-primary-600);
  }

  .member-eval-select {
    padding: 3px 6px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 600;
    background: white;
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
    transition: all 0.15s;
  }

  .btn-remove-member:hover {
    background: #FEF2F2;
    color: #EF4444;
  }

  .unassigned-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .unassigned-card {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    cursor: grab;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    transition: transform 0.1s, box-shadow 0.1s, border-color 0.1s;
  }

  .unassigned-card:hover {
    border-color: var(--color-primary-300);
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .unassigned-card:active {
    cursor: grabbing;
    transform: scale(0.98);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .worker-drag-handle {
    color: var(--color-neutral-400);
    padding-right: 10px;
  }

  .worker-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .worker-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .worker-email {
    font-size: 11px;
    color: var(--color-neutral-400);
  }

  .worker-default-pay {
    padding-left: 10px;
  }

  .pay-tag {
    font-size: 10px;
    background: var(--color-neutral-100);
    padding: 3px 6px;
    border-radius: 10px;
    color: var(--color-neutral-600);
    font-weight: 600;
  }

  :global(.empty-unassigned) {
    padding: 24px;
    text-align: center;
    color: var(--color-neutral-500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  :global(.empty-state-card) {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .btn-create-sub {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--color-primary-600);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--radius-md);
    text-decoration: none;
  }

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
