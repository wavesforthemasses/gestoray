export type VehicleStatus = 'disponibile' | 'in_uso' | 'manutenzione' | 'dismesso';

export type VehicleType = 'furgone' | 'autocarro' | 'macchinario' | 'attrezzatura' | 'altro';

export interface VehicleItem {
  id: string;
  code: string;
  name: string;
  type: VehicleType;
  licensePlate?: string;
  status: VehicleStatus;
  assignedPlaceId?: string;
  assignedPlaceName?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EntityNamingType = 'mezzo' | 'furgone' | 'macchinario' | 'attrezzatura' | 'strumento' | 'custom';

export interface VehicleSettings {
  entityNaming: EntityNamingType;
  customSingularLabel?: string;
  customPluralLabel?: string;
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: VehicleStatus;
}
