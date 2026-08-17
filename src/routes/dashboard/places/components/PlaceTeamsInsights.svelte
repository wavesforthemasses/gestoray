<script lang="ts">
  import { onMount } from 'svelte';
  import { PlacesService } from '../places.service';
  import { Users, Activity, CheckCircle2, History, BarChart3, Calendar } from '@lucide/svelte';

  let { placeId }: { placeId?: string } = $props();

  let loading = $state(true);

  interface TeamInsight {
    id: string;
    name: string;
    totalCount: number;
    completedCount: number;
    inProgressCount: number;
    firstDate: string;
    lastDate: string;
    isActiveNow: boolean;
    progressPercent: number;
  }

  let activeTeams = $state<TeamInsight[]>([]);
  let allTeamsInsights = $state<TeamInsight[]>([]);

  onMount(async () => {
    try {
      if (!placeId) return;

      const activitiesSnap = await PlacesService.getTeamsInsights(placeId);

      if (activitiesSnap && !activitiesSnap.empty) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const map = new Map<string, {
          id: string;
          name: string;
          totalCount: number;
          completedCount: number;
          inProgressCount: number;
          firstDate: string;
          lastDate: string;
          isActiveNow: boolean;
        }>();

        activitiesSnap.forEach((d: any) => {
          const act = d.data();
          const actDate = act.scheduledDate || act.executionDate || act.createdAt || '';
          const isCompleted = act.status === 'completata' || act.status === 'completato';
          const isInProgress = act.status === 'in_corso' || (act.status === 'da_fare' && actDate >= todayStr);

          let teamsInAct: { id: string; name: string }[] = [];
          if (act.assignedEntities && Array.isArray(act.assignedEntities)) {
            teamsInAct = act.assignedEntities
              .filter((e: any) => e.type === 'team' || e.entityType === 'team')
              .map((e: any) => ({
                id: e.id || e.entityId || '',
                name: e.name || e.entityName || ''
              }))
              .filter((t: any) => t.id && t.name);
          }

          teamsInAct.forEach((t: any) => {
            if (!map.has(t.id)) {
              map.set(t.id, {
                id: t.id,
                name: t.name,
                totalCount: 1,
                completedCount: isCompleted ? 1 : 0,
                inProgressCount: isInProgress ? 1 : 0,
                firstDate: actDate,
                lastDate: actDate,
                isActiveNow: isInProgress
              });
            } else {
              const item = map.get(t.id)!;
              item.totalCount += 1;
              if (isCompleted) item.completedCount += 1;
              if (isInProgress) {
                item.inProgressCount += 1;
                item.isActiveNow = true;
              }
              if (actDate && (!item.firstDate || actDate < item.firstDate)) {
                item.firstDate = actDate;
              }
              if (actDate && actDate > item.lastDate) {
                item.lastDate = actDate;
              }
            }
          });
        });

        const list: TeamInsight[] = Array.from(map.values()).map(item => ({
          ...item,
          progressPercent: item.totalCount > 0 ? Math.round((item.completedCount / item.totalCount) * 100) : 0
        }));

        list.sort((a, b) => (b.isActiveNow ? 1 : 0) - (a.isActiveNow ? 1 : 0) || b.totalCount - a.totalCount);

        allTeamsInsights = list;
        activeTeams = list.filter(t => t.isActiveNow);
      }
    } catch (e) {
      console.warn('Errore calcolo squadre cantiere:', e);
    } finally {
      loading = false;
    }
  });
</script>

