import type { ActivityType } from '../../routes/dashboard/activities/schema';

export type ActivityTargetType = 
  | 'contact'     // Referente / Persona fisica (contatto primario)
  | 'client'      // Ragione Sociale / Azienda
  | 'user'        // Utente Interno / Dipendente
  | 'place'       // Luogo / Impianto / Sede
  | 'vehicle'     // Mezzo Aziendale
  | 'contract'    // Preventivo / Contratto
  | 'ticket';     // Ticket Assistenza

export interface TargetSearchResult<TRaw = Record<string, unknown>> {
  id: string;
  label: string;
  subtext?: string;
  badge?: string;
  phone?: string;
  email?: string;
  address?: string;
  raw?: TRaw;
}

export interface TargetSummary {
  id: string;
  name: string;
  targetType: ActivityTargetType;
  email?: string;
  phone?: string;
  address?: string;
  isModuleDisabled?: boolean;
  meta?: Record<string, unknown>;
}

export interface ModuleActivitiesBridgeSpec<TRaw = Record<string, unknown>> {
  moduleId: string;
  targetType: ActivityTargetType;
  targetLabel: string;
  targetIcon: string; // Nome icona Lucide
  defaultActivityTypes?: ActivityType[];
  searchTargets: (searchVal: string, tenantId?: string) => Promise<TargetSearchResult<TRaw>[]>;
  getTargetSummary: (id: string, tenantId?: string) => Promise<TargetSummary | null>;
}
