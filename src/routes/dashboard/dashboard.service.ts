import { db, getDoc, doc, getDocs, collection, query, where, getCountFromServer, getAggregateFromServer, sum, collectionGroup, orderBy, functions, httpsCallable, updateDoc } from "$lib/firebase";
import { formatDate } from "$lib/utils/formatters";
import { ChartSettingsService } from "$lib";

export interface DashboardKPIs {
  totalClienti: number;
  totalNNCF: number;
  usersList: any[];
  activityCounts: Record<string, number>;
  [key: string]: any;
}

export interface AdminTables {
  [key: string]: any[];
}

export class DashboardService {
  private static async getModuleBridge(moduleId: string): Promise<any> {
    try {
      const bridgeMap: Record<string, () => Promise<any>> = import.meta.glob('./**/*.kpi.bridge.ts');
      const matchKey = Object.keys(bridgeMap).find(k => k.endsWith(`/${moduleId}/${moduleId}.kpi.bridge.ts`) || k.endsWith(`/${moduleId}.kpi.bridge.ts`));
      if (matchKey && typeof bridgeMap[matchKey] === 'function') {
        const mod = await bridgeMap[matchKey]();
        const bridgeObj = Object.values(mod).find((exp: any) => exp && (typeof exp?.fetchKPIs === 'function' || typeof exp?.fetchAdminTablesData === 'function' || typeof exp?.fetchDrillDownItems === 'function'));
        return bridgeObj || mod.default || mod;
      }
    } catch (e) {
      console.warn(`Bridge load failed for module ${moduleId}:`, e);
    }
    return null;
  }

  static async fetchGlobalKPIs(role: string, myUid: string, activitiesConfig: any[], activeModuleIds: string[] = []): Promise<DashboardKPIs> {
    const kpis: DashboardKPIs = {
      commContractsCount: 0, commTotalSold: 0, commApprovedSold: 0, commTotalNNCF: 0, commMaturate: 0, commIncassato: 0,
      totalClienti: 0, totalVenduto: 0, totalIncassato: 0, totalNNCF: 0, totalContratti: 0, pendingContratti: 0,
      activityCounts: {}, commTotalNA: 0, usersList: []
    };

    // 1. Fetch current user profile if needed
    try {
      const userSnap = await getDoc(doc(db, 'users', myUid));
      if (userSnap.exists()) {
        const uData = userSnap.data() || {};
        const uDerived = uData.derived || {};
        // Merge derived stats if present
        Object.assign(kpis, uDerived);
      }
    } catch (err) {
      console.error("Error fetching user profile", err);
    }

    // 2. Fetch global directional KPIs if admin/direzione
    if (role !== 'commerciale') {
      try {
        const clientsCountSnap = await getCountFromServer(collection(db, 'clients'));
        kpis.totalClienti = clientsCountSnap.data().count;
      } catch (e) { console.error("Error clients count", e); }

      try {
        const nncfCountSnap = await getCountFromServer(query(collection(db, 'clients'), where('derived.nncfOrderId', '!=', null)));
        kpis.totalNNCF = nncfCountSnap.data().count;
      } catch (e) { console.error("Error NNCF count", e); }

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach((d: any) => {
          const u = d.data()?.original || d.data();
          kpis.usersList.push({ uid: d.id, ...u });
        });
      } catch (e) { console.error("Error users list", e); }
    }

    // 3. Dynamic Module KPI Bridges Dispatcher (100% Pure Agnostic Core)
    for (const modId of activeModuleIds) {
      const bridgeClass = await this.getModuleBridge(modId);
      if (bridgeClass && typeof bridgeClass.fetchKPIs === 'function') {
        try {
          const moduleKPIs = await bridgeClass.fetchKPIs({ role, uid: myUid });
          Object.assign(kpis, moduleKPIs);
        } catch (err) {
          console.error(`Error in bridge fetchKPIs for module ${modId}:`, err);
        }
      }
    }

