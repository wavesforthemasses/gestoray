<script lang="ts">
  import { KPITile } from "$lib";
  import { KPI_LEGEND } from "$lib/kpiLegend";
  import { Briefcase, DollarSign, FileText, Phone, Users, Calendar } from "@lucide/svelte";

  let { 
    commTotalNA,
    commContractsCount,
    commTotalSold,
    commMaturate,
    commTotalNNCF,
    commIncassato,
    activityCounts,
    activitiesConfig,
    onTabSelect,
    hasContracts = false,
    hasPayments = false,
    hasCommissions = false,
    hasActivities = false
  } = $props<{
    commTotalNA: number;
    commContractsCount: number;
    commTotalSold: number;
    commMaturate: number;
    commTotalNNCF: number;
    commIncassato: number;
    activityCounts: Record<string, number>;
    activitiesConfig: any[];
    onTabSelect: (tab: string) => void;
    hasContracts?: boolean;
    hasPayments?: boolean;
    hasCommissions?: boolean;
    hasActivities?: boolean;
  }>();

  import { MessageSquare, ActivitySquare, CheckCircle, Mail } from "@lucide/svelte";

  const iconMap: Record<string, any> = {
    'Phone': Phone,
    'Users': Users,
    'Calendar': Calendar,
    'MessageSquare': MessageSquare,
    'FileText': FileText,
    'ActivitySquare': ActivitySquare,
    'CheckCircle': CheckCircle,
    'Briefcase': Briefcase,
    'Mail': Mail
  };

  const allowedActivities = $derived(activitiesConfig.filter((a: any) => a.rolesView.includes('commerciale')));
</script>

<section class="kpi-deck">
  <KPITile 
    theme="info" 
    icon={Users} 
    title="NA" 
    value={commTotalNA} 
    subtitle="Nuovi lead" 
    titleAttr={`${KPI_LEGEND.NA.label} - ${KPI_LEGEND.NA.description}`} 
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

  {#if hasContracts}
    <KPITile 
      theme="info" 
      icon={FileText} 
      title="NNCF" 
      value={commTotalNNCF} 
      subtitle="Nuovi clienti" 
      titleAttr={`${KPI_LEGEND.NNCF.label} - ${KPI_LEGEND.NNCF.description}`} 
      onclick={() => onTabSelect("nncf")} 
      inlineSubtitle={true}
    />

    <KPITile 
      theme="info" 
      icon={Briefcase} 
      title="VSS" 
      value={commContractsCount} 
      subtitle={`Ord: € ${commTotalSold.toFixed(2)}`} 
      onclick={() => onTabSelect("vss")} 
      inlineSubtitle={true}
    />
  {/if}

  {#if hasPayments}
    <KPITile 
      theme="info" 
      icon={DollarSign} 
      title="GI" 
      value={`€ ${commIncassato.toFixed(2)}`} 
      subtitle="Da contratti" 
      onclick={() => onTabSelect("gi")} 
      inlineSubtitle={true}
    />
  {/if}

  {#if hasCommissions}
    <KPITile 
      theme="info" 
      icon={DollarSign} 
      title="Provvigioni Maturate" 
      value={`€ ${commMaturate.toFixed(2)}`} 
      subtitle="Definitive" 
      onclick={() => onTabSelect("provvigioni_maturate")}
      inlineSubtitle={true}
    />
  {/if}
</section>

<style>
  .kpi-deck {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
