<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField } from '$lib';
  import { Users, Plus, ArrowLeft, TrendingUp, ShieldAlert, CheckCircle, ChevronDown, ChevronUp } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'commerciale' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchData();
    return () => unsubscribe();
  });

  let clientsList = $state<Array<{ id: string, nome: string, cognome?: string, email?: string, phone?: string, notes?: string[], communications?: any[], createdBy: string, createdAt: string }>>([]);
  let contractsList = $state<any[]>([]);
  let paymentsList = $state<any[]>([]);
  let activitiesList = $state<any[]>([]);
  
  let loadingClients = $state(true);
  let showAddForm = $state(false);

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);

  // Chart config
  let activeChartTab = $state<'nncf' | 'vss' | 'gi'>('nncf');
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);

  // Simple customer creation form state
  let nome = $state('');
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  const columns = [
    { key: 'nome', header: 'Nome Azienda' },
    { key: 'cognome', header: 'Referente' },
    { key: 'email', header: 'Indirizzo Email' },
    { key: 'phone', header: 'Telefono' },
    { key: 'notesCount', header: 'Note registrate' },
    { key: 'activitiesCount', header: 'Attività loggate' }
  ];

  async function fetchData() {
    loadingClients = true;
    try {
      // 1. Fetch Clients
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clList: typeof clientsList = [];
      clientsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        clList.push({
          id: doc.id,
          nome: data.nome,
          cognome: data.cognome,
          email: data.email,
          phone: data.phone,
          notes: data.notes || [],
          communications: data.communications || [],
          createdBy: data.createdBy || '',
          createdAt: data.createdAt || new Date().toISOString()
        });
      });
      clientsList = clList;

      // 2. Fetch Contracts
      const contractsSnapshot = await getDocs(collection(db, 'contracts'));
      const coList: any[] = [];
      contractsSnapshot.forEach((doc: any) => {
        coList.push({ id: doc.id, ...doc.data() });
      });
      contractsList = coList;

      // 3. Fetch Payments
      const paymentsSnapshot = await getDocs(collection(db, 'payments'));
      const pList: any[] = [];
      paymentsSnapshot.forEach((doc: any) => {
        pList.push({ id: doc.id, ...doc.data() });
      });
      paymentsList = pList;

      // 4. Fetch Activities
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      const actList: any[] = [];
      activitiesSnapshot.forEach((doc: any) => {
        actList.push({ id: doc.id, ...doc.data() });
      });
      activitiesList = actList;

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      loadingClients = false;
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
        periods.push({
          start: pStart,
          end: pEnd,
          label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}`
        });
      }
    } else if (granularity === 'mensile') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({
          start: pStart,
          end: pEnd,
          label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}`
        });
      }
    } else {
      for (let i = 9; i >= 0; i--) {
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({
          start: pStart,
          end: pEnd,
          label: String(year)
        });
      }
    }
    return periods;
  });

  let computedChartPoints = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    const myUid = $auth?.uid;

    return chartPeriods.map((p) => {
      let dbValue = 0;

      if (activeChartTab === 'vss') {
        dbValue = contractsList
          .filter(c => {
            const d = new Date(c.createdAt);
            const inPeriod = d >= p.start && d <= p.end;
            const belongs = !isComm || c.vendorUid === myUid || c.secondVendorUid === myUid;
            return inPeriod && belongs;
          })
          .reduce((sum, c) => {
            if (isComm) {
              if (c.vendorUid === myUid) {
                return sum + c.totalPrice * (100 - (c.secondVendorShare || 0)) / 100;
              } else if (c.secondVendorUid === myUid) {
                return sum + c.totalPrice * (c.secondVendorShare || 0) / 100;
              }
            }
            return sum + c.totalPrice;
          }, 0);
      } else if (activeChartTab === 'gi') {
        dbValue = paymentsList
          .filter(pay => {
            const d = new Date(pay.date);
            const inPeriod = d >= p.start && d <= p.end;
            if (!inPeriod) return false;
            if (isComm) {
              const c = contractsList.find(x => x.id === pay.contractId);
              if (!c) return false;
              return c.vendorUid === myUid || c.secondVendorUid === myUid;
            }
            return true;
          })
          .reduce((sum, pay) => {
            if (isComm) {
              const c = contractsList.find(x => x.id === pay.contractId);
              if (c) {
                if (c.vendorUid === myUid) {
                  return sum + pay.amount * (100 - (c.secondVendorShare || 0)) / 100;
                } else if (c.secondVendorUid === myUid) {
                  return sum + pay.amount * (c.secondVendorShare || 0) / 100;
                }
              }
            }
            return sum + pay.amount;
          }, 0);
      } else if (activeChartTab === 'nncf') {
        dbValue = clientsList
          .filter(c => {
            const d = new Date(c.createdAt);
            const inPeriod = d >= p.start && d <= p.end;
            const belongs = !isComm || c.createdBy === myUid;
            return inPeriod && belongs;
          }).length;
      }

      return dbValue;
    });
  });

  let svgPointsData = $derived.by(() => {
    const data = computedChartPoints;
    const maxVal = Math.max(...data, activeChartTab === 'nncf' ? 5 : 1000);
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

    return {
      points,
      pathD,
      areaD,
      maxVal
    };
  });

  let filteredClients = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    const myUid = $auth?.uid;

    let list = clientsList;

    if (isComm) {
      list = list.filter(c => c.createdBy === myUid);
    }

    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      list = list.filter(c => {
        const creationDate = new Date(c.createdAt);
        if (creationDate >= period.start && creationDate <= period.end) return true;

        const hasAct = activitiesList.some(act => {
          if (act.clientId !== c.id) return false;
          const d = new Date(act.date);
          return d >= period.start && d <= period.end;
        });
        if (hasAct) return true;

        const hasContr = contractsList.some(contr => {
          if (contr.clientId !== c.id) return false;
          const d = new Date(contr.createdAt);
          return d >= period.start && d <= period.end;
        });
        if (hasContr) return true;

        const hasPay = paymentsList.some(pay => {
          if (pay.clientId !== c.id) return false;
          const d = new Date(pay.date);
          return d >= period.start && d <= period.end;
        });
        if (hasPay) return true;

        return false;
      });
    }

    return list;
  });

  async function handleCreateClient(e: Event) {
    e.preventDefault();
    if (!nome || !$auth) return;
    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      const clientId = 'client_' + Math.random().toString(36).substring(2, 11);
      const newClient = {
        nome: nome.trim(),
        notes: [],
        communications: [],
        createdBy: $auth.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'clients', clientId), newClient);
      
      const historyId = 'audit_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'client_history', historyId), {
        clientId,
        updatedBy: $auth.uid,
        updatedEmail: $auth.email,
        updatedAt: new Date().toISOString(),
        previousState: {},
        currentState: newClient
      });

      successMsg = `Lead per "${nome}" creato con successo!`;
      nome = '';
      showAddForm = false; 
      await fetchData();
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante la creazione del cliente.';
    } finally {
      submitting = false;
    }
  }

  function handleSelectClient(item: any) {
    goto(`/dashboard/clients/${item.id}`);
  }
