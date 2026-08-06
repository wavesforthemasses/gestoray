export type PlaceStatus = 'attivo' | 'inattivo';

export interface PlaceAddress {
  street: string;
  city: string;
  zip: string;
  province: string;
}

export interface PlaceItem {
  id?: string;
  code: string;
  clientId: string;
  clientName?: string;
  name: string;
  address?: PlaceAddress;
  status: PlaceStatus;
  contactPerson?: string;
  phone?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  original?: Record<string, any>;
  derived?: Record<string, any>;
}

export interface PlaceSettings {
  entityNaming: 'cantiere' | 'luogo' | 'sede' | 'destinazione' | 'custom';
  customSingularLabel?: string;
  customPluralLabel?: string;
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: PlaceStatus;
}
