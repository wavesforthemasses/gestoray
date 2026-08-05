export type CantiereStatus = 'fase_contrattuale' | 'aperto' | 'in_pausa' | 'completato';

export interface CantiereAddress {
  street: string;
  city: string;
  zip: string;
  province: string;
}

export interface CantiereItem {
  id?: string;
  code: string;
  clientId: string;
  clientName?: string;
  name: string;
  address?: CantiereAddress;
  status: CantiereStatus;
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

export interface CantiereSettings {
  entityNaming: 'cantiere' | 'commessa';
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: CantiereStatus;
}
