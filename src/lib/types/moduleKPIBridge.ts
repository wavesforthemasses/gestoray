export type FieldType = 'string' | 'number' | 'currency' | 'boolean' | 'date' | 'datetime' | 'array' | 'object';

export interface ModuleSchemaField {
  type: FieldType;
  description: string;
  tags: string[]; // e.g. ['kpi:vss', 'filter:date', 'filter:status', 'search', 'gdpr-anonymize']
  required?: boolean;
  defaultValue?: any;
}

export interface ModuleKPIDefinition {
  id: string;
  label: string;
  description?: string;
  unit?: string;
  role?: string;
}

export interface KPIFetchParams {
  role: string;
  uid: string;
}

export interface ChartFetchParams {
  period: { start: Date; end: Date; label: string };
  tab: string;
  role: string;
  uid: string;
}

export interface DrillDownFetchParams {
  period: { start: Date; end: Date; label: string };
  tab: string;
  role: string;
  uid: string;
  clientFilter?: string;
  vendorFilter?: string;
  productFilter?: string;
}

export interface ModuleKPIBridge {
  fetchKPIs(params: KPIFetchParams): Promise<Record<string, any>>;
  fetchChartAggregations?(periods: Array<{ start: Date; end: Date; label: string }>, params: KPIFetchParams, tab: string): Promise<number[]>;
  fetchDrillDownItems?(params: DrillDownFetchParams): Promise<any[]>;
}
