<script lang="ts">
  import { auth, activeRole } from "$lib/auth";
  import { auth as clientAuth } from "$lib/firebase";
  import { 
    db, 
    collection, 
    getDocs, 
    getDoc, 
    doc, 
    query, 
    where, 
    getCountFromServer, 
    getAggregateFromServer, 
    sum,
    collectionGroup,
    orderBy
  } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { Card, FormField, LineChart } from "$lib";
  import {
    Zap,
    Shield,
    Briefcase,
    TrendingUp,
    Users,
    DollarSign,
    Wallet,
    FileText,
    Phone,
    Calendar,
    CheckCircle,
    Clock,
    AlertTriangle,
    ChevronUp,
    ChevronDown,
    Search,
    Eye
  } from "@lucide/svelte";

  // Dashboard Stats States
  let loadingData = $state(true);
  let loadingChart = $state(false);

  // Admin stats
  let totalClienti = $state(0);
  let totalVenduto = $state(0);
  let totalIncassato = $state(0);
  let totalNNCF = $state(0);
  let totalContratti = $state(0);
  let pendingContratti = $state(0);

  // Commercial stats (from user document)
  let commContractsCount = $state(0);
  let commTotalSold = $state(0);
  let commApprovedSold = $state(0);
  let commMaturate = $state(0);
  let commSospese = $state(0);
  let commTotalNNCF = $state(0);

  // Activity KPIs
  let activityCalls = $state(0);
  let activityMeetings = $state(0);
  let activityAppointments = $state(0);

  // Administration Tables
  let adminPendingContracts = $state<any[]>([]);
  let adminOverdueInstallments = $state<any[]>([]);

  // Advanced chart configurations
  let activeChartTab = $state<"vss" | "gi" | "nuove_anagrafiche" | "nncf" | "Telefonata" | "Incontro" | "Appuntamento">("vss");
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let selectedPointIdx = $state<number | null>(null);

  // Chart data
  let chartRawDataList = $state<any[]>([]); // holds raw docs fetched for memory filtering
  let usersList = $state<any[]>([]);

  // Drill-down live filters
  let clientFilter = $state('');
  let vendorFilter = $state('');
  let productFilter = $state('');

  async function fetchDashboardKPIs() {
    loadingData = true;
    try {
      const myUid = clientAuth.currentUser?.uid;
      if (!myUid) return;

      const role = $activeRole;

      // 1. Fetch current user profile to read derived KPIs
      const userSnap = await getDoc(doc(db, 'users', myUid));
      if (userSnap.exists()) {
        const uData = userSnap.data() || {};
        const uDerived = uData.derived || {};
        commContractsCount = uDerived.totalContractsCount || 0;
        commTotalSold = (uDerived.totalPendingSales || 0) + (uDerived.totalApprovedSales || 0);
        commApprovedSold = uDerived.totalApprovedSales || 0;
        commMaturate = uDerived.totalCommissionEarned || 0;
        commSospese = uDerived.totalCommissionPending || 0;
        commTotalNNCF = uDerived.totalNNCF || 0;
      }

      // 2. Fetch global directional KPIs if admin/direzione
      if (role !== 'commerciale') {
        const [
          clientsCountSnap,
          approvedContractsValSnap,
          paymentsValSnap,
          nncfCountSnap,
          contractsCountSnap,
          pendingContractsSnap
        ] = await Promise.all([
          getCountFromServer(collection(db, 'clients')),
          getAggregateFromServer(query(collection(db, 'contracts'), where('original.status', '==', 'approved')), { val: sum('original.totalPrice') }),
          getAggregateFromServer(collection(db, 'payments'), { val: sum('original.amount') }),
          getCountFromServer(query(collection(db, 'clients'), where('derived.nncfOrderId', '!=', null))),
          getCountFromServer(collection(db, 'contracts')),
          getCountFromServer(query(collection(db, 'contracts'), where('original.status', '==', 'pending')))
        ]);

        totalClienti = clientsCountSnap.data().count;
        totalVenduto = approvedContractsValSnap.data().val || 0;
        totalIncassato = paymentsValSnap.data().val || 0;
        totalNNCF = nncfCountSnap.data().count;
        totalContratti = contractsCountSnap.data().count;
        pendingContratti = pendingContractsSnap.data().count;

        // Fetch users list for vendor dropdown filters
        const usersSnap = await getDocs(query(collection(db, 'users'), where('original.roles', 'array-contains', 'commerciale')));
        const uList: any[] = [];
        usersSnap.forEach((d: any) => {
          uList.push({ uid: d.id, ...d.data()?.original });
        });
        usersList = uList;
      }

      // 3. Fetch activity counts
      const today = new Date().toISOString();
      if (role === 'commerciale') {
        const [callsSnap, meetingsSnap, apptsSnap] = await Promise.all([
          getCountFromServer(query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('original.type', 'in', ['Telefonata', 'Sollecito Telefonico']))),
          getCountFromServer(query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('original.type', 'in', ['Incontro', 'Sollecito PEC']))),
          getCountFromServer(query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('original.type', 'in', ['Appuntamento', 'Sollecito Email'])))
        ]);
        activityCalls = callsSnap.data().count;
        activityMeetings = meetingsSnap.data().count;
        activityAppointments = apptsSnap.data().count;
      } else {
        const [callsSnap, meetingsSnap, apptsSnap] = await Promise.all([
          getCountFromServer(query(collectionGroup(db, 'activities'), where('original.type', 'in', ['Telefonata', 'Sollecito Telefonico']))),
          getCountFromServer(query(collectionGroup(db, 'activities'), where('original.type', 'in', ['Incontro', 'Sollecito PEC']))),
          getCountFromServer(query(collectionGroup(db, 'activities'), where('original.type', 'in', ['Appuntamento', 'Sollecito Email'])))
        ]);
        activityCalls = callsSnap.data().count;
        activityMeetings = meetingsSnap.data().count;
        activityAppointments = apptsSnap.data().count;
      }

      // 4. Fetch admin tables
      if (role === 'amministrazione' || role === 'superadmin') {
        const [pendingContrSnap, overdueInstSnap] = await Promise.all([
          getDocs(query(collection(db, 'contracts'), where('original.status', '==', 'pending'), orderBy('edits.createdAt', 'desc'))),
          getDocs(query(collectionGroup(db, 'installments'), where('original.status', '==', 'pending'), where('original.dueDate', '<', today.split('T')[0])))
        ]);

        const pList: any[] = [];
        pendingContrSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          pList.push({ id: docSnap.id, ...data.original, ...data.edits });
        });
        adminPendingContracts = pList;

        const oList: any[] = [];
        overdueInstSnap.forEach((docSnap: any) => {
          const data = docSnap.data()?.original || {};
          oList.push({
            id: docSnap.id,
            ...data
          });
        });
        adminOverdueInstallments = oList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      }

    } catch (e) {
      console.error("Error loading KPIs:", e);
    } finally {
      loadingData = false;
    }
  }

  // Generate date ranges backwards from endDateString
  let chartPeriods = $derived.by(() => {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date; end: Date; label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 11; i >= 0; i--) { // Shortened to 12 weeks for better UX and performance
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({
          start: pStart,
          end: pEnd,
          label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}`
        });
      }
    } else if (granularity === 'mensile') {
      for (let i = 11; i >= 0; i--) { // 12 months
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
      for (let i = 4; i >= 0; i--) { // 5 years
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

  async function fetchChartDataPoints() {
    if (chartPeriods.length === 0) return;
    loadingChart = true;

    try {
      const minDate = chartPeriods[0].start.toISOString();
      const myUid = clientAuth.currentUser?.uid;
      const isComm = $activeRole === 'commerciale';

      let docsList: any[] = [];

      if (activeChartTab === 'vss') {
        // Query contracts in timeframe
        let q;
        if (isComm) {
          // Fetch where vendor is primary or secondary
          const [primarySnap, secondarySnap] = await Promise.all([
            getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid), where('edits.createdAt', '>=', minDate))),
            getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid), where('edits.createdAt', '>=', minDate)))
          ]);
          primarySnap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
          secondarySnap.forEach((d: any) => {
            if (!docsList.some(x => x.id === d.id)) docsList.push({ id: d.id, ...d.data() });
          });
        } else {
          const snap = await getDocs(query(collection(db, 'contracts'), where('edits.createdAt', '>=', minDate)));
          snap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
        }
      } else if (activeChartTab === 'gi') {
        // Query payments in timeframe
        const snap = await getDocs(query(collection(db, 'payments'), where('original.date', '>=', minDate)));
        snap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));

        // If commercial, fetch their contracts to filter payments in memory
        if (isComm) {
          const [primarySnap, secondarySnap] = await Promise.all([
            getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid))),
            getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid)))
          ]);
          const myContractIds = new Set<string>();
          primarySnap.forEach((d: any) => myContractIds.add(d.id));
          secondarySnap.forEach((d: any) => myContractIds.add(d.id));

          // Fetch allocated slices for these contracts (collectionGroup contractsPaid query)
          const allocationsSnap = await getDocs(query(collectionGroup(db, 'contractsPaid'), where('original.contractId', 'in', Array.from(myContractIds))));
          const validPaymentIds = new Set(allocationsSnap.docs.map((doc: any) => doc.data()?.original?.paymentId));
          
          docsList = docsList.filter(pay => validPaymentIds.has(pay.id)).map(pay => {
            // Find allocation amount
            const alloc = allocationsSnap.docs.find((a: any) => a.data()?.original?.paymentId === pay.id);
            return {
              ...pay,
              original: {
                ...pay.original,
                amount: alloc ? alloc.data().original.amount : pay.original.amount
              }
            };
          });
        }
      } else if (activeChartTab === 'nuove_anagrafiche') {
        let q;
        if (isComm) {
          q = query(collection(db, 'clients'), where('original.createdBy', '==', myUid), where('edits.createdAt', '>=', minDate));
        } else {
          q = query(collection(db, 'clients'), where('edits.createdAt', '>=', minDate));
        }
        const snap = await getDocs(q);
        snap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
      } else if (activeChartTab === 'nncf') {
        let q;
        if (isComm) {
          q = query(collection(db, 'clients'), where('original.createdBy', '==', myUid), where('derived.nncfDate', '>=', minDate));
        } else {
          q = query(collection(db, 'clients'), where('derived.nncfDate', '>=', minDate));
        }
        const snap = await getDocs(q);
        snap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
      } else {
        // Activity tab types
        let q;
        if (isComm) {
          q = query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('edits.createdAt', '>=', minDate));
        } else {
          q = query(collectionGroup(db, 'activities'), where('edits.createdAt', '>=', minDate));
        }
        const snap = await getDocs(q);
        snap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
      }

      chartRawDataList = docsList;
    } catch (e) {
      console.error("Error fetching chart data:", e);
    } finally {
      loadingChart = false;
    }
  }

  // Reactively calculate chart points
  let computedChartPoints = $derived.by(() => {
    return chartPeriods.map((p) => {
      const filtered = chartRawDataList.filter((item) => {
        let dateVal = '';
        if (activeChartTab === 'vss') {
          dateVal = item.edits?.createdAt || item.original?.createdAt;
        } else if (activeChartTab === 'gi') {
          dateVal = item.original?.date;
        } else if (activeChartTab === 'nuove_anagrafiche') {
          dateVal = item.edits?.createdAt;
        } else if (activeChartTab === 'nncf') {
          dateVal = item.derived?.nncfDate;
        } else {
          dateVal = item.edits?.createdAt || item.original?.date;
        }

        if (!dateVal) return false;
        const d = new Date(dateVal);
        return d >= p.start && d <= p.end;
      });

      if (activeChartTab === 'vss' || activeChartTab === 'gi') {
        return filtered.reduce((sum, item) => sum + (item.original?.totalPrice || item.original?.amount || 0), 0);
      }

      // For activity types tab, filter by the active activity type
      if (activeChartTab === 'Telefonata' || activeChartTab === 'Incontro' || activeChartTab === 'Appuntamento') {
        const matchType = activeChartTab;
        const activityFiltered = filtered.filter(a => {
          const type = a.original?.type || '';
          if (matchType === 'Telefonata') return type === 'Telefonata' || type === 'Sollecito Telefonico';
          if (matchType === 'Incontro') return type === 'Incontro' || type === 'Sollecito PEC';
          if (matchType === 'Appuntamento') return type === 'Appuntamento' || type === 'Sollecito Email';
          return type === matchType;
        });
        return activityFiltered.length;
      }

      return filtered.length;
    });
  });

  // Drill-Down detailed records
  let drillDownItems = $derived.by(() => {
    if (selectedPointIdx === null || selectedPointIdx < 0 || selectedPointIdx >= chartPeriods.length) {
      return [];
    }

    const period = chartPeriods[selectedPointIdx];
    const matchQuery = (val: string | undefined, q: string) => {
      if (!q) return true;
      return val?.toLowerCase().includes(q.toLowerCase()) || false;
    };

    let items = chartRawDataList.filter((item) => {
      let dateVal = '';
      if (activeChartTab === 'vss') {
        dateVal = item.edits?.createdAt || item.original?.createdAt;
      } else if (activeChartTab === 'gi') {
        dateVal = item.original?.date;
      } else if (activeChartTab === 'nuove_anagrafiche') {
        dateVal = item.edits?.createdAt;
      } else if (activeChartTab === 'nncf') {
        dateVal = item.derived?.nncfDate;
      } else {
        dateVal = item.edits?.createdAt || item.original?.date;
      }

      if (!dateVal) return false;
      const d = new Date(dateVal);
      return d >= period.start && d <= period.end;
    });

    // Apply drilldown filters
    if (clientFilter) {
      items = items.filter(i => matchQuery(i.original?.clientName || i.original?.nome, clientFilter));
    }
    if (vendorFilter) {
      items = items.filter(i => i.original?.vendorUid === vendorFilter || i.original?.createdBy === vendorFilter || i.original?.loggedBy === vendorFilter);
    }
    if (productFilter) {
      items = items.filter(i => {
        const prods = i.original?.products || i.original?.items || [];
        return prods.some((p: any) => matchQuery(p.name, productFilter));
      });
    }

    return items.map((item) => {
      const isComm = $activeRole === 'commerciale';
      const myUid = clientAuth.currentUser?.uid;

      if (activeChartTab === 'vss') {
        const orig = item.original || {};
        let displayVal = orig.totalPrice || 0;
        let info = 'Quota Primario (100%)';
        if (orig.secondVendorUid) {
          if (isComm) {
            if (orig.vendorUid === myUid) {
              displayVal = displayVal * (100 - orig.secondVendorShare) / 100;
              info = `Quota Primario (${100 - orig.secondVendorShare}%)`;
            } else {
              displayVal = displayVal * orig.secondVendorShare / 100;
              info = `Quota Co-selling (${orig.secondVendorShare}%)`;
            }
          } else {
            info = `Ripartito: ${100 - orig.secondVendorShare}% / ${orig.secondVendorShare}%`;
          }
        }
        return {
          id: item.id,
          cliente: orig.clientName,
          consulente: orig.vendorEmail + (orig.secondVendorEmail ? ` / ${orig.secondVendorEmail}` : ''),
          data: new Date(item.edits?.createdAt || orig.createdAt).toLocaleDateString('it-IT'),
          valore: displayVal,
          dettaglio: info,
          status: orig.status === 'approved' ? 'Approvato' : 'In attesa',
          link: `/dashboard/contracts/${item.id}`
        };
      } else if (activeChartTab === 'gi') {
        const orig = item.original || {};
        return {
          id: item.id,
          cliente: orig.clientName,
          consulente: orig.recordedEmail || 'Cassa',
          data: new Date(orig.date).toLocaleDateString('it-IT'),
          valore: orig.amount,
          dettaglio: 'Riscossione fattura',
          status: 'Incassato',
          link: `/dashboard/payments`
        };
      } else if (activeChartTab === 'nuove_anagrafiche' || activeChartTab === 'nncf') {
        const orig = item.original || {};
        return {
          id: item.id,
          cliente: `${orig.nome} ${orig.cognome || ''}`.trim(),
          consulente: orig.email || 'N/A',
          data: new Date(item.derived?.nncfDate || item.edits?.createdAt).toLocaleDateString('it-IT'),
          valore: activeChartTab === 'nncf' ? 'NNCF Attivo' : 'Nuovo Lead',
          dettaglio: orig.phone || 'N/D',
          status: 'Anagrafica',
          link: `/dashboard/clients/${item.id}`
        };
      } else {
        const orig = item.original || {};
        return {
          id: item.id,
          cliente: orig.clientName || 'N/D',
          consulente: orig.loggedEmail || 'Commerciale',
          data: new Date(item.edits?.createdAt || orig.date).toLocaleDateString('it-IT'),
          valore: '-',
          dettaglio: orig.notes || 'Registrazione attività',
          status: orig.type || 'Attività',
          link: `/dashboard/clients/${orig.clientId}?tab=activities`
        };
      }
    });
  });

  onMount(() => {
    const unsubscribe = auth.subscribe(($auth) => {
      if (!$auth) {
        setTimeout(() => {
          if (!clientAuth.currentUser) {
            goto("/login");
          }
        }, 800);
      }
    });

    fetchDashboardKPIs();
    return () => unsubscribe();
  });

  // Reactively fetch new chart points whenever filters or tabs change
  $effect(() => {
    if (activeChartTab || granularity || endDateString || $activeRole) {
      fetchChartDataPoints();
    }
  });

  async function handleApproveContract(contractId: string) {
    const role = $activeRole;
    if (role !== 'superadmin' && role !== 'amministrazione') return;

    try {
      const contractRef = doc(db, 'contracts', contractId);
      const contractSnap = await getDoc(contractRef);
      if (contractSnap.exists()) {
        const cData = contractSnap.data();
        await contractRef.update({
          'original.status': 'approved',
          'original.approvedAt': new Date().toISOString(),
          'original.approvedBy': clientAuth.currentUser?.uid || 'system',
          'original.approvedEmail': clientAuth.currentUser?.email || 'system'
        });
        alert('Contratto approvato con successo!');
        await fetchDashboardKPIs();
      }
    } catch (e: any) {
      alert('Errore durante l\'approvazione: ' + e.message);
    }
  }
</script>

<svelte:head>
  <title>Dashboard | Gestoray</title>
</svelte:head>

{#if $auth}
  <div class="dashboard-viewport">
    {#if $activeRole === 'amministrazione'}
      <!-- 1. Alternative dashboard layout for amministrazione role -->
      <div class="dashboard-panoramica admin-layout animate-fade-in">
        <Card
          title="Pannello di Amministrazione & Recupero Crediti"
          description="Monitora l'approvazione delle transazioni commerciali e gestisci le rate insolute."
          variant="glass"
          class="welcome-banner"
          style="--card-padding: 30px 40px;"
        />

        {#if loadingData}
          <div class="loader-box">
            <span class="spinner"></span>
            Caricamento dati amministrativi...
          </div>
        {:else}
          <!-- Admin KPIs Deck -->
          <section class="kpi-deck">
            <div class="kpi-tile border-warning">
              <div class="kpi-icon warning"><Clock size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Contratti Da Approvare</span>
                <span class="kpi-val">{adminPendingContracts.length}</span>
                <span class="kpi-sub">In attesa di verifica contabile</span>
              </div>
            </div>

            <div class="kpi-tile border-success">
              <div class="kpi-icon success"><CheckCircle size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Contratti Approvati</span>
                <span class="kpi-val">{totalContratti - pendingContratti}</span>
                <span class="kpi-sub">Transazioni chiuse nel sistema</span>
              </div>
            </div>

            <div class="kpi-tile border-error">
              <div class="kpi-icon error"><AlertTriangle size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Rate Overdue (Insoluti)</span>
                <span class="kpi-val">{adminOverdueInstallments.length}</span>
                <span class="kpi-sub">Scadenze di pagamento superate</span>
              </div>
            </div>
          </section>

          <!-- Main Content split -->
          <div class="admin-split-grid">
            <!-- Section 1: Pending contracts list -->
            <Card title="Nuovi Ordini Da Approvare" description="Elenco dei contratti pendenti. Clicca su Gestisci per approvarli o verificare i dettagli.">
              {#snippet icon()}
                <Clock size={20} class="icon-accent" />
              {/snippet}
              
              {#if adminPendingContracts.length === 0}
                <div class="empty-panel">Nessun ordine in attesa di approvazione.</div>
              {:else}
                <div class="table-wrapper">
                  <table class="widescreen-table admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Consulente</th>
                        <th>Prezzo Totale</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each adminPendingContracts as c}
                        <tr>
                          <td><strong>{c.clientName}</strong></td>
                          <td>{c.vendorEmail}</td>
                          <td><strong>€ {c.totalPrice.toFixed(2)}</strong></td>
                          <td>
                            <button onclick={() => goto(`/dashboard/contracts/${c.id}`)} class="approve-collect-btn" style="padding: 4px 10px; font-size: 11px;">
                              Gestisci
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </Card>

            <!-- Section 2: Overdue payments tracker -->
            <Card title="Scadenziario Recupero Crediti" description="Registro delle rate insolute. Ricorda di sollecitare il cliente se lo stato è overdue.">
              {#snippet icon()}
                <AlertTriangle size={20} class="icon-error-accent" style="color: var(--color-error);" />
              {/snippet}

              {#if adminOverdueInstallments.length === 0}
                <div class="empty-panel">Nessuna rata o scadenza insoluta rilevata.</div>
              {:else}
                <div class="table-wrapper">
                  <table class="widescreen-table admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Scadenza</th>
                        <th>Importo</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each adminOverdueInstallments as inst}
                        <tr style="background-color: hsla(0, 100%, 99%, 1);">
                          <td>
                            <strong>{inst.clientName}</strong>
                            <span class="warning-badge-inline">SOLLECITARE CLIENTE!</span>
                          </td>
                          <td><span style="font-weight: 600; color: var(--color-error-text);">{new Date(inst.dueDate).toLocaleDateString('it-IT')}</span></td>
                          <td><strong>€ {inst.expectedAmount.toFixed(2)}</strong></td>
                          <td>
                            <button onclick={() => goto(`/dashboard/contracts/${inst.contractId}`)} class="back-link-btn" style="padding: 4px 10px; font-size: 11px;">
                              Dettaglio
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </Card>
          </div>
        {/if}
      </div>
    {:else}
      <!-- 2. Commercial / Management (Direzione / Superadmin) Dashboard -->
      <div class="dashboard-panoramica animate-fade-in">
        <!-- Top Welcome Banner -->
        <Card
          title="Benvenuto nel tuo pannello di controllo"
          description="Qui puoi visualizzare le informazioni e i trend grafici abilitati per i tuoi ruoli aziendali."
          variant="glass"
          class="welcome-banner"
          style="--card-padding: 30px 40px;"
        />

        {#if loadingData}
          <div class="loader-box">
            <span class="spinner"></span>
            Aggiornamento dati analitici...
          </div>
        {:else}
          <!-- Financial KPIs Block -->
          {#if $activeRole === "commerciale"}
            <section class="kpi-deck">
              <div class="kpi-tile border-primary">
                <div class="kpi-icon primary"><Briefcase size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Contratti Chiusi</span>
                  <span class="kpi-val">{commContractsCount}</span>
                  <span class="nav-label">Totale ordinato: € {commTotalSold.toFixed(2)}</span>
                </div>
              </div>

              <div class="kpi-tile border-success">
                <div class="kpi-icon success"><DollarSign size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Provvigioni Maturate</span>
                  <span class="kpi-val">€ {commMaturate.toFixed(2)}</span>
                  <span class="kpi-sub">Fatturato incassato: € {commApprovedSold.toFixed(2)}</span>
                </div>
              </div>

              <div class="kpi-tile border-warning">
                <div class="kpi-icon warning"><Wallet size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Provvigioni In Sospeso</span>
                  <span class="kpi-val">€ {commSospese.toFixed(2)}</span>
                  <span class="kpi-sub">In attesa di approvazione amministrativa</span>
                </div>
              </div>

              <div class="kpi-tile border-primary">
                <div class="kpi-icon primary"><FileText size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Primi Ordini (NNCF)</span>
                  <span class="kpi-val">{commTotalNNCF}</span>
                  <span class="kpi-sub">Contratti primo acquisto clienti</span>
                </div>
              </div>
            </section>
          {:else}
            <!-- superadmin & direzione global stats view -->
            <section class="kpi-deck">
              <div class="kpi-tile border-primary">
                <div class="kpi-icon primary"><Users size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Nuove Anagrafiche</span>
                  <span class="kpi-val">{totalClienti}</span>
                  <span class="kpi-sub">Totalità lead database</span>
                </div>
              </div>

              <div class="kpi-tile border-success">
                <div class="kpi-icon success"><DollarSign size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Valore Ordinato (VSS)</span>
                  <span class="kpi-val">€ {totalVenduto.toFixed(2)}</span>
                  <span class="kpi-sub">Contratti approvati: {totalContratti - pendingContratti}</span>
                </div>
              </div>

              <div class="kpi-tile border-warning">
                <div class="kpi-icon warning"><Wallet size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Cassa Incassata (GI)</span>
                  <span class="kpi-val">€ {totalIncassato.toFixed(2)}</span>
                  <span class="kpi-sub">In attesa di incasso: {pendingContratti} contratti</span>
                </div>
              </div>

              <div class="kpi-tile border-primary">
                <div class="kpi-icon primary"><FileText size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Primi Ordini (NNCF)</span>
                  <span class="kpi-val">{totalNNCF}</span>
                  <span class="kpi-sub">Conversione primi ordini totali</span>
                </div>
              </div>
            </section>
          {/if}

          <!-- Commercial Activities KPIs Section -->
          <section class="activity-section-header">
            <h4>Attività Commerciali Registrate</h4>
            <span class="sub-desc">Contatori delle interazioni e degli appuntamenti effettuati con i lead.</span>
          </section>

          <section class="kpi-deck activity-deck">
            <div class="kpi-tile border-info">
              <div class="kpi-icon info"><Phone size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Telefonate Loggate</span>
                <span class="kpi-val">{activityCalls}</span>
                <span class="kpi-sub">Chiamate e feedback rapidi</span>
              </div>
            </div>

            <div class="kpi-tile border-teal">
              <div class="kpi-icon teal"><Users size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Incontri Svolti</span>
                <span class="kpi-val">{activityMeetings}</span>
                <span class="kpi-sub">Riunioni e incontri conoscitivi</span>
              </div>
            </div>

            <div class="kpi-tile border-indigo">
              <div class="kpi-icon indigo"><Calendar size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Appuntamenti Presi</span>
                <span class="kpi-val">{activityAppointments}</span>
                <span class="kpi-sub">Demo commerciali pianificate</span>
              </div>
            </div>
          </section>

          <!-- Unified Interactive Trend Graph Card -->
          <div class="unified-chart-wrapper">
            <Card
              title="Trend e Andamento Storico"
              description="Visualizza il trend dinamico delle metriche di performance aziendali. Alterna tra le viste usando i tab e seleziona un punto per il drill-down."
            >
              {#snippet icon()}
                <TrendingUp size={20} class="icon-accent" />
              {/snippet}

              {#snippet headerSnippet()}
                <div class="chart-controls-box">
                  <!-- Tab buttons switcher -->
                  <div class="chart-tab-switcher">
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "vss"}
                      onclick={() => { activeChartTab = "vss"; selectedPointIdx = null; }}
                    >
                      Valore Venduto (VSS)
                    </button>
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "gi"}
                      onclick={() => { activeChartTab = "gi"; selectedPointIdx = null; }}
                    >
                      Cassa Incassata (GI)
                    </button>
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "nuove_anagrafiche"}
                      onclick={() => { activeChartTab = "nuove_anagrafiche"; selectedPointIdx = null; }}
                    >
                      Nuove Anagrafiche
                    </button>
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "nncf"}
                      onclick={() => { activeChartTab = "nncf"; selectedPointIdx = null; }}
                    >
                      Primi Ordini (NNCF)
                    </button>
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "Telefonata"}
                      onclick={() => { activeChartTab = "Telefonata"; selectedPointIdx = null; }}
                    >
                      Telefonate
                    </button>
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "Incontro"}
                      onclick={() => { activeChartTab = "Incontro"; selectedPointIdx = null; }}
                    >
                      Incontri
                    </button>
                    <button
                      class="chart-tab-btn"
                      class:active={activeChartTab === "Appuntamento"}
                      onclick={() => { activeChartTab = "Appuntamento"; selectedPointIdx = null; }}
                    >
                      Appuntamenti
                    </button>
                  </div>

                  <!-- Granularity & Date Picker controls -->
                  <div class="chart-granularity-picker">
                    <div class="picker-item">
                      <span class="picker-lbl">Granularità:</span>
                      <select bind:value={granularity} class="sub-chart-select" onchange={() => selectedPointIdx = null}>
                        <option value="settimanale">Settimanale (12w)</option>
                        <option value="mensile">Mensile (12m)</option>
                        <option value="annuale">Annuale (5y)</option>
                      </select>
                    </div>

                    <div class="picker-item">
                      <span class="picker-lbl">Data Finale:</span>
                      <input type="date" bind:value={endDateString} class="sub-chart-date-picker" onchange={() => selectedPointIdx = null} />
                    </div>
                  </div>
                </div>
              {/snippet}

              {#if loadingChart}
                <div class="loader-box" style="border: none; padding: 30px;">
                  <span class="spinner"></span>
                  Caricamento andamento grafico...
                </div>
              {:else}
                <LineChart
                  data={computedChartPoints}
                  labels={chartPeriods.map(p => p.label)}
                  selectedIdx={selectedPointIdx}
                  onSelect={(idx) => selectedPointIdx = idx}
                  width={500}
                  height={200}
                  xPadding={50}
                  yPadding={30}
                  isCurrency={activeChartTab === 'vss' || activeChartTab === 'gi'}
                />
              {/if}
            </Card>
          </div>

          <!-- Drill-Down detailed section -->
          {#if selectedPointIdx !== null}
            <div class="drilldown-wrapper animate-fade-in">
              <Card title="Dettaglio Analitico Periodo" description="Dettaglio delle transazioni, lead o attività registrate nel periodo selezionato ({chartPeriods[selectedPointIdx].label}).">
                {#snippet icon()}
                  <Search size={20} class="icon-accent" />
                {/snippet}

                <!-- Filters -->
                <div class="drilldown-filters-pane">
                  <FormField id="dd-client-filter" label="Filtra per Cliente">
                    <input type="text" id="dd-client-filter" bind:value={clientFilter} placeholder="Inserisci nome cliente..." />
                  </FormField>

                  {#if $activeRole !== 'commerciale'}
                    <FormField id="dd-vendor-filter" label="Filtra per Consulente">
                      <select id="dd-vendor-filter" bind:value={vendorFilter} class="sub-chart-select" style="width: 100%;">
                        <option value="">Tutti i consulenti</option>
                        {#each usersList as u}
                          <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                        {/each}
                      </select>
                    </FormField>
                  {/if}

                  <FormField id="dd-product-filter" label="Filtra per Prodotto">
                    <input type="text" id="dd-product-filter" bind:value={productFilter} placeholder="es. Hosting, CRM..." />
                  </FormField>
                </div>

                <!-- Results Table -->
                {#if drillDownItems.length === 0}
                  <div class="empty-panel">Nessun dato registrato corrisponde ai filtri impostati per questo periodo.</div>
                {:else}
                  <div class="table-wrapper" style="margin-top: 16px;">
                    <table class="widescreen-table drilldown-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Consulente</th>
                          <th>Data</th>
                          <th>Stato / Tipo</th>
                          {#if activeChartTab === 'vss' || activeChartTab === 'gi'}
                            <th>Importo Quota</th>
                          {/if}
                          <th>Note / Ripartizione</th>
                          <th>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each drillDownItems as item}
                          <tr>
                            <td><strong>{item.cliente}</strong></td>
                            <td>{item.consulente}</td>
                            <td>{item.data}</td>
                            <td>
                              <span class="badge" class:status-approved={item.status === 'Approvato' || item.status === 'Incassato' || item.status === 'Anagrafica'} class:status-pending={item.status === 'In attesa' || item.status.includes('Soll') || item.status === 'Telefonata' || item.status === 'Incontro' || item.status === 'Appuntamento'}>
                                {item.status}
                              </span>
                            </td>
                            {#if activeChartTab === 'vss' || activeChartTab === 'gi'}
                              <td><strong>€ {item.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></td>
                            {/if}
                            <td><span style="font-size: 12px; color: var(--color-neutral-600);">{item.dettaglio}</span></td>
                            <td>
                              <button onclick={() => goto(item.link)} class="back-link-btn" style="padding: 4px 8px; font-size: 11px;">
                                <Eye size={12} style="margin-right: 4px;" /> Vedi
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </Card>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .dashboard-viewport {
    width: 100%;
  }

  .dashboard-panoramica {
    display: flex;
    flex-direction: column;
    gap: 30px;
    width: 100%;
  }

  :global(.welcome-banner) {
    background: linear-gradient(
      135deg,
      var(--color-primary-50),
      var(--color-neutral-100)
    ) !important;
  }

  .kpi-deck {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .kpi-tile {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    gap: 16px;
    align-items: center;
    box-shadow: var(--shadow-sm);
    border-left: 5px solid var(--color-secondary-500);
  }

  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--color-secondary-100);
    color: var(--color-secondary-700);
  }

  .kpi-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kpi-val {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .kpi-sub {
    font-size: 11px;
    color: var(--color-neutral-400);
    font-weight: 500;
  }

  .activity-section-header {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .activity-section-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .activity-section-header .sub-desc {
    font-size: 12.5px;
    color: var(--color-neutral-400);
  }

  /* Unified chart layout */
  .unified-chart-wrapper {
    width: 100%;
  }

  .chart-controls-box {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .chart-tab-switcher {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 3px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    flex-wrap: wrap;
  }

  .chart-tab-btn {
    background: transparent;
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .chart-tab-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .chart-granularity-picker {
    display: flex;
    gap: 20px;
    align-items: center;
    flex-wrap: wrap;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .picker-lbl {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-neutral-400);
    letter-spacing: 0.05em;
  }

  .sub-chart-select, .sub-chart-date-picker {
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 12.5px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    transition: border-color 0.2s;
  }

  .sub-chart-select:focus, .sub-chart-date-picker:focus {
    border-color: var(--color-primary-500);
  }

  .sub-chart-select {
    padding-right: 28px;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 12px;
    cursor: pointer;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
    color: var(--color-neutral-500);
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
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
    to {
      transform: rotate(360deg);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.4s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Admin Dashboard Layout split grid */
  .admin-split-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    width: 100%;
    margin-top: 10px;
  }

  @media (max-width: 992px) {
    .admin-split-grid {
      grid-template-columns: 1fr;
    }
  }

  .empty-panel {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-400);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    font-size: 13.5px;
    font-weight: 500;
  }

  .admin-table th, .admin-table td {
    padding: 10px 14px;
  }

  .warning-badge-inline {
    background: hsla(0, 100%, 96%, 1);
    color: var(--color-error-text);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--color-error-border);
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    margin-top: 4px;
  }

  .approve-collect-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    box-shadow: 0 2px 6px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .approve-collect-btn:hover {
    opacity: 0.9;
  }

  .back-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  /* Drill-down styles */
  .drilldown-filters-pane {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--color-neutral-200);
    padding-bottom: 16px;
  }

  .drilldown-table th, .drilldown-table td {
    padding: 12px 14px;
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
    font-size: 11px;
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

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    display: inline-block;
  }

  .badge.status-approved {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .badge.status-pending {
    background: var(--color-neutral-100);
    color: var(--color-neutral-500);
    border: 1px solid var(--color-neutral-200);
  }
</style>
