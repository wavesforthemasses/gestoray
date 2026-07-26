export type ActivityPriority = 'bassa' | 'media' | 'alta' | 'urgente';
export type ActivityStatus = 'da_fare' | 'in_corso' | 'completato' | 'annullato';

export interface ActivityItem {
  id?: string;
  activityNumber: string;
  title: string;
  assignedUid: string;
  assignedName: string;
  dueDate: string;
  priority: ActivityPriority;
  status: ActivityStatus;
  description?: string;
  customFields?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  derived?: {
    textSearch?: string[];
    cacheChunkId?: string;
  };
}