    return kpis;
  }

  static async fetchAdminTables(todayStr: string, activeModuleIds: string[] = []): Promise<AdminTables> {
    const res: AdminTables = {
      adminPendingContracts: [], adminOverdueInstallments: [], adminPendingCommissions: [],
      adminFinalizedCommissions: [], adminUndistributedPayments: []
    };

    for (const modId of activeModuleIds) {
      const bridgeClass = await this.getModuleBridge(modId);
      if (bridgeClass && typeof bridgeClass.fetchAdminTablesData === 'function') {
        try {
          const tablesData = await bridgeClass.fetchAdminTablesData(todayStr);
          Object.assign(res, tablesData);
        } catch (err) {
          console.error(`Error in bridge fetchAdminTablesData for module ${modId}:`, err);
        }
      }
    }

    return res;
  }

  static async markCommissionPaid(periodId: string, uid: string) {
    const bridgeClass = await this.getModuleBridge('commissions');
    if (bridgeClass && typeof bridgeClass.markCommissionPaid === 'function') {
      await bridgeClass.markCommissionPaid(periodId, uid);
    }
  }

  static generateChartPeriods(endDateString: string, granularity: 'settimanale' | 'mensile' | 'annuale') {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date; end: Date; label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 11; i >= 0; i--) {
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({ start: pStart, end: pEnd, label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}` });
      }
    } else if (granularity === 'mensile') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({ start: pStart, end: pEnd, label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}` });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({ start: pStart, end: pEnd, label: String(year) });
      }
    }
    return periods;
  }

  static async fetchChartAggregations(periods: any[], role: string, myUid: string, activeChartTab: string) {
    // Lookup the KPI to find its requiredModule
    const kpiList = ChartSettingsService.getAllKpisMasterListSync();
    const kpiSpec = kpiList.find(k => k.id === activeChartTab);
    console.log("fetchChartAggregations KPI SPEC:", kpiSpec);

    // Try module bridge first
    if (kpiSpec?.requiredModule) {
      const bridgeClass = await this.getModuleBridge(kpiSpec.requiredModule);
      console.log("fetchChartAggregations BRIDGE CLASS for", kpiSpec.requiredModule, ":", !!bridgeClass, "TYPE:", typeof bridgeClass?.fetchChartAggregations);
      if (bridgeClass && typeof bridgeClass.fetchChartAggregations === 'function') {
        try {
          const modRes = await bridgeClass.fetchChartAggregations({
            periods, role, uid: myUid, tab: activeChartTab
          });
          console.log("fetchChartAggregations MOD RES:", modRes);
          if (Array.isArray(modRes) && modRes.length === periods.length) {
            return modRes;
          }
        } catch (err) {
          console.error(`Error in bridge fetchChartAggregations for module ${kpiSpec.requiredModule}:`, err);
        }
      }
    }

    const isComm = role === 'commerciale';
    const getChartAggregations = httpsCallable(functions, 'getChartAggregations');
    
    let filters: any = {};
    if (isComm) {
      if (activeChartTab === 'nuove_anagrafiche' || activeChartTab === 'nncf') {
        filters.createdBy = myUid;
      } else if (['vss', 'vsa', 'gi', 'provvigioni_maturate'].includes(activeChartTab)) {
        filters.vendorUid = myUid;
      } else {
        filters.loggedBy = myUid;
      }
    }
    
    const isActivity = !['vss', 'vsa', 'nuove_anagrafiche', 'nncf', 'gi', 'provvigioni_maturate'].includes(activeChartTab) && (!kpiSpec || kpiSpec.requiredModule === 'activities');
    if (isActivity) {
      filters.type = activeChartTab; 
    }

    const payload = {
      entity: isActivity ? 'activities' : activeChartTab,
      periods: periods.map(p => ({ start: p.start.toISOString(), end: p.end.toISOString() })),
      filters
    };
    
    try {
      const res = await getChartAggregations(payload);
      const raw = res.data as any;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      if (Array.isArray(raw?.results)) return raw.results;
      return periods.map(() => 0);
    } catch (e) {
      console.error("Aggregation error", e);
      return periods.map(() => 0);
    }
  }

  static async fetchDrillDownItems(
    period: any, 
    activeChartTab: string, 
    role: string, 
    myUid: string, 
    clientFilter: string, 
    vendorFilter: string, 
    productFilter: string,
    activeModuleIds: string[] = []
  ) {
    if (!period) return [];

    // Query active module bridges dynamically
    for (const modId of activeModuleIds) {
      const bridgeClass = await this.getModuleBridge(modId);
      if (bridgeClass && typeof bridgeClass.fetchDrillDownItems === 'function') {
        try {
          const items = await bridgeClass.fetchDrillDownItems({
            period,
            tab: activeChartTab,
            role,
            uid: myUid,
            clientFilter,
            vendorFilter,
            productFilter
          });
          if (items && items.length > 0) return items;
        } catch (e) {
          console.error(`Error in fetchDrillDownItems for module ${modId}:`, e);
        }
      }
    }

    return [];
  }
}
