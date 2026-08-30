export type EntityType = 'user' | 'team' | 'vehicle' | 'place' | 'client' | 'contact';

export interface AssignedEntityRef {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  roleLabel?: string;
  isLeader?: boolean;
  // Backward-compatible optional aliases
  id?: string;
  name?: string;
  type?: EntityType;
}
