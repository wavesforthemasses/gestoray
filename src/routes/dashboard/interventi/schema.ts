export type PricingUnit = 'ora' | 'mq' | 'mc' | 'quantita' | 'corpo';

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
  entityType: string;  // 'invoice' | 'contract' | 'ticket' | 'order' | 'quote'
  entityId: string;
  relationType?: string; // 'originated_from' | 'billed_in' | 'attached_to'
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

  // Assegnazione Risorse Umane & Mezzi
  teamId?: string;
  teamName?: string;
  assignedOperatorUids?: string[];
  vehicleIds?: string[];

  type: string; // es. 'Manutenzione', 'Consegna', 'Consulenza', 'Sopralluogo'
  pricingUnit: PricingUnit; // 'ora' | 'mq' | 'mc' | 'quantita' | 'corpo'
  unitPriceSnapshot?: number;
  mode: 'a_bolla' | 'ad_erogazione';
  status: 'pianificato' | 'in_lavorazione' | 'completato' | 'inviato_cliente' | 'approvato' | 'fatturato';

  // Date e Tempistiche Temporali (Timestamp ISO / String)
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  executedStartAt?: string;
  executedEndAt?: string;
  
  // Stima vs Consuntivo (Ore o Quantità)
  estimatedQuantity?: number;
  actualQuantityWorked?: number;

  // Retrocompatibilità
  estimatedHours?: number;
  actualHoursWorked?: number;

  // Righe Consuntivo (Materiali / Prodotti)
  items?: InterventionConsuntivoItem[];

  // Totali Economici
  hourlyRateSnapshot?: number;
  totalAmount?: number;
  
  // Firma e Conferma Cliente
  clientSignature?: string;
  signedAt?: string;
  signedByName?: string;

  // Relazioni Astratte Cross-Modulo (Dinamiche / Decoppiate)
  relatedEntities?: RelatedEntityRef[];

  // Dynamic Custom Fields
  customFields?: Record<string, any>;

  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