{#if !loading}
  <div class="info-card teams-insights-card">
    <div class="card-header-box">
      <h3 class="card-title">
        <Users size={18} /> Squadre Operative & Cronoprogramma Lavori
      </h3>
      {#if allTeamsInsights.length > 0}
        <span class="badge-total">{allTeamsInsights.length} {allTeamsInsights.length === 1 ? 'squadra' : 'squadre'}</span>
      {/if}
    </div>

    {#if allTeamsInsights.length === 0}
      <div class="empty-teams-insight">
        <BarChart3 size={28} class="empty-gantt-icon" />
        <p class="empty-title">Nessuna squadra o intervento registrato per questo cantiere</p>
        <span class="empty-sub">Crea una nuova attività associata a questo cantiere ed assegna una squadra per attivare il calcolo dell'avanzamento lavori e il cronoprogramma Gantt.</span>
      </div>
    {:else}
      <!-- Squadre Attive Ora -->
      <div class="teams-section">
        <span class="section-label">
          <Activity size={14} class="icon-active" />
          Squadre Attive in Cantiere ({activeTeams.length})
        </span>

      {#if activeTeams.length === 0}
        <p class="empty-text">Nessuna squadra attualmente al lavoro su interventi in corso o programmati.</p>
      {:else}
        <div class="teams-pills-row">
          {#each activeTeams as team}
            <div class="team-pill active-pill">
              <span class="team-dot"></span>
              <span class="team-name">{team.name}</span>
              <span class="team-tasks-count">({team.inProgressCount} in corso)</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Avanzamento Lavori & Gantt Timeline per Squadra -->
    <div class="teams-section mt-20">
      <span class="section-label">
        <BarChart3 size={14} class="icon-gantt" />
        Avanzamento Lavori & Cronoprogramma (Timeline Squadre)
      </span>

      <div class="gantt-timeline-list">
        {#each allTeamsInsights as team}
          <div class="gantt-row">
            <div class="gantt-row-header">
              <div class="team-title-box">
                <Users size={14} class="team-icon" />
                <span class="team-name">{team.name}</span>
                {#if team.isActiveNow}
                  <span class="state-badge active">In Lavorazione</span>
                {:else if team.progressPercent === 100}
                  <span class="state-badge completed">Completato</span>
                {:else}
                  <span class="state-badge paused">In Attesa</span>
                {/if}
              </div>

              <div class="team-stats-summary">
                <span class="stats-text">{team.completedCount} di {team.totalCount} completati</span>
                <span class="percent-badge">{team.progressPercent}%</span>
              </div>
            </div>

            <!-- Progress Bar Visualizer (Mini-Gantt Bar) -->
            <div class="gantt-bar-wrapper">
              <div 
                class="gantt-bar-fill" 
                class:active-bar={team.isActiveNow}
                class:completed-bar={team.progressPercent === 100}
                style="width: {Math.max(8, team.progressPercent)}%;"
              ></div>
            </div>

            <div class="gantt-row-dates">
              {#if team.firstDate}
                <span class="date-tag">
                  <Calendar size={12} /> Inizio: {team.firstDate.slice(0, 10)}
                </span>
              {/if}
              {#if team.lastDate}
                <span class="date-tag">
                  Ultimo intervento: {team.lastDate.slice(0, 10)}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
    {/if}
  </div>
{/if}

<style>
  .empty-teams-insight {
    text-align: center;
    padding: 24px 16px;
    background: var(--color-neutral-50, #f8fafc);
    border: 1px dashed var(--color-neutral-300);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  :global(.empty-gantt-icon) {
    color: var(--color-neutral-400);
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700);
    margin: 0;
  }

  .empty-sub {
    font-size: 12px;
    color: var(--color-neutral-500);
    max-width: 440px;
    line-height: 1.4;
  }
  .teams-insights-card {
    background: #ffffff !important;
    border: 1px solid var(--color-neutral-200) !important;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .card-header-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-neutral-900);
  }

  .badge-total {
    font-size: 11px;
    font-weight: 700;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    padding: 2px 8px;
    border-radius: 12px;
  }

  .teams-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-neutral-500);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .icon-active { color: #16a34a; }
  .icon-gantt { color: #2563eb; }

  .empty-text {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .teams-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .team-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
  }

  .active-pill {
    background: #dcfce7;
    border: 1px solid #bbf7d0;
    color: #15803d;
  }

  .team-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
  }

  .team-tasks-count {
    font-size: 11px;
    opacity: 0.8;
  }

  .gantt-timeline-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .gantt-row {
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .gantt-row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .team-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .team-icon {
    color: var(--color-neutral-500);
  }

  .team-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }

  .state-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .state-badge.active { background: #dbeafe; color: #1e40af; }
  .state-badge.completed { background: #dcfce7; color: #166534; }
  .state-badge.paused { background: #f1f5f9; color: #64748b; }

  .team-stats-summary {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stats-text {
    font-size: 12px;
    color: var(--color-neutral-600);
    font-weight: 500;
  }

  .percent-badge {
    font-size: 12px;
    font-weight: 800;
    color: var(--color-primary-700);
    background: #ffffff;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--color-neutral-200);
  }

  .gantt-bar-wrapper {
    width: 100%;
    height: 10px;
    background: var(--color-neutral-200);
    border-radius: 6px;
    overflow: hidden;
  }

  .gantt-bar-fill {
    height: 100%;
    background: var(--color-primary-500, #3b82f6);
    border-radius: 6px;
    transition: width 0.4s ease;
  }

  .gantt-bar-fill.active-bar {
    background: linear-gradient(90deg, #3b82f6, #2563eb);
  }

  .gantt-bar-fill.completed-bar {
    background: linear-gradient(90deg, #22c55e, #16a34a);
  }

  .gantt-row-dates {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--color-neutral-500);
  }

  .date-tag {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mt-20 { margin-top: 20px; }
</style>
