import type { AssignedEntityRef } from '$lib/types/assignments';

export type { AssignedEntityRef };
export type ActivityPriority = 'bassa' | 'media' | 'alta' | 'urgente';
export type ActivityStatus = 'da_fare' | 'in_corso' | 'completata' | 'completato' | 'annullato';
export type ActivityCategory = 'task' | 'event';

export interface ActivityTypeConfig {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  category: ActivityCategory; // 'task' (lavoro standard) | 'event' (evento futuro / programmato)
  defaultPriority?: ActivityPriority;
  isSystem?: boolean;
}

export interface ActivityItem {
  id?: string;
  activityNumber?: string;
  title: string;
  activityTypeId?: string;
  activityTypeName?: string;
  category?: ActivityCategory;

  // Multiple tagging assignment (users, teams, vehicles)
  assignedEntities?: AssignedEntityRef[];

  // Legacy fallback fields for backward compatibility
  assignedUid?: string;
  assignedName?: string;

  executionDate?: string;
  dueDate?: string;
  
  // Scheduling fields
  scheduledDate?: string; // YYYY-MM-DD
  scheduledSlot?: 'mattina' | 'pomeriggio' | 'giornata_intera' | 'custom';
  customStartTime?: string; // HH:mm
  customEndTime?: string; // HH:mm

  priority: ActivityPriority;
  status: ActivityStatus;
  description?: string;
  clientId?: string;
  clientName?: string;
  placeId?: string;
  placeName?: string;
  contactId?: string;
  contactName?: string;
  groupId?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
