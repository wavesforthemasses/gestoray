<script lang="ts">
  import { KPITile, ChartSettingsService } from "$lib";
  import { DollarSign, FileText, Phone, Users, Calendar, Wallet, Award, CreditCard, ActivitySquare, MessageSquare, CheckCircle, Mail, Briefcase } from "@lucide/svelte";
  import { menuConfigStore } from "$lib/stores/menu";
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
    'Mail': Mail
  };

  const allowedActivities = $derived((activitiesConfig || []).filter((a: any) => a.rolesView.includes(activeRoleState.role || 'superadmin')));

  const kpisValuesMap = $derived<Record<string, any>>({
    totalNNCF,
    totalVenduto,
    totalIncassato,
    commMaturate,
    ...kpis
  });

  // Dynamic KPI Tiles from active modules
  const activeKPITiles = $derived(
    $menuConfigStore
      .filter((m: any) => m.kpiTiles && Array.isArray(m.kpiTiles))
      .flatMap((m: any) => m.kpiTiles)
  );

  const getKpiInfo = (id: string) => {
    const kpi = ChartSettingsService.getAllKpisMasterListSync().find(k => k.id === id);
    if (!kpi) return { acronym: id?.toUpperCase() || '', name: id || '', description: '' };
    return kpi;
  };

  const naKpi = $derived(getKpiInfo('nuove_anagrafiche'));
</script>

<section class="kpi-deck">
  <KPITile 
    theme="info" 
    icon={Users} 
    title={naKpi.acronym} 
    value={totalClienti} 
    subtitle={naKpi.name} 
    titleAttr={`${naKpi.name} - ${naKpi.description}`} 
    onclick={() => onTabSelect("nuove_anagrafiche")} 
    inlineSubtitle={true}
  />

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

  {#each activeKPITiles as tile}
    {@const kpiInfo = getKpiInfo(tile.id)}
    {@const rawVal = kpisValuesMap[tile.valueKey] || 0}
    {@const displayVal = tile.format === 'currency' ? `€ ${Number(rawVal).toFixed(2)}` : rawVal}
    {@const subtitleVal = tile.id === 'vss' ? `Approvati: ${totalContratti - pendingContratti}` : tile.id === 'gi' ? `Attesa: ${pendingContratti}` : kpiInfo.name}
    <KPITile 
      theme="info" 
      icon={iconMap[tile.icon] || FileText} 
      title={kpiInfo.acronym} 
      value={displayVal} 
      subtitle={subtitleVal} 
      titleAttr={`${kpiInfo.name} - ${kpiInfo.description}`} 
      onclick={() => onTabSelect(tile.id)} 
      inlineSubtitle={true}
    />
  {/each}
</section>

<style>
  .kpi-deck {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
