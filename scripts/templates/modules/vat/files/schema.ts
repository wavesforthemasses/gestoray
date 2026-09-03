export interface VatRateItem {
  id: string;
  rate: number;
  label: string;
  natureCode?: string;
  normativeRef?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  enabled: boolean;
}

export interface VatSettings {
  defaultRate: number;
  rates: VatRateItem[];
  updatedAt?: string;
}
