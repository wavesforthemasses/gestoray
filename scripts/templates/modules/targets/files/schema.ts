export type TargetGranularity = 'settimanale' | 'mensile' | 'annuale';
export type TargetSubjectType = 'user' | 'team' | 'company';
export type TargetCompilationMode = 'manager_only' | 'self_submission';
export type TargetRecordStatus = 'draft' | 'submitted' | 'approved' | 'locked';
export type TargetAchievementTier = 'below_50' | 'between_50_80' | 'between_80_100' | 'over_100';

export interface SubmissionWindowConfig {
  enabled: boolean;
  daysBeforePeriodStart: number; // default: 6
  daysAfterPeriodStart: number;  // default: 2
  allowLateEdit: boolean;        // default: false (manager unlock needed)
}

export interface TargetPlanPermissions {
  // Configurazione per Soggetto 'user' (Singolo Utente)
  userSelfView: boolean;              // L'utente può vedere il proprio target (default: true)
  userSelfEdit: boolean;              // L'utente può compilare/modificare il proprio target nella finestra (default: false)
  userOthersViewRoles: string[];      // Ruoli che possono vedere i target degli altri utenti (default: ['superadmin', 'direzione', 'amministrazione'])
  userOthersEditRoles: string[];      // Ruoli che possono compilare i target degli altri utenti (default: ['superadmin', 'direzione'])

  // Configurazione per Soggetto 'team' (Squadra)
  teamMembersView: boolean;           // I membri della squadra possono vedere il target (default: true)
  teamMembersEdit: boolean;           // I membri possono compilarlo/modificarlo (default: false)
  teamLeaderView: boolean;            // Il caposquadra può vedere il target (default: true)
  teamLeaderEdit: boolean;            // Il caposquadra può compilarlo/modificarlo (default: true)
  teamOthersViewRoles: string[];      // Ruoli esterni che possono vedere il target di squadra (default: ['superadmin', 'direzione', 'amministrazione'])
  teamOthersEditRoles: string[];      // Ruoli esterni che possono compilare il target di squadra (default: ['superadmin', 'direzione'])

  // Configurazione per Soggetto 'company' (Totale Aziendale)
  companyViewRoles: string[];         // Ruoli che possono visualizzare il target globale (default: ['superadmin', 'direzione', 'amministrazione', 'commerciale', 'tecnico'])
  companyEditRoles: string[];         // Ruoli che possono compilare il target globale (default: ['superadmin', 'direzione'])
}

export interface TargetPlanDefinition {
  id: string;
  name: string;
  description: string;
  granularity: TargetGranularity;
  targetSubject: TargetSubjectType;
  assignedRoles: string[]; // e.g. ['commerciale', 'tecnico']
  assignedUserIds?: string[]; // Whitelist opzionale
  kpiIds: string[]; // e.g. ['vss', 'nncf', 'gi', 'completed_tasks']
  compilationMode: TargetCompilationMode;
  submissionWindow: SubmissionWindowConfig;
  permissions?: TargetPlanPermissions;
  defaultGrowthPct?: number; // % suggerita per clonazione periodo
  enabled: boolean;
  order: number;
}

export interface TargetRecordDocument {
  id: string;
  planId: string;
  planName: string;
  granularity: TargetGranularity;
  periodKey: string;     // "2026-09" | "2026-W36" | "2026"
  periodLabel: string;   // "Settembre 2026", "Settimana 36 (01/09 - 07/09)"
  startDate: string;     // ISO "2026-09-01T00:00:00.000Z"
  endDate: string;       // ISO "2026-09-30T23:59:59.999Z"
  subjectType: TargetSubjectType;
  subjectId: string;     // UID utente o ID team o 'company'
  subjectName: string;   // "Mario Rossi" | "Squadra Alfa" | "Azienda Globale"
  subjectRole?: string;  // "commerciale" | "tecnico" | etc.
  leaderId?: string;     // Se subjectType === 'team', uid del caposquadra
  leaderName?: string;   // Nome del caposquadra
  
  targetValues: Record<string, number>; // { 'vss': 15000, 'nncf': 4, 'gi': 12000 }
  status: TargetRecordStatus;
  notes?: string;
  
  edits: {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
  };
}

export interface TargetProgressMetric {
  kpiId: string;
  kpiName: string;
  acronym: string;
  isCurrency?: boolean;
  target: number;
  actual: number;
  rate: number; // Percentuale es. 85.5
  delta: number; // actual - target
  tier: TargetAchievementTier;
}

export interface TargetRecordWithProgress extends TargetRecordDocument {
  progressMetrics: TargetProgressMetric[];
  overallRate: number; // Media semplice o pesata delle %
  overallTier: TargetAchievementTier;
  canView?: boolean;
  canEdit?: boolean;
}

export interface SubmissionWindowInfo {
  isOpen: boolean;
  status: 'not_yet_open' | 'open' | 'closed';
  daysRemaining?: number;
  windowStartDate: string;
  windowEndDate: string;
  message: string;
}

export interface TargetsGlobalSettings {
  defaultPlanId?: string;
  showCompanySummaryOnTop: boolean; // default: true
}

export interface UserSubjectContext {
  uid: string;
  role: string;
  teamMemberships?: Array<{
    teamId: string;
    isLeader: boolean;
  }>;
}

export interface EvaluatedPermissions {
  canView: boolean;
  canEdit: boolean;
  relationship: 'owner' | 'team_leader' | 'team_member' | 'manager' | 'external';
}
