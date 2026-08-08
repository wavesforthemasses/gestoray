import type { PricingUnit as BasePricingUnit } from '$lib/types/interventi';
import type { AssignedEntityRef } from '$lib/types/assignments';

export type { AssignedEntityRef };
export type PricingUnit = BasePricingUnit;

export interface RelatedEntityRef {
  entityType: string;
  entityId: string;
  relationType?: string;
  metadata?: Record<string, any>;
}

export interface WorkLogEntry {
  id: string;
  productId?: string;
  productName?: string;
  description: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice?: number;
  totalAmount?: number;
  entryType: 'labor' | 'material' | 'equipment' | 'expense' | 'other';
  notes?: string;
}

export type WorkOrderPhase = 
  | 'bozza'           // Ex "Activity" - Solo titolo e descrizione
  | 'pianificato'     // Data, slot e risorse assegnate  
  | 'in_lavorazione'  // Operatore/squadra al lavoro
  | 'completato'      // WorkLog e consuntivo compilato
  | 'firmato'         // Firma cliente raccolta
  | 'fatturato'       // Chiusura amministrativa
  | 'annullato';

export type WorkOrderCategory = 'task' | 'intervention' | 'event';
export type WorkOrderPriority = 'bassa' | 'media' | 'alta' | 'urgente';

export type InterventionStatus = 'pianificato' | 'in_lavorazione' | 'completato' | 'inviato_cliente' | 'approvato' | 'fatturato';

export interface InterventionSettings {
  entityNaming: 'bolla' | 'erogazione' | 'rapporto' | 'consuntivo' | 'custom';
  customSingularLabel?: string;
  customPluralLabel?: string;
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: InterventionStatus;
  isSignatureMandatory: boolean;
}

export interface InterventionItem {
  id?: string;
  interventionNumber?: string;
  title: string;
  description: string;
  clientId: string;
  clientName?: string;
  locationId?: string;
  locationName?: string;
  contractId?: string;
  contractTitle?: string;
  ticketId?: string;
  ticketSubject?: string;

  // Unified Lifecycle & Category
  phase?: WorkOrderPhase;
  category?: WorkOrderCategory;
  priority?: WorkOrderPriority;
  dueDate?: string;

  // Multiple tagging assignment (users, teams, vehicles)
  assignedEntities: AssignedEntityRef[];

  // Legacy fallback fields for backward compatibility
  teamId?: string;
  teamName?: string;
  assignedOperatorUids?: string[];
  vehicleIds?: string[];

  type: string;
  pricingUnit: PricingUnit;
  unitPriceSnapshot?: number;
  mode: 'a_bolla' | 'ad_erogazione';
  status: InterventionStatus;

  scheduledDate?: string; // YYYY-MM-DD
  scheduledSlot?: 'mattina' | 'pomeriggio' | 'giornata_intera' | 'custom';
  scheduledCustomStart?: string; // HH:mm
  scheduledCustomEnd?: string;   // HH:mm

  scheduledStartAt?: string;
  scheduledEndAt?: string;
  executedStartAt?: string;
  executedEndAt?: string;

  estimatedQuantity?: number;
  actualQuantityWorked?: number;

  estimatedHours?: number;
  actualHoursWorked?: number;

  // Work log entries (Consuntivazione)
  workLogEntries?: WorkLogEntry[];
  items?: WorkLogEntry[];

  hourlyRateSnapshot?: number;
  totalAmount?: number;

  clientSignature?: string;
  signatureName?: string;
  signatureData?: string;
  signedAt?: string;
  signedByName?: string;

  relatedEntities?: RelatedEntityRef[];
  customFields?: Record<string, any>;

  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

