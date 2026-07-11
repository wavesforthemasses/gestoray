<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, orderBy } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, FormField } from '$lib';
  import { Award, Clock, CheckCircle2, AlertCircle, Users, Wallet, FileText, Settings, Save, History, Unlock } from '@lucide/svelte';

  let loading = $state(true);
  let submitting = $state(false);
  let successMsg = $state('');
  let errorMsg = $state('');

  // Selected period
  let selectedMonth = $state(new Date().getMonth() + 1); // 1-12
  let selectedYear = $state(new Date().getFullYear());

  // Versions Data
  let versions = $state<any[]>([]);
  let activeVersion = $state<any>(null);

  // Derived states from activeVersion
  let isClosingFinalized = $derived(activeVersion?.status === 'finalized');
  let hasVersions = $derived(versions.length > 0);
  let hasAnyFinalized = $derived(versions.some(v => v.status === 'finalized'));

  // KPIs
  let totalIncassi = $derived(activeVersion?.totalIncassi || 0);
  let totalAllocated = $derived(activeVersion?.totalAllocated || 0);
  let totalCommissionsToLiquidate = $derived(activeVersion?.totalCommissions || 0);
  let vendorSummary = $derived(activeVersion?.breakdown || []);
  let allocationsList = $derived(activeVersion?.allocations || []);

  // Calculation Settings
  let calculationMode = $state('historical'); // 'historical' or 'current'

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    loadData();
    return () => unsubscribe();
  });

  async function loadData() {
    loading = true;
    successMsg = '';
    errorMsg = '';
    versions = [];
    activeVersion = null;

    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      
      const versionsRef = collection(db, 'commissions_closings', periodId, 'versions');
      const q = query(versionsRef, orderBy('generatedAt', 'desc'));
      const snap = await getDocs(q);
      
      const vList: any[] = [];
      snap.forEach((d: any) => {
        vList.push({ id: d.id, ...d.data() });
      });
      versions = vList;

      if (versions.length > 0) {
        const finalized = versions.find(v => v.status === 'finalized');
        activeVersion = finalized || versions[0];
      }
    } catch (e: any) {
      console.error(e);
      errorMsg = 'Errore nel caricamento delle versioni: ' + e.message;
    } finally {
      loading = false;
    }
  }

  function selectVersion(v: any) {
    activeVersion = v;
  }

  async function handleCalculate() {
    loading = true;
    successMsg = '';
    errorMsg = '';
    try {
      // 1. Fetch Users & Qualifications
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList: any[] = [];
      usersSnap.forEach((d: any) => usersList.push({ uid: d.id, ...d.data().original }));

      const qualsSnap = await getDocs(collection(db, 'qualifications'));
      const qualsMap = new Map<string, any>();
      qualsSnap.forEach((d: any) => qualsMap.set(d.id, { id: d.id, ...d.data() }));

      // 2. Fetch Payments in period
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

      const paymentsSnap = await getDocs(
        query(collection(db, 'payments'), where('original.date', '>=', startOfMonth), where('original.date', '<=', endOfMonth))
      );

      let sumIncassi = 0;
      const paymentIds: string[] = [];
      paymentsSnap.forEach((doc: any) => {
        sumIncassi += (doc.data().original?.amount || 0);
        paymentIds.push(doc.id);
      });

      // 3. Fetch Allocations (contractsPaid)
      const allocs: any[] = [];
      const contractsToFetch = new Set<string>();

      await Promise.all(paymentIds.map(async (payId) => {
        const allocSnap = await getDocs(collection(db, 'payments', payId, 'contractsPaid'));
        allocSnap.forEach((doc: any) => {
          const d = doc.data();
          allocs.push({
            id: doc.id,
            paymentId: payId,
            contractId: d.original?.contractId,
            amount: d.original?.amount || 0
          });
          if (d.original?.contractId) contractsToFetch.add(d.original.contractId);
        });
      }));

      // 4. Fetch Contracts
      const contractsMap = new Map<string, any>();
      await Promise.all(Array.from(contractsToFetch).map(async (cId) => {
        const contractSnap = await getDoc(doc(db, 'contracts', cId));
        if (contractSnap.exists()) {
          const data = contractSnap.data();
          contractsMap.set(cId, { id: cId, ...data.original, derived: data.derived });
        }
      }));

      // 5. Build Summary Map
      const summary = new Map<string, any>();
      usersList.forEach(u => {
        if (u.roles?.includes('commerciale')) {
          const qualId = u.qualification;
          let qualName = qualId || 'junior';
          let qualObj = null;
          if (qualId && qualsMap.has(qualId)) {
            qualObj = qualsMap.get(qualId);
            qualName = qualObj.name;
          }
          summary.set(u.uid, {
            uid: u.uid,
            name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
            email: u.email,
            qualification: qualName,
            qualObj: qualObj,
            salesInPeriod: 0,
            commissionInPeriod: 0
          });
        }
      });

      let sumAllocated = 0;
      const enrichedAllocs: any[] = [];

      // 6. Calculate
      allocs.forEach(alloc => {
        sumAllocated += alloc.amount;
        const contract = contractsMap.get(alloc.contractId);
        if (!contract) return;

        const totalPrice = contract.totalPrice || 0;
        if (totalPrice <= 0) return;

        const pctOfContractPaid = alloc.amount / totalPrice;

        let commissionPrimary = 0;
        let commissionSecondary = 0;

        const primaryUid = contract.vendorUid;
        const secondaryUid = contract.secondVendorUid;

        if (calculationMode === 'current') {
           let totalComm = 0;
           if (primaryUid && summary.has(primaryUid)) {
               const vendor = summary.get(primaryUid)!;
               const commPct = vendor.qualObj?.percentage || 0;
               totalComm = totalPrice * (commPct / 100);
           }
           const secShare = contract.secondVendorShare || 0;
           const secCommTotal = totalComm * (secShare / 100);
           const primCommTotal = totalComm - secCommTotal;
           
           commissionPrimary = primCommTotal;
           commissionSecondary = secCommTotal;
        } else {
           commissionPrimary = contract.derived?.commissionPrimary || 0;
           commissionSecondary = contract.derived?.commissionSecondary || 0;
        }

        if (primaryUid && summary.has(primaryUid)) {
          const vendor = summary.get(primaryUid)!;
          vendor.salesInPeriod += alloc.amount * (secondaryUid ? (1 - (contract.secondVendorShare || 0) / 100) : 1);
          vendor.commissionInPeriod += commissionPrimary * pctOfContractPaid;
        }

        if (secondaryUid && summary.has(secondaryUid)) {
          const vendor = summary.get(secondaryUid)!;
          vendor.salesInPeriod += alloc.amount * ((contract.secondVendorShare || 0) / 100);
          vendor.commissionInPeriod += commissionSecondary * pctOfContractPaid;
        }

        enrichedAllocs.push({
          paymentId: alloc.paymentId,
          contractId: alloc.contractId,
          clientName: contract.clientName || 'N/D',
          amount: alloc.amount,
          primaryEmail: contract.vendorEmail || 'N/D',
          secondVendorEmail: contract.secondVendorEmail,
          secondVendorShare: contract.secondVendorShare
        });
      });

      const finalBreakdown = Array.from(summary.values())
        .sort((a, b) => b.commissionInPeriod - a.commissionInPeriod)
        .map(v => ({
          uid: v.uid,
          name: v.name,
          email: v.email,
          qualification: v.qualification,
          sales: v.salesInPeriod,
          commission: v.commissionInPeriod
        }));

      const finalTotalCommissions = finalBreakdown.reduce((sum, v) => sum + v.commission, 0);

      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const now = new Date().toISOString();
      const versionId = `v_${Date.now()}`;

      const draftData = {
        month: selectedMonth,
        year: selectedYear,
        status: 'draft',
        generatedAt: now,
        generatedBy: $auth!.uid,
        generatedEmail: $auth!.email,
        calculationMode,
        totalIncassi: sumIncassi,
        totalAllocated: sumAllocated,
        totalCommissions: finalTotalCommissions,
        breakdown: finalBreakdown,
        allocations: enrichedAllocs
      };

      await setDoc(doc(db, 'commissions_closings', periodId), {
        month: selectedMonth,
        year: selectedYear,
        latestStatus: hasAnyFinalized ? 'finalized' : 'draft',
        updatedAt: now
      }, { merge: true });

      await setDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId), draftData);
      
      const newVersion = { id: versionId, ...draftData };
      versions = [newVersion, ...versions];
      activeVersion = newVersion;

      successMsg = 'Nuova bozza del prospetto provvigionale generata e salvata con successo!';
    } catch(e: any) {
      console.error(e);
      errorMsg = 'Errore durante la generazione del calcolo: ' + e.message;
    } finally {
      loading = false;
    }
  }

  async function handleFinalizeCommissions() {
    if (!$auth || !activeVersion || activeVersion.status === 'finalized') return;
    submitting = true;
    successMsg = '';
    errorMsg = '';

    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const now = new Date().toISOString();

      await updateDoc(doc(db, 'commissions_closings', periodId, 'versions', activeVersion.id), {
        status: 'finalized',
        finalizedAt: now,
        finalizedBy: $auth.uid,
        finalizedEmail: $auth.email
      });

      await updateDoc(doc(db, 'commissions_closings', periodId), {
        latestStatus: 'finalized',
        updatedAt: now
      });
      
      activeVersion.status = 'finalized';
      activeVersion.finalizedAt = now;
      activeVersion.finalizedEmail = $auth.email;

      versions = [...versions];
      successMsg = 'Versione provvigionale resa DEFINITIVA con successo!';
    } catch (e: any) {
      errorMsg = 'Errore durante la chiusura delle provvigioni: ' + e.message;
    } finally {
      submitting = false;
    }
  }
