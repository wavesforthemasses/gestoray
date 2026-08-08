export type EntityType = 'user' | 'team' | 'vehicle' | 'place';

export interface AssignedEntityRef {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  roleLabel?: string;
}
