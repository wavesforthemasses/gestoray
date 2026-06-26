<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table } from '$lib';
  import { 
    ClipboardList, MessageSquare, Phone, Calendar, 
    Users, ArrowRight, Search, Eye, TrendingUp, ChevronUp, ChevronDown 
  } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'commerciale' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchActivities();
    return () => unsubscribe();
  });

  let activitiesList = $state<Array<{ id: string, clientId: string, clientName: string, type: 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC', notes: string, date: string, loggedBy: string, loggedEmail: string }>>([]);
  let loading = $state(true);

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);

  // Filters state
  let filterType = $state<'all' | 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC'>('all');
  let searchQuery = $state('');

  const columns = $derived.by(() => {
    const list = [
      { key: 'date', header: 'Data Attività' },
      { key: 'clientName', header: 'Cliente' },
      { key: 'type', header: 'Tipo Attività' },
      { key: 'notes', header: 'Descrizione / Note' }
    ];

    if ($activeRole !== 'commerciale') {
      list.push({ key: 'loggedEmail', header: 'Eseguito Da' });
    }

    list.push({ key: 'actions', header: 'Azioni' });
    return list;
  });

  async function fetchActivities() {
    loading = true;
    try {
      const querySnapshot = await getDocs(collection(db, 'activities'));
      const list: typeof activitiesList = [];
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName || 'Sconosciuto',
          type: data.type,
          notes: data.notes || '',
          date: data.date,
          loggedBy: data.loggedBy,
          loggedEmail: data.loggedEmail || 'Sistema'
        });
      });

      activitiesList = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
      console.error('Error fetching activities:', e);
    } finally {
      loading = false;
    }
  }

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  // Generate date ranges backwards from endDateString
  let chartPeriods = $derived.by(() => {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date, end: Date, label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 51; i >= 0; i--) {
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({ start: pStart, end: pEnd, label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}` });
      }
    } else if (granularity === 'mensile') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({ start: pStart, end: pEnd, label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}` });
      }
    } else {
      for (let i = 9; i >= 0; i--) {
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({ start: pStart, end: pEnd, label: String(year) });
      }
    }
    return periods;
  });

  let computedChartPoints = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    const myUid = $auth?.uid;

    return chartPeriods.map((p) => {
      const dbValue = activitiesList.filter(a => {
        const d = new Date(a.date);
        const inPeriod = d >= p.start && d <= p.end;
        if (!inPeriod) return false;
        const belongs = !isComm || a.loggedBy === myUid;
        if (!belongs) return false;
        if (filterType !== 'all' && a.type !== filterType) return false;
        return true;
      }).length;

      return dbValue;
    });
  });

  let svgPointsData = $derived.by(() => {
    const data = computedChartPoints;
    const maxVal = Math.max(...data, 5);
    const count = data.length;

    const points = data.map((val, idx) => {
      const x = 40 + (idx / (count - 1)) * 400;
      const y = 120 - (val / maxVal) * 100;
      return { x, y, val };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return acc + (idx === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
    }, '');

    const areaD = pathD + ` L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;

    return { points, pathD, areaD, maxVal };
  });

  // Filtered activities list
  let filteredActivities = $derived.by(() => {
    let result = activitiesList;

    if ($activeRole === 'commerciale' && $auth) {
      result = result.filter(a => a.loggedBy === $auth.uid);
    }

    if (filterType !== 'all') {
      result = result.filter(a => a.type === filterType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        a.clientName.toLowerCase().includes(query) || 
        a.notes.toLowerCase().includes(query) ||
        a.loggedEmail.toLowerCase().includes(query)
      );
    }

    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      result = result.filter(a => {
        const d = new Date(a.date);
        return d >= period.start && d <= period.end;
      });
    }

    return result;
  });

  function handleSelectRow(row: any) {
    goto(`/dashboard/clients/${row.clientId}?tab=activities`);
  }
</script>

<div class="activities-page animate-fade-in">
  <!-- EXPANDABLE TREND CHART -->
  <div class="subpage-chart-control">
    <button onclick={toggleGraph} class="toggle-chart-btn">
      <TrendingUp size={16} /> 
      {isGraphExpanded ? 'Nascondi Grafico Andamento' : 'Mostra Grafico Andamento'}
      {#if isGraphExpanded}
        <ChevronUp size={14} />
      {:else}
        <ChevronDown size={14} />
      {/if}
    </button>
  </div>

  {#if isGraphExpanded}
    <div class="subpage-chart-card animate-fade-in">
      <Card title="Andamento Attività Commerciali e Amministrative" description="Clicca su un punto del grafico per filtrare le attività per data.">
        {#snippet icon()}
          <TrendingUp size={20} class="icon-accent" />
        {/snippet}

        {#snippet headerSnippet()}
          <div class="chart-controls-sub">
            <!-- Period Granularity -->
            <select bind:value={granularity} class="sub-chart-select">
              <option value="settimanale">Settimanale (52w)</option>
              <option value="mensile">Mensile (24m)</option>
              <option value="annuale">Annuale (10y)</option>
            </select>

            <!-- End Date Picker -->
            <input type="date" bind:value={endDateString} class="sub-chart-date-picker" />

            <!-- Metrics Switcher -->
            <div class="metric-switch">
              <button class="m-btn" class:active={filterType === 'all'} onclick={() => { filterType = 'all'; selectedPointIdx = null; }}>Tutte</button>
              <button class="m-btn" class:active={filterType === 'Telefonata'} onclick={() => { filterType = 'Telefonata'; selectedPointIdx = null; }}>Telefonate</button>
              <button class="m-btn" class:active={filterType === 'Incontro'} onclick={() => { filterType = 'Incontro'; selectedPointIdx = null; }}>Incontri</button>
              <button class="m-btn" class:active={filterType === 'Appuntamento'} onclick={() => { filterType = 'Appuntamento'; selectedPointIdx = null; }}>Appuntamenti</button>
            </div>
          </div>
        {/snippet}

        <div class="svg-chart-container-sub">
          <svg class="sub-svg" viewBox="0 0 480 150">
            <!-- Grid Lines -->
            <line x1="40" y1="20" x2="440" y2="20" class="grid-line" />
            <line x1="40" y1="70" x2="440" y2="70" class="grid-line" />
            <line x1="40" y1="120" x2="440" y2="120" class="grid-line" />

            <!-- Area -->
            <path d={svgPointsData.areaD} class="chart-area-fill" fill="rgba(79, 70, 229, 0.12)" />

            <!-- Path Line -->
            <path d={svgPointsData.pathD} class="chart-line-stroke" />

            <!-- Dots -->
            {#each svgPointsData.points as pt, idx}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={selectedPointIdx === idx ? "7" : "4"}
                class="chart-point-dot"
                class:selected={selectedPointIdx === idx}
                role="button"
                tabindex="0"
                aria-label="Seleziona punto grafico"
                onclick={() => {
                  if (selectedPointIdx === idx) {
                    selectedPointIdx = null;
                  } else {
                    selectedPointIdx = idx;
                  }
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (selectedPointIdx === idx) {
                      selectedPointIdx = null;
                    } else {
                      selectedPointIdx = idx;
                    }
                  }
                }}
              />
            {/each}
          </svg>
        </div>

        <div class="chart-y-axis-lbls">
          <span>Massimo: {svgPointsData.maxVal}</span>
          {#if selectedPointIdx !== null}
            <span class="selected-period-banner">
              Filtro attivo: <strong>{chartPeriods[selectedPointIdx].label}</strong> (Attività: {computedChartPoints[selectedPointIdx]})
              <button onclick={() => selectedPointIdx = null} class="clear-filter-btn">Azzera filtro</button>
            </span>
          {/if}
          <span>Minimo: 0</span>
        </div>
      </Card>
    </div>
  {/if}

  <Card
    title="Registro Attività Commerciali"
    description="Cronologia di tutte le telefonate, incontri ed appuntamenti pianificati con i clienti del database."
  >
    {#snippet icon()}
      <ClipboardList size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <div class="filters-row">
        <!-- Text Search -->
        <div class="search-input-wrapper">
          <Search size={14} class="search-icon" />
          <input 
            type="text" 
            placeholder="Cerca per cliente, note..." 
            bind:value={searchQuery}
            class="filter-search-input"
          />
        </div>

        <!-- Type Selector -->
        <div class="type-filter-tabs">
          <button class="tab-btn" class:active={filterType === 'all'} onclick={() => filterType = 'all'}>Tutte</button>
          <button class="tab-btn" class:active={filterType === 'Telefonata'} onclick={() => filterType = 'Telefonata'}>Telefonate</button>
          <button class="tab-btn" class:active={filterType === 'Incontro'} onclick={() => filterType = 'Incontro'}>Incontri</button>
          <button class="tab-btn" class:active={filterType === 'Appuntamento'} onclick={() => filterType = 'Appuntamento'}>Appuntamenti</button>
          {#if $activeRole === 'amministrazione' || $activeRole === 'superadmin' || $activeRole === 'direzione'}
            <button class="tab-btn" class:active={filterType === 'Sollecito Telefonico'} onclick={() => filterType = 'Sollecito Telefonico'}>Soll. Tel</button>
            <button class="tab-btn" class:active={filterType === 'Sollecito Email'} onclick={() => filterType = 'Sollecito Email'}>Soll. Email</button>
            <button class="tab-btn" class:active={filterType === 'Sollecito PEC'} onclick={() => filterType = 'Sollecito PEC'}>Soll. PEC</button>
          {/if}
        </div>
      </div>
    {/snippet}

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento storico attività...
      </div>
    {:else}
      {#snippet cell(col: any, row: any)}
        {#if col.key === 'date'}
          <span class="date-txt">{new Date(row.date).toLocaleString('it-IT')}</span>
        {:else if col.key === 'clientName'}
          <span class="client-name">{row.clientName}</span>
        {:else if col.key === 'type'}
          <span class="badge" 
            class:badge-tel={row.type === 'Telefonata' || row.type === 'Sollecito Telefonico'} 
            class:badge-inc={row.type === 'Incontro' || row.type === 'Sollecito PEC'} 
            class:badge-app={row.type === 'Appuntamento' || row.type === 'Sollecito Email'}
          >
            {row.type}
          </span>
        {:else if col.key === 'notes'}
          <p class="notes-txt" title={row.notes}>{row.notes || 'Nessuna nota registrata.'}</p>
        {:else if col.key === 'loggedEmail'}
          <span class="logged-txt">{row.loggedEmail}</span>
        {:else if col.key === 'actions'}
          <button onclick={() => goto(`/dashboard/clients/${row.clientId}?tab=activities`)} class="view-client-btn" title="Vai alla scheda cliente">
            <Eye size={14} /> Scheda
          </button>
        {/if}
      {/snippet}

      <div class="table-wrapper">
        <Table
          {columns}
          data={filteredActivities}
          cellSnippet={cell}
          onRowClick={handleSelectRow}
          emptyText="Nessuna attività registrata corrispondente ai filtri impostati."
        />
      </div>
    {/if}
  </Card>
</div>

<style>
  .activities-page {
    width: 100%;
  }

  .subpage-chart-control {
    margin-bottom: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .toggle-chart-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-chart-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .subpage-chart-card {
    margin-bottom: 24px;
  }

  .chart-controls-sub {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sub-chart-select, .sub-chart-date-picker {
    height: 36px;
    padding: 0 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 12px;
    background: var(--color-white);
  }

  .metric-switch {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 2px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-200);
  }

  .m-btn {
    border: none;
    background: transparent;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.2s;
  }

  .m-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .svg-chart-container-sub {
    background: var(--color-white);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    margin-top: 12px;
  }

  .sub-svg {
    width: 100%;
    height: 120px;
    overflow: visible;
  }

  .grid-line {
    stroke: var(--color-neutral-200);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .chart-line-stroke {
    stroke: var(--color-primary-500);
    stroke-width: 2.5;
    fill: none;
  }

  .chart-point-dot {
    fill: var(--color-white);
    stroke: var(--color-primary-500);
    stroke-width: 2;
    cursor: pointer;
    transition: all 0.2s;
  }

  .chart-point-dot:hover, .chart-point-dot.selected {
    fill: var(--color-primary-500);
    r: 7px;
  }

  .chart-y-axis-lbls {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--color-neutral-500);
    margin-top: 8px;
    align-items: center;
  }

  .selected-period-banner {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .clear-filter-btn {
    background: var(--color-white);
    border: 1px solid var(--color-primary-200);
    color: var(--color-primary-600);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
  }

  .filters-row {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 10px;
    color: var(--color-neutral-400);
  }

  .filter-search-input {
    padding: 6px 10px 6px 30px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    width: 200px;
    background: var(--color-white);
  }

  .filter-search-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px hsla(var(--brand-h), var(--brand-s), 50%, 0.1);
  }

  .type-filter-tabs {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 3px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .tab-btn {
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .date-txt {
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  .client-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    color: var(--color-white);
    display: inline-block;
  }

  .badge-tel { background: #0284c7; }
  .badge-inc { background: #0d9488; }
  .badge-app { background: #4f46e5; }

  .notes-txt {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-600);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 320px;
  }

  .logged-txt {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .view-client-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
  }

  .view-client-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
