<script lang="ts">
  import { KPITile } from "$lib";
  import { KPI_LEGEND } from "$lib/kpiLegend";
  import { Briefcase, DollarSign, FileText, Phone, Users, Calendar, Wallet, Award, CreditCard, ActivitySquare, MessageSquare, CheckCircle, Mail } from "@lucide/svelte";
  import { menuConfigStore } from "$lib/stores/menu";

  let { 
    kpis = {},
    commTotalNA = 0,
    commContractsCount = 0,
    commTotalSold = 0,
    commMaturate = 0,
    commTotalNNCF = 0,
    commIncassato = 0,
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

  const allowedActivities = $derived((activitiesConfig || []).filter((a: any) => a.rolesView.includes('commerciale')));

  const kpisValuesMap = $derived<Record<string, any>>({
    commTotalNNCF,
    commContractsCount,
    commTotalSold,
    commIncassato,
    commMaturate,
    ...kpis
  });

  // Dynamic KPI Tiles from active modules
  const activeKPITiles = $derived(
    $menuConfigStore
      .filter((m: any) => m.kpiTiles && Array.isArray(m.kpiTiles))
      .flatMap((m: any) => m.kpiTiles)
  );
</script>

<section class="kpi-deck">
  <KPITile 
    theme="info" 
    icon={Users} 
    title="NA" 
    value={commTotalNA} 
    subtitle="Nuovi lead" 
    titleAttr={`${KPI_LEGEND.NA?.label || 'Nuove Anagrafiche'} - ${KPI_LEGEND.NA?.description || ''}`} 
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
    {@const rawVal = kpisValuesMap[tile.commValueKey || tile.valueKey] || 0}
    {@const isVss = tile.id === 'vss'}
    {@const displayVal = isVss ? rawVal : (tile.format === 'currency' ? `€ ${Number(rawVal).toFixed(2)}` : rawVal)}
    {@const subtitleVal = isVss ? `Ord: € ${commTotalSold.toFixed(2)}` : tile.subtitle}
    <KPITile 
      theme="info" 
      icon={iconMap[tile.icon] || FileText} 
      title={tile.title} 
      value={displayVal} 
      subtitle={subtitleVal} 
      titleAttr={`${(KPI_LEGEND as any)[tile.id?.toUpperCase()]?.label || tile.title}`} 
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
