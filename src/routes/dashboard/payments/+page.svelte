<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField } from '$lib';
  import { Wallet, Plus, ArrowLeft, Percent, Check, ChevronDown, ChevronUp, TrendingUp } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchData();
    return () => unsubscribe();
  });

  // Data collections
  let paymentsList = $state<Array<{ id: string, clientId: string, clientName: string, contractId: string, amount: number, date: string, recordedBy: string, recordedEmail: string }>>([]);
  let clientsList = $state<Array<{ id: string, nome: string, cognome?: string, email?: string }>>([]);
  let contractsList = $state<Array<{ id: string, clientId: string, clientName: string, totalPrice: number, status: string }>>([]);
  
  let loading = $state(true);
  let showAddForm = $state(false);

  // Form state
  let selectedClientId = $state('');
  let selectedContractId = $state('');
  let amountInput = $state<number | null>(null);
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  // Table columns
  const columns = [
    { key: 'date', header: 'Data Incasso' },
    { key: 'clientName', header: 'Cliente' },
    { key: 'contractId', header: 'ID Contratto' },
    { key: 'amount', header: 'Importo Netto' },
    { key: 'recordedEmail', header: 'Registrato Da' }
  ];

  async function fetchData() {
    loading = true;
    try {
      // 1. Fetch Payments
      const paymentsSnapshot = await getDocs(collection(db, 'payments'));
      const pList: typeof paymentsList = [];
      paymentsSnapshot.forEach((doc: any) => {
        const d = doc.data();
        pList.push({
          id: doc.id,
          clientId: d.clientId,
          clientName: d.clientName,
          contractId: d.contractId,
          amount: d.amount,
          date: d.date,
          recordedBy: d.recordedBy,
          recordedEmail: d.recordedEmail
        });
      });
      paymentsList = pList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 2. Fetch Clients (for form select dropdown)
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clList: typeof clientsList = [];
      clientsSnapshot.forEach((doc: any) => {
        const d = doc.data();
        clList.push({
          id: doc.id,
          nome: d.nome,
          cognome: d.cognome,
          email: d.email
        });
      });
      clientsList = clList.sort((a, b) => a.nome.localeCompare(b.nome));

      // 3. Fetch Contracts
      const contractsSnapshot = await getDocs(collection(db, 'contracts'));
      const coList: typeof contractsList = [];
      contractsSnapshot.forEach((doc: any) => {
        const d = doc.data();
        coList.push({
          id: doc.id,
          clientId: d.clientId,
          clientName: d.clientName,
          totalPrice: d.totalPrice,
          status: d.status
        });
      });
      contractsList = coList;
    } catch (e) {
      console.error('Error fetching payments data:', e);
    } finally {
      loading = false;
    }
  }

  // Filtered contracts of selected client
  let clientContracts = $derived(
    contractsList.filter(c => c.clientId === selectedClientId)
  );

  // Sync amount field to contract price when selecting a contract
  function handleContractChange(id: string) {
    const contr = clientContracts.find(c => c.id === id);
    if (contr) {
      amountInput = contr.totalPrice;
    } else {
      amountInput = null;
    }
  }

  // VAT Scorporo tool: Net = Gross / 1.22
  function handleScorporoIva() {
    if (amountInput !== null) {
      amountInput = parseFloat((amountInput / 1.22).toFixed(2));
    }
  }

  // Record payment submit handler
  async function handleRegisterPayment(e: Event) {
    e.preventDefault();
    if (!selectedClientId || !selectedContractId || amountInput === null || !$auth) return;

    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      const client = clientsList.find(c => c.id === selectedClientId);
      const clientFullName = client ? `${client.nome} ${client.cognome || ''}`.trim() : 'Sconosciuto';

      const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
      const newPayment = {
        clientId: selectedClientId,
        clientName: clientFullName,
        contractId: selectedContractId,
        amount: amountInput,
        date: new Date().toISOString(),
        recordedBy: $auth.uid,
        recordedEmail: $auth.email
      };

      // 1. Save payment record
      await setDoc(doc(db, 'payments', paymentId), newPayment);

      // 2. Set contract status to approved and record approval timestamps
      // Fetch full contract object to preserve structure
      const contractDoc = await getDocs(collection(db, 'contracts'));
      let fullContractData: any = null;
      contractDoc.forEach((doc: any) => {
        if (doc.id === selectedContractId) {
          fullContractData = doc.data();
        }
      });

      if (fullContractData) {
        await setDoc(doc(db, 'contracts', selectedContractId), {
          ...fullContractData,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: $auth.uid,
          approvedEmail: $auth.email
        });
      }

      successMsg = `Incasso registrato con successo per €${amountInput.toFixed(2)}. Il contratto è stato approvato!`;
      
      // Reset form
      selectedClientId = '';
      selectedContractId = '';
      amountInput = null;
      showAddForm = false;

      await fetchData();
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante la registrazione dell\'incasso.';
    } finally {
      submitting = false;
    }
  }

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);

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
    return chartPeriods.map((p) => {
      const dbValue = paymentsList
        .filter(pay => {
          const d = new Date(pay.date);
          return d >= p.start && d <= p.end;
        })
        .reduce((sum, pay) => sum + pay.amount, 0);

      return dbValue;
    });
  });

  let svgPointsData = $derived.by(() => {
    const data = computedChartPoints;
    const maxVal = Math.max(...data, 1000);
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

  // Filtered payments list based on selected point
  let filteredPayments = $derived.by(() => {
    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      return paymentsList.filter(pay => {
        const d = new Date(pay.date);
        return d >= period.start && d <= period.end;
      });
    }
    return paymentsList;
  });
</script>

<svelte:head>
  <title>Gestione Incassi Cassa | Gestoray</title>
</svelte:head>

<div class="payments-page animate-fade-in">
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
        <Card title="Andamento Incassi Cassa (GI)" description="Clicca su un punto del grafico per filtrare il registro incassi in base al periodo selezionato.">
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
            <span>Massimo: €{svgPointsData.maxVal.toLocaleString('it-IT')}</span>
            {#if selectedPointIdx !== null}
              <span class="selected-period-banner">
                Filtro attivo: <strong>{chartPeriods[selectedPointIdx].label}</strong> (Valore: €{computedChartPoints[selectedPointIdx].toLocaleString('it-IT')})
                <button onclick={() => selectedPointIdx = null} class="clear-filter-btn">Azzera filtro</button>
              </span>
            {/if}
            <span>Minimo: 0</span>
          </div>
        </Card>
      </div>
    {/if}

    <Card
      title="Registro Incassi Cassa"
      description="Visualizza lo storico dei pagamenti riscossi. I pagamenti approvano automaticamente i contratti pendenti."
      class="list-card"
    >
      {#snippet icon()}
        <Wallet size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        {#if $activeRole !== 'direzione'}
          <button onclick={() => { showAddForm = true; successMsg = ''; errorMsg = ''; }} class="add-payment-btn">
            <Plus size={16} /> Registra Nuovo Incasso
          </button>
        {/if}
      {/snippet}

      {#if loading}
        <div class="loader-box">
          <span class="spinner"></span>
          Caricamento registro incassi...
        </div>
      {:else}
        {#snippet cell(col: any, row: any)}
          {#if col.key === 'date'}
            <span class="date-cell">{new Date(row.date).toLocaleString('it-IT')}</span>
          {:else if col.key === 'clientName'}
            <span class="name-cell">{row.clientName}</span>
          {:else if col.key === 'contractId'}
            <span class="contract-id-cell"><code>{row.contractId}</code></span>
          {:else if col.key === 'amount'}
            <span class="amount-cell">€ {row.amount.toFixed(2)}</span>
          {:else if col.key === 'recordedEmail'}
            <span class="recorded-cell">{row.recordedEmail}</span>
          {/if}
        {/snippet}

        <div class="table-wrapper">
          <Table
            {columns}
            data={filteredPayments}
            cellSnippet={cell}
            emptyText="Nessun incasso presente nel registro contabile."
          />
        </div>
      {/if}
    </Card>
  {:else}
    <Card
      title="Registra Nuovo Incasso"
      description="Seleziona il cliente e il relativo contratto per cui registrare l'avvenuto pagamento."
      class="form-card"
    >
      {#snippet icon()}
        <Wallet size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = false; successMsg = ''; errorMsg = ''; }} class="back-link">
          <ArrowLeft size={14} /> Annulla e Torna al registro
        </button>
      {/snippet}

      <form onsubmit={handleRegisterPayment} class="payment-form">
        <!-- 1. Select Client -->
        <FormField id="pay-client" label="Seleziona Cliente" helpText="Scegli il cliente per visualizzarne i contratti emessi.">
          <select id="pay-client" bind:value={selectedClientId} required disabled={submitting}>
            <option value="">-- Seleziona Cliente --</option>
            {#each clientsList as c}
              <option value={c.id}>{c.nome} {c.cognome || ''}</option>
            {/each}
          </select>
        </FormField>

        <!-- 2. Select Contract (after client chosen) -->
        {#if selectedClientId}
          <FormField id="pay-contract" label="Seleziona Contratto Associato" helpText="Seleziona il contratto per cui inserire il saldo cassa.">
            <select 
              id="pay-contract" 
              bind:value={selectedContractId} 
              onchange={(e) => handleContractChange((e.target as HTMLSelectElement).value)}
              required 
              disabled={submitting}
            >
              <option value="">-- Seleziona Contratto --</option>
              {#each clientContracts as contr}
                <option value={contr.id}>
                  Contratto {contr.id} &mdash; €{contr.totalPrice.toFixed(2)} ({contr.status === 'approved' ? 'Approvato' : 'In attesa'})
                </option>
              {/each}
              {#if clientContracts.length === 0}
                <option value="" disabled>Nessun contratto registrato per questo cliente</option>
              {/if}
            </select>
          </FormField>
        {/if}

        <!-- 3. Net Value Input & VAT calculator -->
        {#if selectedContractId}
          <div class="amount-field-wrapper">
            <FormField 
              id="pay-amount" 
              label="Importo Netto Incassato (€)" 
              helpText="Digita l'importo imponibile al netto di IVA. Il prezzo lordo contrattuale è preselezionato."
            >
              <div class="input-with-button">
                <input
                  type="number"
                  id="pay-amount"
                  bind:value={amountInput}
                  placeholder="es. 1000.00"
                  required
                  min="0"
                  step="0.01"
                  disabled={submitting}
                />
                <button 
                  type="button" 
                  onclick={handleScorporoIva} 
                  class="vat-btn"
                  title="Dividi l'importo immesso per 1.22 per ricavare l'imponibile netto al volo"
                  disabled={submitting || amountInput === null}
                >
                  <Percent size={14} /> Scorpora IVA (22%)
                </button>
              </div>
            </FormField>
          </div>
        {/if}

        <button type="submit" class="submit-btn" disabled={submitting || !selectedContractId || amountInput === null}>
          {#if submitting}
            Registrazione in corso...
          {:else}
            Registra e Approva Contratto
          {/if}
        </button>
      </form>
    </Card>
  {/if}
</div>

<style>
  .payments-page {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-payment-btn {
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

  .add-payment-btn:hover {
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

  .date-cell {
    color: var(--color-neutral-500);
  }

  .name-cell {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .contract-id-cell code {
    background: var(--color-neutral-100);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .amount-cell {
    font-weight: 700;
    color: var(--color-success-text);
  }

  .recorded-cell {
    color: var(--color-neutral-500);
    font-size: 12px;
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

  .payment-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .input-with-button {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .input-with-button input {
    flex: 1;
  }

  .vat-btn {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .vat-btn:hover:not(:disabled) {
    background: var(--color-neutral-200);
    color: var(--color-neutral-800);
  }

  .vat-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Expandable trend chart styles */
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
</style>
