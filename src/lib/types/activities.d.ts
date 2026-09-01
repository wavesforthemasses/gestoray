export type ActivityPriority = 'bassa' | 'media' | 'alta' | 'urgente';
export type ActivityStatus = 'da_fare' | 'in_corso' | 'completata' | 'completato' | 'annullato' | 'annullata';
export type ActivityCategory = 'crm' | 'operational' | 'internal' | 'maintenance' | 'event' | 'task';

export type ActivityTargetType = 
  | 'contact'
  | 'client'
  | 'user'
  | 'place'
  | 'vehicle'
  | 'contract'
  | 'ticket';

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
