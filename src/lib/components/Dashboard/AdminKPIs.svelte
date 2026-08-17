<script lang="ts">
  import { KPITile, ChartSettingsService } from "$lib";
  import { DollarSign, FileText, Phone, Users, Calendar, Wallet, Award, CreditCard, ActivitySquare, MessageSquare, CheckCircle, Mail, Briefcase, Package, Ticket, Clock, MapPin, Building, Wrench } from "@lucide/svelte";
  import { activeRoleState } from "$lib/auth.svelte";

  let { 
    kpis = {},
    totalClienti = 0,
    totalVenduto = 0,
    totalContratti = 0,
    pendingContratti = 0,
    totalIncassato = 0,
    totalNNCF = 0,
    commMaturate = 0,
    activityCounts = {},
    activitiesConfig = [],
    onTabSelect,
    hasActivities = false
  } = $props<any>();

  const iconMap: Record<string, any> = {
    'Phone': Phone,
    'Users': Users,
    'Calendar': Calendar,
    'MessageSquare': MessageSquare,
    'FileText': FileText,
    'DollarSign': DollarSign,
    'Wallet': Wallet,
    'Award': Award,
    'CreditCard': CreditCard,
    'ActivitySquare': ActivitySquare,
    'CheckCircle': CheckCircle,
    'Briefcase': Briefcase,
    'Mail': Mail,
    'nuove_anagrafiche': Users,
    'vss': DollarSign,
    'nncf': FileText,
    'total_products': Package,
    'ticket_aperti': Ticket,
    'tmr': Clock,
    'places_attivi': MapPin,
    'total_places': Building,
    'teams_attivi': Users,
    'projects_attivi': Briefcase,
    'portafoglio_lavori': Briefcase,
    'interventi_pending': Wrench,
    'gi': Wallet
  };

  const allowedActivities = $derived((activitiesConfig || []).filter((a: any) => a.rolesView.includes(activeRoleState.role || 'superadmin')));

  const kpisValuesMap = $derived<Record<string, any>>({
    totalNNCF,
    totalVenduto,
    totalIncassato,
    commMaturate,
    nuove_anagrafiche: totalClienti,
    vss: totalVenduto,
    nncf: totalNNCF,
    gi: totalIncassato,
    ...kpis
  });

  const dashboardMetrics = $derived(ChartSettingsService.getDashboardChartMetricsSync());

  const getKpiInfo = (id: string) => {
    const kpi = ChartSettingsService.getAllKpisMasterListSync().find(k => k.id === id);
    if (!kpi) return { acronym: id?.toUpperCase() || '', name: id || '', description: '' };
    return kpi;
  };

  function getMetricValue(id: string, isCurrency?: boolean): string | number {
    if (id === 'nuove_anagrafiche') return totalClienti;
    if (id === 'vss') return isCurrency ? `€ ${Number(totalVenduto).toFixed(2)}` : totalVenduto;
    if (id === 'nncf') return totalNNCF;
    if (id === 'gi') return isCurrency ? `€ ${Number(totalIncassato).toFixed(2)}` : totalIncassato;

    const raw = kpisValuesMap[id] ?? kpis[id] ?? 0;
    if (isCurrency) {
      return `€ ${Number(raw).toFixed(2)}`;
    }
    return raw;
  }

  function getMetricSubtitle(metric: { id: string; label: string }, kpiInfo: any): string {
    if (metric.id === 'vss') return `Approvati: ${totalContratti - pendingContratti}`;
    if (metric.id === 'gi') return `Attesa: ${pendingContratti}`;
    return kpiInfo.name || metric.label;
  }
</script>

<section class="kpi-deck">
  {#each dashboardMetrics as m (m.id)}
    {@const kpiInfo = getKpiInfo(m.id)}
    {@const displayVal = getMetricValue(m.id, m.isCurrency)}
    {@const subtitleVal = getMetricSubtitle(m, kpiInfo)}
    <KPITile 
      theme="info" 
      icon={iconMap[m.id] || FileText} 
      title={m.shortLabel || kpiInfo.acronym} 
      value={displayVal} 
      subtitle={subtitleVal} 
      titleAttr={`${kpiInfo.name || m.label} - ${kpiInfo.description || ''}`} 
      onclick={() => onTabSelect(m.id)} 
      inlineSubtitle={true}
    />
  {/each}

  {#if hasActivities}
    {#each allowedActivities as act}
      <KPITile 
        theme="info" 
        icon={iconMap[act.icon] || ActivitySquare} 
        title={act.acronym || act.name.substring(0, 3).toUpperCase()} 
        value={activityCounts[act.id] || 0} 
        subtitle={act.name} 
        titleAttr={act.name} 
        onclick={() => onTabSelect(act.id)} 
        inlineSubtitle={true}
      />
    {/each}
  {/if}
</section>

<style>
  .kpi-deck {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
