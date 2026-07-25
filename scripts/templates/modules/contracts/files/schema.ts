export type ContractType = 'Canone Ricorrente' | 'Monte Ore' | 'SLA Garantito' | 'Licenza / Abbonamento';
export type ContractStatus = 'attivo' | 'in_scadenza' | 'scaduto' | 'sospeso';
export type RecurringFrequency = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale';

export interface ContractInstallment {
  id?: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: 'in_attesa' | 'pagato' | 'scaduto';
  notes?: string;
}

export interface ContractItem {
  id?: string;
  contractNumber: string;
  title: string;
  clientId: string;
  clientName: string;
  type: ContractType;
  totalAmount: number;
  billingFrequency: RecurringFrequency;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  notes?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
