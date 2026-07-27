export type ActivityPriority = 'bassa' | 'media' | 'alta' | 'urgente';
export type ActivityStatus = 'da_fare' | 'in_corso' | 'completata' | 'completato' | 'annullato';

export interface ActivityItem {
  id?: string;
  activityNumber?: string;
  title: string;
  activityTypeId?: string;
  activityTypeName?: string;
  assignedUid: string;
  assignedName: string;
  executionDate?: string;
  dueDate?: string;
  priority: ActivityPriority;
  status: ActivityStatus;
  description?: string;
  clientId?: string;
  clientName?: string;
  contactId?: string;
  contactName?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
