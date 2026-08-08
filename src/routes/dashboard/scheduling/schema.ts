import type { AssignedEntityRef } from '$lib/types/assignments';

export type { AssignedEntityRef };
export type ScheduleSlot = 'mattina' | 'pomeriggio' | 'giornata_intera' | 'custom';

export interface CompositeCalendarItem {
  id: string;
  source: 'intervention' | 'activity' | 'deadline';
  title: string;
  date: string; // YYYY-MM-DD
  slot: ScheduleSlot;
  customStartTime?: string; // HH:mm
  customEndTime?: string; // HH:mm
  assignedEntities: AssignedEntityRef[];
  clientId?: string;
  clientName?: string;
  placeId?: string;
  placeName?: string;
  status: string;
  phase?: string;
  priority?: string;
  notes?: string;
  interventionNumber?: string;
  originalRef?: any;
}

export type EntityNamingType = 'pianificazione' | 'agenda' | 'programma' | 'turni' | 'custom';

export interface ScheduleSettings {
  entityNaming: EntityNamingType;
  customSingularLabel?: string;
  customPluralLabel?: string;
  defaultSlot: ScheduleSlot;
}

export interface ScheduleViewFilter {
  sources?: ('intervention' | 'activity' | 'deadline')[];
  statuses?: string[];
  tags?: string[];
}

export interface ScheduleView {
  id: string;
  name: string;
  icon?: string;
  layout: 'list' | 'matrix';
  matrixYAxis?: 'teams' | 'users' | 'vehicles' | 'places';
  filters: ScheduleViewFilter;
  order: number;
}


