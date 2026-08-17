export interface MetricOption {
  id: string;          // e.g. 'vss', 'nncf', 'nuove_anagrafiche', 'total_count'
  label: string;       // e.g. 'Valore Venduto'
  shortLabel: string;  // e.g. 'VSS'
  description?: string; // Informative description / FAQ tooltip
  isCurrency?: boolean;
  color?: string;
}

export interface ListingKPIConfig {
  key: string;         // e.g. 'total_count', 'total_value', 'active_rate'
  label: string;
  visible: boolean;
  order: number;
}

export interface ListingChartConfig {
  enabled: boolean;
  defaultMetric: string;
  allowedMetrics: string[];
  defaultGranularity: 'settimanale' | 'mensile' | 'annuale';
}

export interface DashboardChartConfig {
  enabled: boolean;
  metricId: string;
  metricLabel: string;
  shortLabel: string;
  isCurrency: boolean;
}

export interface ModuleAnalyticsSettings {
  listingKPIs: ListingKPIConfig[];
  listingChart: ListingChartConfig;
  dashboardChart: DashboardChartConfig;
}
