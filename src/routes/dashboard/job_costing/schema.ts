export type JobStatus = 'pianificata' | 'in_corso' | 'completata' | 'chiusa' | 'sospesa';
export type CostCategory = 'labor' | 'materials' | 'equipment' | 'subcontractor' | 'other';
export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface JobCostItem {
  id: string;
  jobId: string;
  tenantId?: string;
  date: string;
  category: CostCategory;
  description: string;
  sourceType: 'auto_bolla' | 'auto_warehouse' | 'auto_vehicle' | 'manual';
  sourceId?: string; // ID intervento, movimento magazzino o mezzo
  quantity: number;
  unitCost: number;
  totalCost: number;
  workerOrSupplierName?: string;
  notes?: string;
  createdAt: string;
}

export interface JobBudgetBreakdown {
  labor: number;
  materials: number;
  equipment: number;
  subcontractor: number;
  other: number;
  total: number;
}

export interface JobActualsBreakdown {
  labor: number;
  materials: number;
  equipment: number;
  subcontractor: number;
  other: number;
  total: number;
  laborHoursTotal: number;
  materialsCountTotal: number;
}

export interface JobRevenuesBreakdown {
  contractValue: number; // Valore preventivato/contrattualizzato
  invoicedTotal: number; // Totale fatturato emesso
  paidTotal: number;     // Incassato reale
}

export interface JobProfitabilityMetrics {
  grossMarginAmount: number;     // Ricavo Target (o Fatturato) - Totale Costi
  grossMarginPercent: number;    // (Margine / Ricavo) * 100
  realizedMarginAmount: number;  // Incassato Reale - Totale Costi
  budgetVarianceAmount: number;  // Totale Costi - Totale Budget
  budgetVariancePercent: number;
  isOverBudget: boolean;
  isLossMaking: boolean;         // Margine < 0
  healthStatus: HealthStatus;    // Healthy (>20%), Warning (10-20%), Critical (<10% o over budget)
}

export interface JobCostingProject {
  id: string;
  tenantId: string;
  code: string; // es. COMM-2026-001
  title: string;
  description?: string;
  placeId?: string;
  placeName?: string;
  includeSubPlaces: boolean;
  clientId?: string;
  clientName?: string;
  contractId?: string;
  contractTitle?: string;
  status: JobStatus;
  startDate: string;
  expectedEndDate?: string;
  closedAt?: string;
  lastSyncedAt?: string;

  budget: JobBudgetBreakdown;
  actuals: JobActualsBreakdown;
  revenues: JobRevenuesBreakdown;
  profitability: JobProfitabilityMetrics;

  notes?: string;
  createdAt: string;
  updatedAt: string;

  edits?: {
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    aggregateVersion?: number;
    lastLedgerId?: string;
  };
}

export interface JobCostingSettings {
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultHourlyLaborRate: number; // Default 30.00 €/h
  defaultVehicleDailyRate: number; // Default 40.00 €/giorno
  warningMarginThresholdPercent: number; // Default 20%
  criticalMarginThresholdPercent: number;// Default 10%
}
