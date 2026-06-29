<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs, query, where, orderBy, limit } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField, LineChart, generateSearchTerms } from '$lib';
  import { Users, Plus, ArrowLeft, TrendingUp, ShieldAlert, CheckCircle, ChevronDown, ChevronUp } from '@lucide/svelte';
  import { exportToCSV, exportToExcel, triggerPrint } from '$lib/export-utils';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'commerciale' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchClientsData();
    return () => unsubscribe();
  });

  let clientsList = $state<any[]>([]);
  let loadingClients = $state(true);
  let showAddForm = $state(false);
  let searchQuery = $state('');

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let loadingChart = $state(false);

  // Chart config
  let activeChartTab = $state<'nuove_anagrafiche' | 'nncf' | 'vss' | 'gi'>('nuove_anagrafiche');
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);

  // Chart raw data lists
  let chartRawClients = $state<any[]>([]);
  let chartRawContracts = $state<any[]>([]);
  let chartRawPayments = $state<any[]>([]);

  // Simple customer creation form state
  let nome = $state('');
  let cognome = $state('');
  let email = $state('');
  let phone = $state('');
  let fiscalId = $state('');
  let partitaIva = $state('');
  let codiceFiscale = $state('');
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  const columns = [
    { key: 'nome', header: 'Nome Azienda' },
    { key: 'cognome', header: 'Referente' },
    { key: 'email', header: 'Indirizzo Email' },
    { key: 'status', header: 'Stato Funnel' },
    { key: 'notesCount', header: 'Note' },
    { key: 'activitiesCount', header: 'Attività' },
    { key: 'actions', header: 'Azioni' }
  ];

  async function fetchClientsData(searchVal?: string) {
    loadingClients = true;
    try {
      const isComm = $activeRole === 'commerciale';
      const myUid = $auth?.uid;

      let snaps: any[] = [];

      if (!searchVal || !searchVal.trim()) {
        let q;
        if (isComm) {
          q = query(collection(db, 'clients'), where('original.createdBy', '==', myUid), limit(100));
        } else {
          q = query(collection(db, 'clients'), limit(100));
        }
        const snap = await getDocs(q);
        snaps.push(snap);
      } else {
        const term = searchVal.trim().toLowerCase();

        const queries = [
          getDocs(query(collection(db, 'clients'), where('derived.textSearch', 'array-contains', term), limit(100)))
        ];

        const results = await Promise.all(queries);
        snaps = results;
      }

      const clList: any[] = [];
      const seenIds = new Set<string>();

      snaps.forEach(snap => {
        snap.forEach((doc: any) => {
          if (seenIds.has(doc.id)) return;
          const data = doc.data();
          const orig = data.original || {};

          // Filter in memory for commercials
          if (isComm && orig.createdBy !== myUid) return;

          seenIds.add(doc.id);
          clList.push({
            id: doc.id,
            nome: orig.nome || '',
            cognome: orig.cognome || '',
            email: orig.email,
            phone: orig.phone,
            status: orig.status || 'prospect',
            notes: orig.notes || [],
            createdBy: orig.createdBy || '',
            createdAt: data.edits?.createdAt || orig.createdAt || new Date().toISOString(),
            derived: data.derived || {}
          });
        });
      });

      clientsList = clList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    } catch (e) {
      console.error('Error fetching clients:', e);
    } finally {
      loadingClients = false;
    }
  }

  // Generate date ranges backwards from endDateString
  let chartPeriods = $derived.by(() => {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date, end: Date, label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 11; i >= 0; i--) { // 12 weeks
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({ start: pStart, end: pEnd, label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}` });
      }
    } else if (granularity === 'mensile') {
      for (let i = 11; i >= 0; i--) { // 12 months
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({ start: pStart, end: pEnd, label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}` });
      }
    } else {
      for (let i = 4; i >= 0; i--) { // 5 years
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({ start: pStart, end: pEnd, label: String(year) });
      }
    }
    return periods;
  });

  async function fetchChartDataPoints() {
    if (!isGraphExpanded || chartPeriods.length === 0) return;
    loadingChart = true;

    try {
      const minDate = chartPeriods[0].start.toISOString();
      const myUid = $auth?.uid;
      const isComm = $activeRole === 'commerciale';

      if (activeChartTab === 'nuove_anagrafiche' || activeChartTab === 'nncf') {
        let q;
        if (isComm) {
          q = query(collection(db, 'clients'), where('original.createdBy', '==', myUid), where('edits.createdAt', '>=', minDate));
        } else {
          q = query(collection(db, 'clients'), where('edits.createdAt', '>=', minDate));
        }
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
        chartRawClients = list;
      } else if (activeChartTab === 'vss') {
        let q;
        if (isComm) {
          const [primarySnap, secondarySnap] = await Promise.all([
            getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid), where('edits.createdAt', '>=', minDate))),
            getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid), where('edits.createdAt', '>=', minDate)))
          ]);
          const list: any[] = [];
          primarySnap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
          secondarySnap.forEach((d: any) => { if (!list.some(x => x.id === d.id)) list.push({ id: d.id, ...d.data() }); });
          chartRawContracts = list;
        } else {
          q = query(collection(db, 'contracts'), where('edits.createdAt', '>=', minDate));
          const snap = await getDocs(q);
          const list: any[] = [];
          snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
          chartRawContracts = list;
        }
      } else if (activeChartTab === 'gi') {
        const snap = await getDocs(query(collection(db, 'payments'), where('original.date', '>=', minDate)));
        const list: any[] = [];
        snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
        chartRawPayments = list;
      }
    } catch (e) {
      console.error("Error loading clients chart data:", e);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded || granularity || endDateString || activeChartTab) {
      fetchChartDataPoints();
    }
  });

  let computedChartPoints = $derived.by(() => {
    return chartPeriods.map((p) => {
      if (activeChartTab === 'nuove_anagrafiche') {
        return chartRawClients.filter(c => {
          const d = new Date(c.edits?.createdAt || c.original?.createdAt);
          return d >= p.start && d <= p.end;
        }).length;
      } else if (activeChartTab === 'nncf') {
        return chartRawClients.filter(c => {
          const d = new Date(c.derived?.nncfDate);
          return c.derived?.nncfDate && d >= p.start && d <= p.end;
        }).length;
      } else if (activeChartTab === 'vss') {
        return chartRawContracts.filter(c => {
          const d = new Date(c.edits?.createdAt || c.original?.createdAt);
          return d >= p.start && d <= p.end;
        }).reduce((sum, c) => sum + (c.original?.totalPrice || 0), 0);
      } else {
        return chartRawPayments.filter(pay => {
          const d = new Date(pay.original?.date);
          return d >= p.start && d <= p.end;
        }).reduce((sum, pay) => sum + (pay.original?.amount || 0), 0);
      }
    });
  });

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  let filteredClients = $derived.by(() => {
    let list = clientsList;

    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      list = list.filter(c => {
        const creationDate = new Date(c.createdAt);
        return creationDate >= period.start && creationDate <= period.end;
      });
    }

    return list;
  });

  async function handleCreateClient(e: Event) {
    e.preventDefault();
    if (!$auth) return;
    if (!nome.trim()) {
      errorMsg = "Il Nome Azienda è obbligatorio.";
      return;
    }
    if (!fiscalId.trim()) {
      errorMsg = "L'Identificativo Fiscale è obbligatorio.";
      return;
    }
    if (!email.trim() && !phone.trim()) {
      errorMsg = "Inserire almeno un contatto tra Email e Telefono.";
      return;
    }

    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      // Uniqueness check for fiscalId
      const checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', fiscalId.trim()));
      const checkSnap = await getDocs(checkQuery);
      if (!checkSnap.empty) {
        throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
      }

      const clientId = 'client_' + Math.random().toString(36).substring(2, 11);
      const now = new Date().toISOString();

      const newClient = {
        original: {
          nome: nome.trim(),
          cognome: cognome.trim(),
          email: email.trim(),
          phone: phone.trim(),
          fiscalId: fiscalId.trim(),
          partitaIva: partitaIva.trim(),
          codiceFiscale: codiceFiscale.trim(),
          status: 'prospect',
          notes: [],
          createdBy: $auth.uid
        },
        derived: {
          contractsCount: 0,
          approvedContractsCount: 0,
          totalContractValue: 0,
          totalPaid: 0,
          totalRemaining: 0,
          activitiesCount: 0,
          quotesCount: 0,
          nncfDate: null,
          nncfOrderId: null,
          lastActivityDate: null,
          textSearch: generateSearchTerms(nome.trim() + ' ' + (partitaIva ? partitaIva.trim() : '') + ' ' + (codiceFiscale ? codiceFiscale.trim() : ''))
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      };

      await setDoc(doc(db, 'clients', clientId), newClient);
      
      const historyId = 'audit_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'clients', clientId, 'history', historyId), {
        original: {
          clientId,
          updatedBy: $auth.uid,
          updatedEmail: $auth.email,
          changes: {
            creation: { oldVal: null, newVal: 'created' }
          }
        },
        edits: {
          createdAt: now
        }
      });

      successMsg = `Anagrafica per "${nome}" creata con successo!`;
      nome = '';
      cognome = '';
      fiscalId = '';
      email = '';
      phone = '';
      partitaIva = '';
      codiceFiscale = '';
      showAddForm = false; 
      await fetchClientsData();
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
                <option value="settimanale">Settimanale (12w)</option>
                <option value="mensile">Mensile (12m)</option>
                <option value="annuale">Annuale (5y)</option>
              </select>

              <!-- End Date Picker -->
              <input type="date" bind:value={endDateString} class="sub-chart-date-picker" />

              <!-- Metrics Switcher -->
              <div class="metric-switch">
                <button class="m-btn" class:active={activeChartTab === 'nuove_anagrafiche'} onclick={() => { activeChartTab = 'nuove_anagrafiche'; selectedPointIdx = null; }}>Nuove Anagrafiche</button>
                <button class="m-btn" class:active={activeChartTab === 'nncf'} onclick={() => { activeChartTab = 'nncf'; selectedPointIdx = null; }}>NNCF (Primi Ordini)</button>
                <button class="m-btn" class:active={activeChartTab === 'vss'} onclick={() => { activeChartTab = 'vss'; selectedPointIdx = null; }}>Valore Venduto</button>
                <button class="m-btn" class:active={activeChartTab === 'gi'} onclick={() => { activeChartTab = 'gi'; selectedPointIdx = null; }}>Incassato</button>
              </div>
            </div>
          {/snippet}

          {#if loadingChart}
            <div class="loader-box" style="border: none; padding: 20px;">
              <span class="spinner"></span>
              Caricamento andamento...
            </div>
          {:else}
            <LineChart
              data={computedChartPoints}
              labels={chartPeriods.map(p => p.label)}
              selectedIdx={selectedPointIdx}
              onSelect={(idx) => selectedPointIdx = idx}
              isCurrency={activeChartTab === 'vss' || activeChartTab === 'gi'}
            />
          {/if}
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
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button onclick={() => exportToCSV(filteredClients, [
            { key: 'nome', header: 'Nome Azienda' },
            { key: 'cognome', header: 'Referente' },
            { key: 'email', header: 'Indirizzo Email' },
            { key: 'phone', header: 'Telefono' },
            { key: 'status', header: 'Stato Funnel' }
          ], 'gestoray_clienti')} class="back-link" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Esporta in formato CSV">
            CSV
          </button>
          <button onclick={() => exportToExcel(filteredClients, [
            { key: 'nome', header: 'Nome Azienda' },
            { key: 'cognome', header: 'Referente' },
            { key: 'email', header: 'Indirizzo Email' },
            { key: 'phone', header: 'Telefono' },
            { key: 'status', header: 'Stato Funnel' }
          ], 'gestoray_clienti')} class="back-link" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Esporta in Excel (XLS)">
            Excel
          </button>
          <button onclick={triggerPrint} class="back-link" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Stampa l'elenco / Salva PDF">
            Stampa / PDF
          </button>
          {#if $activeRole !== 'direzione'}
            <button onclick={() => { showAddForm = true; successMsg = ''; errorMsg = ''; }} class="add-client-btn" style="height: 34px;">
              <Plus size={16} /> Aggiungi Cliente
            </button>
          {/if}
        </div>
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
          {:else if col.key === 'status'}
            <span class="status-badge-lbl status-{row.status || 'prospect'}">
              {#if row.status === 'prospect'}Prospect
              {:else if row.status === 'contacted'}Contattato
              {:else if row.status === 'proposal_sent'}Prop. Inviata
              {:else if row.status === 'customer'}Cliente
              {:else if row.status === 'churned'}Perso/Inattivo
              {:else}{row.status || 'Prospect'}{/if}
            </span>
          {:else if col.key === 'notesCount'}
            <span class="count-badge">{row.notes?.length || 0}</span>
          {:else if col.key === 'activitiesCount'}
            <span class="count-badge active">{row.derived?.activitiesCount || 0}</span>
          {:else if col.key === 'actions'}
            <div class="row-actions" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}>
              <button 
                onclick={() => goto(`/dashboard/clients/${row.id}?tab=quotes`)} 
                class="quick-action-btn"
                title="Nuovo Preventivo per questo cliente"
              >
                Nuovo Preventivo
              </button>
            </div>
          {/if}
        {/snippet}

        <div class="search-bar-row">
          <input 
            type="text" 
            bind:value={searchQuery} 
            placeholder="Cerca cliente per nome, partita IVA o codice fiscale..." 
            class="search-input"
            onkeydown={(e) => { if (e.key === 'Enter') fetchClientsData(searchQuery); }}
          />
          <button onclick={() => fetchClientsData(searchQuery)} class="search-btn">Cerca</button>
          {#if searchQuery}
            <button onclick={() => { searchQuery = ''; fetchClientsData(); }} class="clear-search-btn">Reset</button>
          {/if}
        </div>

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
      title="Aggiungi Nuova Anagrafica"
      description="Crea una nuova scheda cliente. Nome Azienda, Identificativo Fiscale e almeno un recapito (Email o Telefono) sono obbligatori."
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

      <form onsubmit={handleCreateClient} class="client-form" style="display: grid; gap: 16px;">
        <FormField id="client-name" label="Nome Azienda *" helpText="Ragione sociale o nome dell'attività.">
          <input
            type="text"
            id="client-name"
            bind:value={nome}
            placeholder="es. Mario Rossi s.r.l."
            required
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-fiscal" label="Identificativo Fiscale *" helpText="Codice Fiscale o Partita IVA principale. Deve essere univoco nel sistema.">
          <input
            type="text"
            id="client-fiscal"
            bind:value={fiscalId}
            placeholder="es. IT12345678901"
            required
            disabled={submitting}
          />
        </FormField>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <FormField id="client-cognome" label="Referente / Cognome" helpText="Cognome della persona di contatto.">
            <input
              type="text"
              id="client-cognome"
              bind:value={cognome}
              placeholder="es. Rossi"
              disabled={submitting}
            />
          </FormField>

          <FormField id="client-phone" label="Numero di Telefono" helpText="Obbligatorio se l'email è vuota.">
            <input
              type="text"
              id="client-phone"
              bind:value={phone}
              placeholder="es. +39 02 123456"
              disabled={submitting}
            />
          </FormField>
        </div>

        <FormField id="client-email" label="Indirizzo Email" helpText="Obbligatorio se il telefono è vuota.">
          <input
            type="email"
            id="client-email"
            bind:value={email}
            placeholder="es. info@azienda.com"
            disabled={submitting}
          />
        </FormField>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <FormField id="client-piva" label="Partita IVA (Opzionale)">
            <input
              type="text"
              id="client-piva"
              bind:value={partitaIva}
              placeholder="es. 12345678901"
              disabled={submitting}
            />
          </FormField>

          <FormField id="client-cf" label="Codice Fiscale (Opzionale)">
            <input
              type="text"
              id="client-cf"
              bind:value={codiceFiscale}
              placeholder="es. RSSMRA80A01H501U"
              disabled={submitting}
            />
          </FormField>
        </div>

        <button type="submit" class="submit-btn" disabled={submitting} style="margin-top: 10px;">
          {#if submitting}
            Salvataggio in corso...
          {:else}
            Crea Anagrafica Cliente
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
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
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

  .status-badge-lbl {
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--radius-xs);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    display: inline-block;
  }

  .status-badge-lbl.status-prospect {
    background: var(--color-neutral-100);
    color: var(--color-neutral-500);
  }

  .status-badge-lbl.status-contacted {
    background: hsla(200, 100%, 96%, 1);
    color: #0284c7;
  }

  .status-badge-lbl.status-proposal_sent {
    background: hsla(270, 100%, 97%, 1);
    color: #7c3aed;
  }

  .status-badge-lbl.status-customer {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .status-badge-lbl.status-churned {
    background: var(--color-error-light);
    color: var(--color-error-text);
  }

  .count-badge {
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 20px;
    min-width: 14px;
    text-align: center;
    display: inline-block;
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
    padding: 40px;
    color: var(--color-neutral-500);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
    margin-top: 10px;
    width: 100%;
  }

  .submit-btn:hover {
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

  .search-bar-row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    width: 100%;
  }

  .search-input {
    flex: 1;
    height: 38px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 13px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .search-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-btn:hover {
    background: var(--color-primary-600);
  }

  .clear-search-btn {
    background: var(--color-white);
    color: var(--color-neutral-600);
    border: 1px solid var(--color-neutral-300);
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .clear-search-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .row-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .quick-action-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .quick-action-btn:hover, .quick-action-btn:focus {
    background: var(--color-primary-600);
    outline: none;
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
</style>
