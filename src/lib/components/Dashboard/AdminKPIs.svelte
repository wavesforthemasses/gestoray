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
    activityCalls,
    activityMeetings,
    activityAppointments,
    onTabSelect
  } = $props<{
    totalClienti: number;
    totalVenduto: number;
    totalContratti: number;
    pendingContratti: number;
    totalIncassato: number;
    totalNNCF: number;
    commMaturate: number;
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
    value={totalClienti} 
    subtitle="Lead totali" 
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
