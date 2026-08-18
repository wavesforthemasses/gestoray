import type { AssignedEntityRef } from '$lib/types/assignments';

export type { AssignedEntityRef };
export type ActivityPriority = 'bassa' | 'media' | 'alta' | 'urgente';
export type ActivityStatus = 'da_fare' | 'in_corso' | 'completata' | 'completato' | 'annullato';
export type ActivityCategory = 'crm' | 'operational' | 'internal' | 'maintenance' | 'event' | 'task';

export type ActivityTargetType = 
  | 'contact'     // Referente / Persona fisica (contatto primario)
  | 'client'      // Ragione Sociale / Azienda
  | 'user'        // Utente Interno / Dipendente
  | 'place'       // Luogo / Impianto / Sede
  | 'vehicle'     // Mezzo Aziendale
  | 'contract'    // Preventivo / Contratto
  | 'ticket';     // Ticket Assistenza

export interface ActivityType {
  id: string;
  name: string;
  code: string;
  icon: string;
  category?: ActivityCategory;
  allowedTargets: ActivityTargetType[];
  isSchedulable: boolean;
  defaultPriority: ActivityPriority;
  defaultStatus: ActivityStatus;
  rolesInsert: string[];
  canAssignToOthers: string[];
  order?: number;
  isSystem?: boolean;
}

export interface ActivityItem {
  id?: string;
  activityNumber?: string;
  title: string;
  activityTypeId?: string;
  activityTypeName?: string;
  category?: ActivityCategory;

  // Target Context
  targetType?: ActivityTargetType;
  targetId?: string;
  targetName?: string;
  targetSubtext?: string;

  // Multiple tagging assignment (users, teams, vehicles)
  assignedEntities?: AssignedEntityRef[];
  assigneeFilterKeys?: string[];

  // Legacy fallback fields for backward compatibility
  assignedUid?: string;
  assignedName?: string;

  executionDate?: string;
  dueDate?: string;
  durationMinutes?: number;
  
  // Scheduling fields
  scheduledDate?: string; // YYYY-MM-DD
  scheduledSlot?: 'mattina' | 'pomeriggio' | 'giornata_intera' | 'custom';
  customStartTime?: string; // HH:mm
  customEndTime?: string; // HH:mm

  priority: ActivityPriority;
  status: ActivityStatus;
  description?: string;
  
  // Legacy entity fields for backward compatibility
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
  edits?: {
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    aggregateVersion?: number;
    lastLedgerId?: string;
    updatedAt?: any;
  };
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
    deleted?: boolean;
  };
}
