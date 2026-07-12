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
    activityCalls,
    activityMeetings,
    activityAppointments,
    onTabSelect
  } = $props<{
    commTotalNA: number;
    commContractsCount: number;
    commTotalSold: number;
    commMaturate: number;
    commTotalNNCF: number;
    commIncassato: number;
    activityCalls: number;
    activityMeetings: number;
    activityAppointments: number;
    onTabSelect: (tab: string) => void;
  }>();
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

  <KPITile 
    theme="info" 
    icon={Phone} 
    title="TF" 
    value={activityCalls} 
    subtitle="Loggate" 
    titleAttr={`${KPI_LEGEND.TF.label} - ${KPI_LEGEND.TF.description}`} 
    onclick={() => onTabSelect("Telefonata")} 
    inlineSubtitle={true}
  />

  <KPITile 
    theme="info" 
    icon={Users} 
    title="IF" 
    value={activityMeetings} 
    subtitle="Riunioni" 
    titleAttr={`${KPI_LEGEND.IF.label} - ${KPI_LEGEND.IF.description}`} 
    onclick={() => onTabSelect("Incontro")} 
    inlineSubtitle={true}
  />

  <KPITile 
    theme="info" 
    icon={Calendar} 
    title="AF" 
    value={activityAppointments} 
    subtitle="Pianificati" 
    titleAttr={`${KPI_LEGEND.AF.label} - ${KPI_LEGEND.AF.description}`} 
    onclick={() => onTabSelect("Appuntamento")} 
    inlineSubtitle={true}
  />

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

  <KPITile 
    theme="info" 
    icon={DollarSign} 
    title="GI" 
    value={`€ ${commIncassato.toFixed(2)}`} 
    subtitle="Da contratti" 
    onclick={() => onTabSelect("gi")} 
    inlineSubtitle={true}
  />

  <KPITile 
    theme="info" 
    icon={DollarSign} 
    title="Provvigioni Maturate" 
    value={`€ ${commMaturate.toFixed(2)}`} 
    subtitle="Definitive" 
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
