<script lang="ts">
  import { KPITile } from "$lib";
  import { KPI_LEGEND } from "$lib/kpiLegend";
  import { DollarSign, FileText, Phone, Users, Calendar, Wallet } from "@lucide/svelte";

  let { 
    totalClienti,
    totalVenduto,
    totalContratti,
    pendingContratti,
    totalIncassato,
    totalNNCF,
    commMaturate,
    activityCounts,
    activitiesConfig,
    onTabSelect
  } = $props<{
    totalClienti: number;
    totalVenduto: number;
    totalContratti: number;
    pendingContratti: number;
    totalIncassato: number;
    totalNNCF: number;
    commMaturate: number;
    activityCounts: Record<string, number>;
    activitiesConfig: any[];
    onTabSelect: (tab: string) => void;
  }>();

  import { MessageSquare, ActivitySquare, CheckCircle, Mail, Briefcase } from "@lucide/svelte";

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

  import { activeRoleState } from "$lib/auth.svelte";
  const allowedActivities = $derived(activitiesConfig.filter((a: any) => a.rolesView.includes(activeRoleState.role || 'superadmin')));
</script>

<section class="kpi-deck">
  <KPITile 
    theme="info" 
    icon={Users} 
    title="NA" 
    value={totalClienti} 
    subtitle="Lead totali" 
    titleAttr={`${KPI_LEGEND.NA.label} - ${KPI_LEGEND.NA.description}`} 
    onclick={() => onTabSelect("nuove_anagrafiche")} 
    inlineSubtitle={true}
  />

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

  <KPITile 
    theme="info" 
    icon={FileText} 
    title="NNCF" 
    value={totalNNCF} 
    subtitle="Conversioni" 
    titleAttr={`${KPI_LEGEND.NNCF.label} - ${KPI_LEGEND.NNCF.description}`} 
    onclick={() => onTabSelect("nncf")} 
    inlineSubtitle={true}
  />

  <KPITile 
    theme="info" 
    icon={DollarSign} 
    title="VSS" 
    value={`€ ${totalVenduto.toFixed(2)}`} 
    subtitle={`Approvati: ${totalContratti - pendingContratti}`} 
    titleAttr={`${KPI_LEGEND.VSS.label} - ${KPI_LEGEND.VSS.description}`} 
    onclick={() => onTabSelect("vss")} 
    inlineSubtitle={true}
  />

  <KPITile 
    theme="info" 
    icon={Wallet} 
    title="GI" 
    value={`€ ${totalIncassato.toFixed(2)}`} 
    subtitle={`Attesa: ${pendingContratti}`} 
    titleAttr={`${KPI_LEGEND.GI.label} - ${KPI_LEGEND.GI.description}`} 
    onclick={() => onTabSelect("gi")} 
    inlineSubtitle={true}
  />

  <KPITile 
    theme="info" 
    icon={DollarSign} 
    title="Provvigioni Maturate" 
    value={`€ ${commMaturate.toFixed(2)}`} 
    subtitle="Generiche (Rete)" 
    onclick={() => onTabSelect("provvigioni_maturate")}
    inlineSubtitle={true}
  />
</section>

<style>
  .kpi-deck {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
