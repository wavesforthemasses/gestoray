export * from './domain/models/place';

// Legacy compatibility aliases
import type { PlaceDocument, PlaceAddress, PlaceStatus, PlaceType } from './domain/models/place';

export type { PlaceStatus, PlaceAddress, PlaceType };
export type PlaceItem = PlaceDocument;

import type { PresenceSettings } from './domain/models/presence';
export type { PresenceSettings };

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
  presence?: PresenceSettings;
}