</script>

<div class="commissions-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">
      <AlertCircle size={16} />
      <span>{errorMsg}</span>
    </div>
  {/if}
  {#if successMsg}
    <div class="alert success animate-fade-in">
      <CheckCircle2 size={16} />
      <span>{successMsg}</span>
    </div>
  {/if}

  <div class="header-dashboard-section">
    <div class="period-selector-card">
      <div class="selector-form">
        <FormField id="sel-month" label="Mese">
          <select id="sel-month" bind:value={selectedMonth} onchange={loadData} disabled={loading}>
            <option value={1}>Gennaio</option>
            <option value={2}>Febbraio</option>
            <option value={3}>Marzo</option>
            <option value={4}>Aprile</option>
            <option value={5}>Maggio</option>
            <option value={6}>Giugno</option>
            <option value={7}>Luglio</option>
            <option value={8}>Agosto</option>
            <option value={9}>Settembre</option>
            <option value={10}>Ottobre</option>
            <option value={11}>Novembre</option>
            <option value={12}>Dicembre</option>
          </select>
        </FormField>

        <FormField id="sel-year" label="Anno">
          <select id="sel-year" bind:value={selectedYear} onchange={loadData} disabled={loading}>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </FormField>
      </div>

      <div class="status-summary-box">
        {#if !hasVersions}
           <div class="closing-status empty">
             <AlertCircle size={16} />
             <div class="status-details">
               <strong>NESSUN CALCOLO</strong>
               <span>Non è stata generata alcuna versione per questo mese.</span>
             </div>
           </div>
        {:else if hasAnyFinalized}
          <div class="closing-status finalized">
            <CheckCircle2 size={16} />
            <div class="status-details">
              <strong>MESE APPROVATO E CHIUSO</strong>
              <span>Esiste una versione definitiva approvata per questo mese.</span>
            </div>
          </div>
        {:else}
          <div class="closing-status pending">
            <Clock size={16} />
            <div class="status-details">
              <strong>BOZZA IN ATTESA</strong>
              <span>Ci sono versioni in bozza ma nessuna è stata approvata.</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- PANNELLO IMPOSTAZIONI: SEMPRE VISIBILE PER GENERARE NUOVE BOZZE -->
  <Card title="Nuovo Calcolo Provvigioni" description="Scegli la modalità con cui calcolare le provvigioni e salva una nuova versione.">
    {#snippet icon()}
      <Settings size={20} class="icon-accent" />
    {/snippet}

    <div class="calculation-settings">
      <FormField id="calc-mode" label="Metodo di calcolo delle percentuali provvigionali">
        <select id="calc-mode" bind:value={calculationMode} disabled={loading || submitting}>
          <option value="historical">Storica (Usa la percentuale salvata al momento del contratto)</option>
          <option value="current">Attuale (Usa la qualifica e la percentuale attuale del consulente)</option>
        </select>
      </FormField>

      <button class="generate-btn" onclick={handleCalculate} disabled={loading || submitting}>
        {#if loading}
          <span class="spinner-small"></span> Elaborazione in corso...
        {:else}
          {#if hasAnyFinalized}
            <Unlock size={16} /> Sblocca e Genera Nuova Bozza
          {:else}
            <Save size={16} /> Genera Nuova Bozza
          {/if}
        {/if}
      </button>
    </div>
  </Card>

  {#if loading}
    <!-- Caricamento nascosto o coperto dal pulsante se in elaborazione attiva -->
  {:else if !hasVersions}
    <div class="empty-state">
      <FileText size={48} color="var(--color-neutral-300)" />
      <h3>Nessun prospetto disponibile</h3>
      <p>Scegli le impostazioni in alto e clicca su "Genera Nuova Bozza" per calcolare le provvigioni del mese.</p>
    </div>
  {:else}
    <div class="layout-with-sidebar">
      <!-- SIDEBAR: STORICO VERSIONI -->
      <div class="versions-sidebar">
        <h3 class="versions-title">
          <History size={16} /> Storico Versioni
        </h3>
        <div class="versions-list">
          {#each versions as v, i}
            <button 
              class="version-item" 
              class:active={activeVersion?.id === v.id}
              class:finalized={v.status === 'finalized'}
              onclick={() => selectVersion(v)}
            >
              <div class="v-header">
                <span class="v-num">Versione {versions.length - i}</span>
                {#if v.status === 'finalized'}
                  <CheckCircle2 size={14} class="v-icon-success" />
                {/if}
              </div>
              <div class="v-date">{new Date(v.generatedAt).toLocaleString('it-IT')}</div>
              <div class="v-mode">Metodo: {v.calculationMode === 'historical' ? 'Storico' : 'Attuale'}</div>
              <div class="v-total">€ {v.totalCommissions?.toFixed(2)}</div>
            </button>
          {/each}
        </div>
      </div>

      <!-- MAIN CONTENT: DETTAGLI VERSIONE SELEZIONATA -->
      <div class="version-details">
        {#if activeVersion}
          <div class="kpi-grid" style="margin-bottom: 24px;">
            <div class="kpi-card">
              <div class="kpi-icon"><Wallet size={20} /></div>
              <div class="kpi-info">
                <span class="kpi-val">€ {totalIncassi.toFixed(2)}</span>
                <span class="kpi-lbl">Incassi Totali del Mese</span>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon"><FileText size={20} /></div>
              <div class="kpi-info">
                <span class="kpi-val">€ {totalAllocated.toFixed(2)}</span>
                <span class="kpi-lbl">Valore Allocato a Contratti</span>
              </div>
            </div>
            <div class="kpi-card highlight">
              <div class="kpi-icon"><Award size={20} /></div>
              <div class="kpi-info">
                <span class="kpi-val">€ {totalCommissionsToLiquidate.toFixed(2)}</span>
                <span class="kpi-lbl">Massa Provvigionale {isClosingFinalized ? 'Definitiva' : 'Bozza'}</span>
              </div>
            </div>
          </div>

          <Card title="Prospetto Provvigionale Consulenti" description="Riepilogo delle provvigioni spettanti a ciascun commerciale per questa versione. Metodo: {activeVersion.calculationMode === 'historical' ? 'Storico' : 'Qualifica Attuale'}.">
            {#snippet icon()}
              <Users size={20} class="icon-accent" />
            {/snippet}

            {#snippet headerSnippet()}
              {#if !isClosingFinalized && $activeRole !== 'direzione'}
                <button onclick={handleFinalizeCommissions} disabled={submitting || vendorSummary.length === 0} class="approve-closing-btn">
                  Approva e Rendi Definitive
                </button>
              {/if}
            {/snippet}

            {#if vendorSummary.length === 0}
              <div class="empty-txt" style="padding: 24px; text-align: center; color: var(--color-neutral-500);">Nessun commerciale attivo trovato nel database.</div>
            {:else}
              <table class="widescreen-table">
                <thead>
                  <tr>
                    <th>Consulente</th>
                    <th>Qualifica</th>
                    <th>Volume Incassato (Quota)</th>
                    <th>Importo Provvigione</th>
                    <th>Stato liquidazione</th>
                  </tr>
                </thead>
                <tbody>
                  {#each vendorSummary as row}
                    <tr>
                      <td>
                        <div class="user-cell">
                          <span class="u-name">{row.name}</span>
                          <span class="u-email">{row.email}</span>
                        </div>
                      </td>
                      <td>
                        <span class="badge qual-badge">{row.qualification.toUpperCase()}</span>
                      </td>
                      <td><strong>€ {row.sales.toFixed(2)}</strong></td>
                      <td><strong style="color: var(--color-success-text); font-size: 14px;">€ {row.commission.toFixed(2)}</strong></td>
                      <td>
                        <span class="status-pill" class:finalized={isClosingFinalized}>
                          {isClosingFinalized ? 'Pronta per Fatturazione' : 'Bozza Salvata'}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </Card>

          <div style="margin-top: 24px;">
            <Card title="Dettaglio Distribuzione Incassi del Mese" description="Elenco di tutti i singoli incassi inclusi in questo calcolo salvato.">
              {#snippet icon()}
                <Clock size={20} class="icon-accent" />
              {/snippet}

              {#if allocationsList.length === 0}
                <div class="empty-txt" style="padding: 24px; text-align: center; color: var(--color-neutral-500);">Nessuna transazione incassata in questo periodo.</div>
              {:else}
                <table class="widescreen-table">
                  <thead>
                    <tr>
                      <th>ID Incasso</th>
                      <th>Contratto Padre</th>
                      <th>Cliente</th>
                      <th>Importo Allocato</th>
                      <th>Consulente Primario</th>
                      <th>Split Co-selling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each allocationsList as alloc}
                      <tr>
                        <td><code>{alloc.paymentId}</code></td>
                        <td><code>{alloc.contractId}</code></td>
                        <td>{alloc.clientName}</td>
                        <td><strong>€ {alloc.amount.toFixed(2)}</strong></td>
                        <td>{alloc.primaryEmail}</td>
                        <td>
                          {#if alloc.secondVendorEmail}
                            <span class="co-seller-badge">{alloc.secondVendorEmail} ({alloc.secondVendorShare}%)</span>
                          {:else}
                            <span class="no-co-seller">Nessuno (100% primario)</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {/if}
            </Card>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .commissions-page {
    width: 100%;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 20px;
    line-height: 1.4;
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

  .period-selector-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 24px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .selector-form {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  :global(.selector-form .input-group) {
    margin-bottom: 0 !important;
  }

  .selector-form select {
    height: 38px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 13px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    min-width: 140px;
  }

  .status-summary-box {
    display: flex;
    align-items: center;
  }

  .closing-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-size: 12px;
  }

  .closing-status.finalized {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .closing-status.pending {
    background: var(--color-warning-light);
    border: 1px solid var(--color-warning-border);
    color: var(--color-warning-text);
  }
  
  .closing-status.empty {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-details strong {
    font-size: 13px;
    font-weight: 700;
  }

  .calculation-settings {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  .generate-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
    height: 38px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--color-primary-700);
  }
  
  .generate-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .empty-state {
    padding: 60px 20px;
    text-align: center;
    background: var(--color-white);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-neutral-300);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }
  .empty-state h3 {
    margin: 0;
    color: var(--color-neutral-800);
  }
  .empty-state p {
    margin: 0;
    color: var(--color-neutral-500);
    font-size: 14px;
    max-width: 400px;
  }

  .layout-with-sidebar {
    display: flex;
    gap: 24px;
    margin-top: 24px;
    align-items: flex-start;
  }

  .versions-sidebar {
    width: 280px;
    flex-shrink: 0;
    background: var(--color-white);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    overflow: hidden;
    position: sticky;
    top: 24px;
  }

  .versions-title {
    margin: 0;
    padding: 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
    background: var(--color-neutral-50);
    border-bottom: 1px solid var(--color-neutral-200);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .versions-list {
    display: flex;
    flex-direction: column;
    max-height: 600px;
    overflow-y: auto;
  }

  .version-item {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-neutral-100);
    padding: 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .version-item:hover {
    background: var(--color-neutral-50);
  }

  .version-item.active {
    background: var(--color-primary-50);
    border-left: 3px solid var(--color-primary-500);
  }

  .version-item.finalized {
    border-left: 3px solid var(--color-success);
  }

  .v-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .v-num {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-neutral-800);
  }

  .v-icon-success {
    color: var(--color-success-text);
  }

  .v-date {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .v-mode {
    font-size: 11px;
    color: var(--color-neutral-600);
    margin-top: 4px;
    background: var(--color-neutral-100);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
  }

  .v-total {
    font-weight: 700;
    color: var(--color-primary-600);
    margin-top: 8px;
    font-size: 14px;
  }

  .version-details {
    flex-grow: 1;
    min-width: 0;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .kpi-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .kpi-card.highlight {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-primary-100));
    border-color: var(--color-primary-200);
  }

  .kpi-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-neutral-50);
    color: var(--color-primary-600);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
  }

  .kpi-card.highlight .kpi-icon {
    background: var(--color-white);
    color: var(--color-primary-700);
  }

  .kpi-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi-val {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .kpi-lbl {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .approve-closing-btn {
    background: linear-gradient(135deg, var(--color-success), var(--color-success-text));
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
  }

  .approve-closing-btn:hover {
    opacity: 0.9;
  }

  .approve-closing-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .user-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .u-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .u-email {
    font-size: 11.5px;
    color: var(--color-neutral-500);
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    letter-spacing: 0.05em;
    display: inline-block;
  }

  .badge.qual-badge {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .status-pill {
    font-size: 11.5px;
    color: var(--color-neutral-500);
    font-weight: 500;
  }

  .status-pill.finalized {
    color: var(--color-success-text);
    font-weight: 700;
  }

  .co-seller-badge {
    background: hsla(270, 100%, 97%, 1);
    color: #7c3aed;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-xs);
  }

  .no-co-seller {
    color: var(--color-neutral-400);
    font-size: 11.5px;
  }

  .spinner-small {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }

  .widescreen-table th {
    text-align: left;
    padding: 12px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
    letter-spacing: 0.05em;
  }

  .widescreen-table td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--color-neutral-100);
    font-size: 13px;
  }
</style>
