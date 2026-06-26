<script lang="ts">
  import { auth, activeRole } from "$lib/auth";
  import { auth as clientAuth } from "$lib/firebase";
  import { db, collection, getDocs } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { Card, FormField } from "$lib";
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

  let clientsList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);
  let paymentsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);
  let activitiesList = $state<any[]>([]);
  let loadingData = $state(true);

  // Advanced chart configurations
  let activeChartTab = $state<"vss" | "gi" | "nncf" | "Telefonata" | "Incontro" | "Appuntamento">("vss");
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let selectedPointIdx = $state<number | null>(null);

  // Drill-down live filters
  let clientFilter = $state('');
  let vendorFilter = $state('');
  let productFilter = $state('');

  async function fetchDashboardData() {
    loadingData = true;
    try {
      const clientsSnap = await getDocs(collection(db, "clients"));
      const cList: any[] = [];
      clientsSnap.forEach((doc: any) => {
        cList.push({ id: doc.id, ...doc.data() });
      });
      clientsList = cList;

      const contractsSnap = await getDocs(collection(db, "contracts"));
      const coList: any[] = [];
      contractsSnap.forEach((doc: any) => {
        coList.push({ id: doc.id, ...doc.data() });
      });
      contractsList = coList;

      const paymentsSnap = await getDocs(collection(db, "payments"));
      const pList: any[] = [];
      paymentsSnap.forEach((doc: any) => {
        pList.push({ id: doc.id, ...doc.data() });
      });
      paymentsList = pList;

      const usersSnap = await getDocs(collection(db, "users"));
      const uList: any[] = [];
      usersSnap.forEach((doc: any) => {
        uList.push({ uid: doc.id, ...doc.data() });
      });
      usersList = uList;

      const activitiesSnap = await getDocs(collection(db, "activities"));
      const actList: any[] = [];
      activitiesSnap.forEach((doc: any) => {
        actList.push({ id: doc.id, ...doc.data() });
      });
      activitiesList = actList;
    } catch (e) {
      console.error(e);
    } finally {
      loadingData = false;
    }
  }

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

    fetchDashboardData();
    return () => unsubscribe();
  });

  // Calculate commission percentage according to qualification formula
  function calculateCommissionPct(item: any, qualification: string) {
    const list = item.listPrice;
    const min = item.minPrice;
    const sold = item.priceSold;

    let ratio = 1;
    if (list > min) {
      ratio = (sold - min) / (list - min);
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
    }

    if (qualification === "senior") {
      return 5.0 + ratio * 5.0; // 5% to 10%
    } else {
      return 2.5 + ratio * 5.0; // 2.5% to 7.5%
    }
  }

  // Calculate stats for commercials reflecting co-selling splits
  let commercialStats = $derived.by(() => {
    const myContracts = contractsList.filter(
      (c) => c.vendorUid === $auth?.uid || c.secondVendorUid === $auth?.uid
    );

    let totalSold = 0;
    let approvedSold = 0;
    let maturate = 0; // approved commission
    let sospese = 0;  // pending commission

    myContracts.forEach((c) => {
      const primaryVendor = usersList.find((u) => u.uid === c.vendorUid);
      const primaryQual = primaryVendor?.qualification || "junior";
      
      let totalComm = 0;
      c.products.forEach((p: any) => {
        const pct = calculateCommissionPct(p, primaryQual);
        totalComm += p.priceSold * p.quantity * (pct / 100);
      });

      const secondShare = c.secondVendorShare || 0;
      let myShareComm = 0;
      let myShareSold = 0;

      if (c.vendorUid === $auth?.uid) {
        myShareComm = totalComm * (100 - secondShare) / 100;
        myShareSold = c.totalPrice * (100 - secondShare) / 100;
      } else {
        myShareComm = totalComm * secondShare / 100;
        myShareSold = c.totalPrice * secondShare / 100;
      }

      totalSold += myShareSold;
      if (c.status === "approved") {
        approvedSold += myShareSold;
        maturate += myShareComm;
      } else {
        sospese += myShareComm;
      }
    });

    return {
      count: myContracts.length,
      totalSold,
      approvedSold,
      maturate,
      sospese,
    };
  });

  // Global stats for management/admin/direzione
  let globalStats = $derived.by(() => {
    const approvedContracts = contractsList.filter(
      (c) => c.status === "approved"
    );
    const totalVenduto = approvedContracts.reduce(
      (sum, c) => sum + c.totalPrice,
      0
    );
    const totalIncassato = paymentsList.reduce((sum, p) => sum + p.amount, 0);
    const totalClienti = clientsList.length;

    return {
      totalVenduto,
      totalIncassato,
      totalClienti,
      totalContratti: contractsList.length,
      pendingContratti: contractsList.filter((c) => c.status === "pending").length,
    };
  });

  // Activity KPIs derived (taking loggedBy into account for commercials)
  let activityKPIs = $derived.by(() => {
    const isComm = $activeRole === "commerciale";
    const list = isComm
      ? activitiesList.filter((a) => a.loggedBy === $auth?.uid)
      : activitiesList;

    const calls = list.filter((a) => a.type === "Telefonata" || a.type === "Sollecito Telefonico").length;
    const meetings = list.filter((a) => a.type === "Incontro" || a.type === "Sollecito PEC").length;
    const appointments = list.filter((a) => a.type === "Appuntamento" || a.type === "Sollecito Email").length;

    return { calls, meetings, appointments };
  });

  // Date periods generated backwards from endDateString
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
      } else {
        let targetType = activeChartTab;
        dbValue = activitiesList
          .filter(a => {
            const d = new Date(a.date);
            const inPeriod = d >= p.start && d <= p.end;
            if (!inPeriod) return false;
            const belongs = !isComm || a.loggedBy === myUid;
            if (!belongs) return false;
            
            if (targetType === 'Telefonata') {
              return a.type === 'Telefonata' || a.type === 'Sollecito Telefonico';
            } else if (targetType === 'Incontro') {
              return a.type === 'Incontro' || a.type === 'Sollecito PEC';
            } else if (targetType === 'Appuntamento') {
              return a.type === 'Appuntamento' || a.type === 'Sollecito Email';
            }
            return a.type === targetType;
          }).length;
      }

      return dbValue;
    });
  });

  let unifiedChartDetails = $derived.by(() => {
    const data = computedChartPoints;
    const isCurrency = activeChartTab === 'vss' || activeChartTab === 'gi';
    const maxVal = Math.max(...data, isCurrency ? 1000 : 5);
    const count = data.length;

    const points = data.map((val, idx) => {
      const x = 50 + (idx / (count - 1)) * 400; // X range 50 to 450
      const y = 140 - (val / maxVal) * 110; // Y range 30 to 140
      return { x, y, val };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return acc + (idx === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
    }, '');

    const areaD = pathD + ` L ${points[points.length - 1].x} 140 L ${points[0].x} 140 Z`;

    let label = '';
    let stopColor = 'var(--color-primary-500)';
    let areaColor = 'rgba(79, 70, 229, 0.2)';
    let dotClass = 'primary';
    let lineClass = 'primary-line';

    if (activeChartTab === 'vss') {
      label = "Valore Venduto (VSS)";
      stopColor = "var(--color-success)";
      areaColor = "rgba(16, 185, 129, 0.25)";
      dotClass = "success";
      lineClass = "success-line";
    } else if (activeChartTab === 'gi') {
      label = "Cassa Incassata (GI)";
      stopColor = "var(--color-warning)";
      areaColor = "rgba(245, 158, 11, 0.2)";
      dotClass = "warning";
      lineClass = "warning-line";
    } else if (activeChartTab === 'nncf') {
      label = "Nuovi Clienti (NNCF)";
      stopColor = "var(--color-primary-500)";
      areaColor = "rgba(79, 70, 229, 0.25)";
      dotClass = "primary";
      lineClass = "primary-line";
    } else if (activeChartTab === 'Telefonata') {
      label = "Telefonate Loggate";
      stopColor = "#0284c7";
      areaColor = "rgba(2, 132, 199, 0.2)";
      dotClass = "info";
      lineClass = "info-line";
    } else if (activeChartTab === 'Incontro') {
      label = "Incontri Svolti";
      stopColor = "#0d9488";
      areaColor = "rgba(13, 148, 136, 0.2)";
      dotClass = "teal";
      lineClass = "teal-line";
    } else if (activeChartTab === 'Appuntamento') {
      label = "Appuntamenti Presi";
      stopColor = "#4f46e5";
      areaColor = "rgba(79, 70, 229, 0.2)";
      dotClass = "indigo";
      lineClass = "indigo-line";
    }

    const yLabels = isCurrency
      ? [`€ ${maxVal.toFixed(0)}`, `€ ${(maxVal / 2).toFixed(0)}`, "€ 0"]
      : [`${maxVal}`, `${(maxVal / 2).toFixed(0)}`, "0"];

    return {
      points,
      pathD,
      areaD,
      maxVal,
      label,
      stopColor,
      areaColor,
      dotClass,
      lineClass,
      yLabels
    };
  });

  // Drill-down data derivation
  let drillDownItems = $derived.by(() => {
    if (selectedPointIdx === null || selectedPointIdx < 0 || selectedPointIdx >= chartPeriods.length) {
      return [];
    }
    const period = chartPeriods[selectedPointIdx];
    const isComm = $activeRole === 'commerciale';
    const myUid = $auth?.uid;

    let items: any[] = [];

    const matchQuery = (val: string | undefined, q: string) => {
      if (!q) return true;
      return val?.toLowerCase().includes(q.toLowerCase()) || false;
    };

    if (activeChartTab === 'vss') {
      items = contractsList.filter(c => {
        const d = new Date(c.createdAt);
        const inPeriod = d >= period.start && d <= period.end;
        const belongs = !isComm || c.vendorUid === myUid || c.secondVendorUid === myUid;
        if (!inPeriod || !belongs) return false;

        if (!matchQuery(c.clientName, clientFilter)) return false;
        
        if (vendorFilter) {
          const isPrimary = c.vendorUid === vendorFilter;
          const isSecondary = c.secondVendorUid === vendorFilter;
          if (!isPrimary && !isSecondary) return false;
        }

        if (productFilter) {
          const hasProd = c.products.some((p: any) => matchQuery(p.name, productFilter));
          if (!hasProd) return false;
        }

        return true;
      }).map(c => {
        let displayVal = c.totalPrice;
        let roleInfo = 'Primario (100%)';
        if (c.secondVendorUid) {
          if (isComm) {
            if (c.vendorUid === myUid) {
              displayVal = c.totalPrice * (100 - c.secondVendorShare) / 100;
              roleInfo = `Primario (${100 - c.secondVendorShare}%)`;
            } else {
              displayVal = c.totalPrice * c.secondVendorShare / 100;
              roleInfo = `Co-selling (${c.secondVendorShare}%)`;
            }
          } else {
            roleInfo = `Primario (${100 - c.secondVendorShare}%) / Co-seller (${c.secondVendorShare}%)`;
          }
        }
        return {
          id: c.id,
          cliente: c.clientName,
          consulente: c.vendorEmail + (c.secondVendorEmail ? ` / ${c.secondVendorEmail}` : ''),
          data: new Date(c.createdAt).toLocaleDateString('it-IT'),
          valore: displayVal,
          dettaglio: roleInfo,
          status: c.status === 'approved' ? 'Approvato' : 'In attesa',
          link: `/dashboard/contracts/${c.id}`
        };
      });
    } else if (activeChartTab === 'gi') {
      items = paymentsList.filter(pay => {
        const d = new Date(pay.date);
        const inPeriod = d >= period.start && d <= period.end;
        if (!inPeriod) return false;

        const c = contractsList.find(x => x.id === pay.contractId);
        if (isComm && (!c || (c.vendorUid !== myUid && c.secondVendorUid !== myUid))) return false;

        if (!matchQuery(pay.clientName, clientFilter)) return false;

        if (vendorFilter && c) {
          const isPrimary = c.vendorUid === vendorFilter;
          const isSecondary = c.secondVendorUid === vendorFilter;
          if (!isPrimary && !isSecondary) return false;
        }

        if (productFilter && c) {
          const hasProd = c.products.some((p: any) => matchQuery(p.name, productFilter));
          if (!hasProd) return false;
        }

        return true;
      }).map(pay => {
        const c = contractsList.find(x => x.id === pay.contractId);
        let displayVal = pay.amount;
        let roleInfo = '100% Incasso';
        if (c && c.secondVendorUid) {
          if (isComm) {
            if (c.vendorUid === myUid) {
              displayVal = pay.amount * (100 - c.secondVendorShare) / 100;
              roleInfo = `Quota Primario (${100 - c.secondVendorShare}%)`;
            } else {
              displayVal = pay.amount * c.secondVendorShare / 100;
              roleInfo = `Quota Co-selling (${c.secondVendorShare}%)`;
            }
          } else {
            roleInfo = `Primario (${100 - c.secondVendorShare}%) / Co-seller (${c.secondVendorShare}%)`;
          }
        }
        return {
          id: pay.id,
          cliente: pay.clientName,
          consulente: c ? (c.vendorEmail + (c.secondVendorEmail ? ` / ${c.secondVendorEmail}` : '')) : pay.recordedEmail,
          data: new Date(pay.date).toLocaleDateString('it-IT'),
          valore: displayVal,
          dettaglio: roleInfo,
          status: 'Incassato',
          link: c ? `/dashboard/contracts/${c.id}` : '#'
        };
      });
    } else if (activeChartTab === 'nncf') {
      items = clientsList.filter(c => {
        const d = new Date(c.createdAt);
        const inPeriod = d >= period.start && d <= period.end;
        const belongs = !isComm || c.createdBy === myUid;
        if (!inPeriod || !belongs) return false;

        if (!matchQuery(`${c.nome} ${c.cognome || ''}`, clientFilter)) return false;

        if (vendorFilter && c.createdBy !== vendorFilter) return false;

        if (productFilter) {
          const clientContracts = contractsList.filter(x => x.clientId === c.id);
          const hasProd = clientContracts.some(cc => cc.products.some((p: any) => matchQuery(p.name, productFilter)));
          if (!hasProd) return false;
        }

        return true;
      }).map(c => {
        const owner = usersList.find(u => u.uid === c.createdBy);
        return {
          id: c.id,
          cliente: `${c.nome} ${c.cognome || ''}`.trim(),
          consulente: owner ? owner.email : 'N/A',
          data: new Date(c.createdAt).toLocaleDateString('it-IT'),
          valore: '-',
          dettaglio: c.phone || c.email || 'N/A',
          status: 'Lead',
          link: `/dashboard/clients/${c.id}`
        };
      });
    } else {
      items = activitiesList.filter(a => {
        const d = new Date(a.date);
        const inPeriod = d >= period.start && d <= period.end;
        const belongs = !isComm || a.loggedBy === myUid;
        if (!inPeriod || !belongs) return false;

        let targetType = activeChartTab;
        if (targetType === 'Telefonata' && a.type !== 'Telefonata' && a.type !== 'Sollecito Telefonico') return false;
        if (targetType === 'Incontro' && a.type !== 'Incontro' && a.type !== 'Sollecito PEC') return false;
        if (targetType === 'Appuntamento' && a.type !== 'Appuntamento' && a.type !== 'Sollecito Email') return false;

        if (!matchQuery(a.clientName, clientFilter)) return false;

        if (vendorFilter && a.loggedBy !== vendorFilter) return false;

        if (productFilter) {
          const clientContracts = contractsList.filter(x => x.clientId === a.clientId);
          const hasProd = clientContracts.some(cc => cc.products.some((p: any) => matchQuery(p.name, productFilter)));
          if (!hasProd) return false;
        }

        return true;
      }).map(a => {
        return {
          id: a.id,
          cliente: a.clientName,
          consulente: a.loggedEmail,
          data: new Date(a.date).toLocaleDateString('it-IT'),
          valore: '-',
          dettaglio: a.notes || 'Nessuna nota.',
          status: a.type,
          link: `/dashboard/clients/${a.clientId}?tab=activities`
        };
      });
    }

    return items;
  });

  // Derive administration stats
  let adminPendingContracts = $derived.by(() => {
    return contractsList.filter(c => c.status === 'pending');
  });

  let adminOverdueInstallments = $derived.by(() => {
    const list: any[] = [];
    contractsList.forEach(c => {
      if (c.installments) {
        c.installments.forEach((inst: any) => {
          const isOverdue = inst.status === 'pending' && new Date(inst.dueDate) < new Date();
          if (isOverdue) {
            list.push({
              ...inst,
              contractId: c.id,
              clientName: c.clientName
            });
          }
        });
      }
    });
    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  let adminStats = $derived.by(() => {
    const pendingContractsCount = adminPendingContracts.length;
    const approvedContractsCount = contractsList.filter(c => c.status === 'approved').length;
    const overdueInstallmentsCount = adminOverdueInstallments.length;

    return {
      pendingContractsCount,
      approvedContractsCount,
      overdueInstallmentsCount
    };
  });
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
          description="Monitora l'approvazione delle transazioni commerciali e gestisci le scadenze insolute."
          variant="glass"
          class="welcome-banner"
          style="--card-padding: 30px 40px;"
        />

        <!-- Admin KPIs Deck -->
        <section class="kpi-deck">
          <div class="kpi-tile border-warning">
            <div class="kpi-icon warning"><Clock size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Contratti Da Approvare</span>
              <span class="kpi-val">{adminStats.pendingContractsCount}</span>
              <span class="kpi-sub">In attesa di verifica contabile</span>
            </div>
          </div>

          <div class="kpi-tile border-success">
            <div class="kpi-icon success"><CheckCircle size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Contratti Approvati</span>
              <span class="kpi-val text-success">{adminStats.approvedContractsCount}</span>
              <span class="kpi-sub">Transazioni chiuse nel sistema</span>
            </div>
          </div>

          <div class="kpi-tile border-error">
            <div class="kpi-icon error"><AlertTriangle size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Rate Overdue (Insoluti)</span>
              <span class="kpi-val text-danger">{adminStats.overdueInstallmentsCount}</span>
              <span class="kpi-sub">Scadenze di pagamento superate</span>
            </div>
          </div>
        </section>

        <!-- Main Content split -->
        <div class="admin-split-grid">
          <!-- Section 1: Pending contracts list -->
          <Card title="Nuovi Ordini Da Approvare" description="Elenco dei contratti pendenti registrati dai commerciali. Clicca su Gestisci per approvarli o verificare i dettagli.">
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
                  <span class="kpi-val">{commercialStats.count}</span>
                  <span class="kpi-sub"
                    >Totale ordinato (quota ripartita): € {commercialStats.totalSold.toFixed(2)}</span
                  >
                </div>
              </div>

              <div class="kpi-tile border-success">
                <div class="kpi-icon success"><DollarSign size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Provvigioni Maturate</span>
                  <span class="kpi-val text-success"
                    >€ {commercialStats.maturate.toFixed(2)}</span
                  >
                  <span class="kpi-sub"
                    >Fatturato incassato (quota): € {commercialStats.approvedSold.toFixed(2)}</span
                  >
                </div>
              </div>

              <div class="kpi-tile border-warning">
                <div class="kpi-icon warning"><Wallet size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Provvigioni In Sospeso</span>
                  <span class="kpi-val text-warning"
                    >€ {commercialStats.sospese.toFixed(2)}</span
                  >
                  <span class="kpi-sub"
                    >In attesa di approvazione amministrativa</span
                  >
                </div>
              </div>
            </section>
          {:else}
            <!-- superadmin & direzione global stats view -->
            <section class="kpi-deck">
              <div class="kpi-tile border-primary">
                <div class="kpi-icon primary"><Users size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Clienti Anagrafati (NNCF)</span>
                  <span class="kpi-val">{globalStats.totalClienti}</span>
                  <span class="kpi-sub">Totalità lead database</span>
                </div>
              </div>

              <div class="kpi-tile border-success">
                <div class="kpi-icon success"><DollarSign size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Valore Ordinato (VSS)</span>
                  <span class="kpi-val text-success"
                    >€ {globalStats.totalVenduto.toFixed(2)}</span
                  >
                  <span class="kpi-sub"
                    >Contratti approvati: {globalStats.totalContratti - globalStats.pendingContratti}</span
                  >
                </div>
              </div>

              <div class="kpi-tile border-warning">
                <div class="kpi-icon warning"><Wallet size={20} /></div>
                <div class="kpi-text">
                  <span class="kpi-lbl">Cassa Incassata (GI)</span>
                  <span class="kpi-val text-warning"
                    >€ {globalStats.totalIncassato.toFixed(2)}</span
                  >
                  <span class="kpi-sub"
                    >In attesa di incasso: {globalStats.pendingContratti} contratti</span
                  >
                </div>
              </div>
            </section>
          {/if}

          <!-- Commercial Activities KPIs Section -->
          <section class="activity-section-header">
            <h4>Attività Commerciali Registrate</h4>
            <span class="sub-desc"
              >Contatori delle interazioni e degli appuntamenti effettuati con i lead.</span
            >
          </section>

          <section class="kpi-deck activity-deck">
            <div class="kpi-tile border-info">
              <div class="kpi-icon info"><Phone size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Telefonate Loggate</span>
                <span class="kpi-val">{activityKPIs.calls}</span>
                <span class="kpi-sub">Chiamate e feedback rapidi</span>
              </div>
            </div>

            <div class="kpi-tile border-teal">
              <div class="kpi-icon teal"><Users size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Incontri Svolti</span>
                <span class="kpi-val">{activityKPIs.meetings}</span>
                <span class="kpi-sub">Riunioni e incontri conoscitivi</span>
              </div>
            </div>

            <div class="kpi-tile border-indigo">
              <div class="kpi-icon indigo"><Calendar size={20} /></div>
              <div class="kpi-text">
                <span class="kpi-lbl">Appuntamenti Presi</span>
                <span class="kpi-val">{activityKPIs.appointments}</span>
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
                      class:active={activeChartTab === "nncf"}
                      onclick={() => { activeChartTab = "nncf"; selectedPointIdx = null; }}
                    >
                      Nuovi Clienti (NNCF)
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
                        <option value="settimanale">Settimanale (52w)</option>
                        <option value="mensile">Mensile (24m)</option>
                        <option value="annuale">Annuale (10y)</option>
                      </select>
                    </div>

                    <div class="picker-item">
                      <span class="picker-lbl">Data Finale:</span>
                      <input type="date" bind:value={endDateString} class="sub-chart-date-picker" onchange={() => selectedPointIdx = null} />
                    </div>
                  </div>
                </div>
              {/snippet}

              <div class="chart-container">
                <svg class="svg-chart" viewBox="0 0 500 200">
                  <defs>
                    <linearGradient
                      id="gradient-unified"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stop-color={unifiedChartDetails.stopColor}
                        stop-opacity="0.35"
                      />
                      <stop
                        offset="100%"
                        stop-color={unifiedChartDetails.stopColor}
                        stop-opacity="0.0"
                      />
                    </linearGradient>
                  </defs>

                  <!-- Grid Lines -->
                  <line x1="50" y1="30" x2="450" y2="30" class="chart-grid-line" />
                  <line x1="50" y1="85" x2="450" y2="85" class="chart-grid-line" />
                  <line x1="50" y1="140" x2="450" y2="140" class="chart-grid-line" />

                  <!-- Area Fill -->
                  <path
                    d={unifiedChartDetails.areaD}
                    fill="url(#gradient-unified)"
                  />

                  <!-- Line Chart Path -->
                  <path
                    d={unifiedChartDetails.pathD}
                    class="chart-line-path {unifiedChartDetails.lineClass}"
                  />

                  <!-- Dots with values on hover/click -->
                  {#each unifiedChartDetails.points as pt, idx}
                    <!-- Click target circle (invisible and larger) -->
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      fill="transparent"
                      style="cursor: pointer;"
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
                    <!-- Visual dot -->
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={selectedPointIdx === idx ? 8 : 4}
                      class="chart-dot {unifiedChartDetails.dotClass}"
                      class:selected={selectedPointIdx === idx}
                      style="cursor: pointer;"
                      role="button"
                      tabindex="0"
                      aria-label="Dettaglio punto grafico"
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

              <div class="legend-row">
                <div class="legend-item" style="gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span
                      class="legend-color"
                      style="background-color: {unifiedChartDetails.stopColor}"
                    ></span>
                    <span>{unifiedChartDetails.label}</span>
                  </div>

                  {#if selectedPointIdx !== null}
                    <span class="selected-period-banner animate-fade-in" style="margin-left: 12px;">
                      Periodo: <strong>{chartPeriods[selectedPointIdx].label}</strong> (Valore: {activeChartTab === 'nncf' || activeChartTab === 'Telefonata' || activeChartTab === 'Incontro' || activeChartTab === 'Appuntamento' ? computedChartPoints[selectedPointIdx] : '€' + computedChartPoints[selectedPointIdx].toLocaleString('it-IT')})
                      <button onclick={() => selectedPointIdx = null} class="clear-filter-btn">Disattiva</button>
                    </span>
                  {/if}
                </div>
              </div>
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
                        {#each usersList.filter(u => u.roles.includes('commerciale')) as u}
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
                              <span class="badge" class:status-approved={item.status === 'Approvato' || item.status === 'Incassato' || item.status === 'Lead'} class:status-pending={item.status === 'In attesa' || item.status.includes('Soll') || item.status === 'Telefonata' || item.status === 'Incontro' || item.status === 'Appuntamento'}>
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
  }

  .kpi-tile.border-primary {
    border-left: 5px solid var(--color-primary-500);
  }
  .kpi-tile.border-success {
    border-left: 5px solid var(--color-success);
  }
  .kpi-tile.border-warning {
    border-left: 5px solid var(--color-warning);
  }
  .kpi-tile.border-error {
    border-left: 5px solid var(--color-error);
  }
  .kpi-tile.border-info {
    border-left: 5px solid #0284c7;
  }
  .kpi-tile.border-teal {
    border-left: 5px solid #0d9488;
  }
  .kpi-tile.border-indigo {
    border-left: 5px solid #4f46e5;
  }

  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kpi-icon.primary {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
  }
  .kpi-icon.success {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }
  .kpi-icon.warning {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }
  .kpi-icon.error {
    background: var(--color-error-light);
    color: var(--color-error-text);
  }
  .kpi-icon.info {
    background: #e0f2fe;
    color: #0369a1;
  }
  .kpi-icon.teal {
    background: #ccfbf1;
    color: #0f766e;
  }
  .kpi-icon.indigo {
    background: #e0e7ff;
    color: #4338ca;
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

  .chart-container {
    padding: 24px 10px 10px 10px;
  }

  .svg-chart {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .chart-grid-line {
    stroke: var(--color-neutral-200);
    stroke-width: 1;
    stroke-dasharray: 4, 4;
  }

  .chart-axis-lbl {
    font-size: 9px;
    fill: var(--color-neutral-400);
    font-weight: 600;
  }

  .chart-line-path {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chart-line-path.primary-line { stroke: var(--color-primary-500); }
  .chart-line-path.success-line { stroke: var(--color-success); }
  .chart-line-path.warning-line { stroke: var(--color-warning); }
  .chart-line-path.info-line { stroke: #0284c7; }
  .chart-line-path.teal-line { stroke: #0d9488; }
  .chart-line-path.indigo-line { stroke: #4f46e5; }

  .chart-dot {
    stroke: var(--color-white);
    stroke-width: 2.5;
    transition: r 0.2s, stroke-width 0.2s;
  }

  .chart-dot.primary { fill: var(--color-primary-500); }
  .chart-dot.success { fill: var(--color-success); }
  .chart-dot.warning { fill: var(--color-warning); }
  .chart-dot.info { fill: #0284c7; }
  .chart-dot.teal { fill: #0d9488; }
  .chart-dot.indigo { fill: #4f46e5; }

  .chart-dot.selected {
    r: 8px;
    stroke-width: 3px;
  }

  .chart-point-val {
    font-size: 9.5px;
    font-weight: 700;
    fill: var(--color-neutral-700);
  }

  .legend-row {
    display: flex;
    justify-content: center;
    margin-top: 15px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: var(--color-neutral-500);
    font-weight: 600;
  }

  .legend-color {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
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
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
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
    box-shadow: 0 2px 6px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
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
