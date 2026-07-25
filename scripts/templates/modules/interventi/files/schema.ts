import type { PricingUnit as BasePricingUnit } from '$lib/types/interventi';

export type PricingUnit = BasePricingUnit;

export interface TeamItem {
  id?: string;
  name: string;
  leaderUid?: string;
  memberUids: string[];
  defaultVehicleId?: string;
  color?: string;
  active: boolean;
  createdAt?: any;
}

export interface VehicleItem {
  id?: string;
  name: string;
  plate?: string;
  type: string;
  status: 'disponibile' | 'in_uso' | 'manutenzione';
  notes?: string;
  createdAt?: any;
}

export interface LocationItem {
  id?: string;
  clientId: string;
  name: string;
  address?: string;
  city?: string;
  type: 'cantiere' | 'sede_cliente' | 'ufficio' | 'stabilimento' | 'da_remoto' | 'consegna';
  notes?: string;
}

export interface RelatedEntityRef {
  entityType: string;
  entityId: string;
  relationType?: string;
  metadata?: Record<string, any>;
}

export interface InterventionConsuntivoItem {
  id: string;
  productId?: string;
  type?: string;
  description: string;
  pricingUnit?: PricingUnit;
  quantity: number;
  unitPrice?: number;
  total?: number;
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

  teamId?: string;
  teamName?: string;
  assignedOperatorUids?: string[];
  vehicleIds?: string[];

  type: string;
  pricingUnit: PricingUnit;
  unitPriceSnapshot?: number;
  mode: 'a_bolla' | 'ad_erogazione';
  status: 'pianificato' | 'in_lavorazione' | 'completato' | 'inviato_cliente' | 'approvato' | 'fatturato';

  scheduledStartAt?: string;
  scheduledEndAt?: string;
  executedStartAt?: string;
  executedEndAt?: string;

  estimatedQuantity?: number;
  actualQuantityWorked?: number;

  estimatedHours?: number;
  actualHoursWorked?: number;

  items?: InterventionConsuntivoItem[];

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
