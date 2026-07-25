export type CommissionStatus = 'in_attesa' | 'maturata' | 'liquidata' | 'stornata';

export interface CommissionItem {
  id?: string;
  commissionNumber: string;
  agentUid: string;
  agentName: string;
  dealTitle: string;
  dealAmount: number;
  commissionRate: number; // percentage e.g. 10 for 10%
  commissionAmount: number;
  earnedDate: string;
  status: CommissionStatus;
  notes?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
