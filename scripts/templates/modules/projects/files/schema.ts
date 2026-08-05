export type ProjectStatus = 'fase_contrattuale' | 'aperto' | 'in_pausa' | 'completato';

export interface ProjectAddress {
  street: string;
  city: string;
  zip: string;
  province: string;
}

export interface ProjectItem {
  id?: string;
  code: string;
  clientId: string;
  clientName?: string;
  name: string;
  address?: ProjectAddress;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  progress: number;
  estimatedAmount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  original?: Record<string, any>;
  derived?: Record<string, any>;
}

export interface ProjectSettings {
  entityNaming: 'progetto' | 'cantiere' | 'commessa' | 'pratica' | 'custom';
  customSingularLabel?: string;
  customPluralLabel?: string;
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: ProjectStatus;
}