</script>

<svelte:head>
  <title>Gestione Clienti CRM | Gestoray</title>
</svelte:head>

<div class="clients-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success animate-fade-in">{successMsg}</div>
  {/if}

  {#if !showAddForm}
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
        <Card title="Andamento Nuovi Lead e Performance Clienti" description="Clicca su un punto del grafico per filtrare l'elenco dei clienti in base al periodo selezionato.">
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
                <button class="m-btn" class:active={activeChartTab === 'nncf'} onclick={() => { activeChartTab = 'nncf'; selectedPointIdx = null; }}>Nuovi Clienti</button>
                <button class="m-btn" class:active={activeChartTab === 'vss'} onclick={() => { activeChartTab = 'vss'; selectedPointIdx = null; }}>Valore Venduto</button>
                <button class="m-btn" class:active={activeChartTab === 'gi'} onclick={() => { activeChartTab = 'gi'; selectedPointIdx = null; }}>Incassato</button>
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
            <span>Massimo: {activeChartTab === 'nncf' ? svgPointsData.maxVal : '€' + svgPointsData.maxVal.toLocaleString('it-IT')}</span>
            {#if selectedPointIdx !== null}
              <span class="selected-period-banner">
                Filtro attivo: <strong>{chartPeriods[selectedPointIdx].label}</strong> (Valore: {activeChartTab === 'nncf' ? computedChartPoints[selectedPointIdx] : '€' + computedChartPoints[selectedPointIdx].toLocaleString('it-IT')})
                <button onclick={() => selectedPointIdx = null} class="clear-filter-btn">Azzera filtro</button>
              </span>
            {/if}
            <span>Minimo: 0</span>
          </div>
        </Card>
      </div>
    {/if}

    <Card
      title="Anagrafica Clienti CRM"
      description="Database dei contatti e dei lead commerciali. Fai clic su un cliente per vederne i dettagli, le note, e loggare le attività."
      class="list-card"
    >
      {#snippet icon()}
        <Users size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        {#if $activeRole !== 'direzione'}
          <button onclick={() => { showAddForm = true; successMsg = ''; errorMsg = ''; }} class="add-client-btn">
            <Plus size={16} /> Aggiungi Cliente
          </button>
        {/if}
      {/snippet}

      {#if loadingClients}
        <div class="loader-box">
          <span class="spinner"></span>
          Caricamento clienti...
        </div>
      {:else}
        {#snippet cell(col: any, row: any)}
          {#if col.key === 'nome'}
            <span class="name-cell">{row.nome}</span>
          {:else if col.key === 'cognome'}
            <span>{row.cognome || 'N/D'}</span>
          {:else if col.key === 'email'}
            <span class="mail-cell">{row.email || 'N/D'}</span>
          {:else if col.key === 'phone'}
            <span>{row.phone || 'N/D'}</span>
          {:else if col.key === 'notesCount'}
            <span class="count-badge">{row.notes?.length || 0}</span>
          {:else if col.key === 'activitiesCount'}
            <span class="count-badge active">{row.communications?.length || 0}</span>
          {/if}
        {/snippet}

        <div class="table-wrapper">
          <Table
            {columns}
            data={filteredClients}
            cellSnippet={cell}
            onRowClick={handleSelectClient}
            emptyText="Nessun cliente registrato nel database vendite."
          />
        </div>
      {/if}
    </Card>
  {:else}
    <Card
      title="Aggiungi Nuovo Lead Semplificato"
      description="Crea una scheda cliente inserendo solo il nome. Potrai completare l'anagrafica in fase di contratto."
      class="form-card"
    >
      {#snippet icon()}
        <Users size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = false; successMsg = ''; errorMsg = ''; }} class="back-link">
          <ArrowLeft size={14} /> Annulla e torna all'elenco
        </button>
      {/snippet}

      <form onsubmit={handleCreateClient} class="client-form">
        <FormField id="client-name" label="Nome Azienda" helpText="Richiesto per iniziare a loggare attività e note.">
          <input
            type="text"
            id="client-name"
            bind:value={nome}
            placeholder="es. Mario Rossi s.r.l."
            required
            disabled={submitting}
          />
        </FormField>

        <button type="submit" class="submit-btn" disabled={submitting}>
          {#if submitting}
            Salvataggio in corso...
          {:else}
            Crea Scheda Lead
          {/if}
        </button>
      </form>
    </Card>
  {/if}
</div>

<style>
  .clients-page {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
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

  .add-client-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  .add-client-btn:hover {
    opacity: 0.9;
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .name-cell {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .mail-cell {
    color: var(--color-neutral-500);
  }

  .count-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    padding: 2px 6px;
    border-radius: var(--radius-round);
    min-width: 20px;
    text-align: center;
  }

  .count-badge.active {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 30px;
    color: var(--color-neutral-500);
    font-size: 14px;
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

  .client-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .submit-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 12px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), 50%, 0.2);
    margin-top: 10px;
    width: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .alert {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
  }

  .alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .alert.success {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
