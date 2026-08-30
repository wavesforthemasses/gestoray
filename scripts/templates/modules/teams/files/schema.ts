export type TeamStatus = 'attiva' | 'inattiva' | 'in_servizio';

export type TeamEvaluationType = 'mc' | 'mq' | 'mc_plus_mq' | 'giornata' | 'oraria';
export type MemberEvaluationType = 'mc' | 'mq' | 'giornata' | 'oraria';

export interface TeamMember {
  userId: string;
  userName: string;
  userEmail?: string;
  roleInTeam?: string;       // es. "Caposquadra", "Tecnico Specializzato", "Apprendista"
  isLeader?: boolean;
  evaluationType?: MemberEvaluationType;
  hourlyRate?: number;       // Tariffa interna oraria per calcolo costi
  dailyRate?: number;        // Tariffa a giornata
  joinedAt?: string;
}

export interface TeamItem {
  id: string;
  code: string;              // SQD-2026-001
  name: string;
  leaderId?: string;
  leaderName?: string;
  vehicleId?: string;
  vehicleName?: string;
  members: TeamMember[];
  status: TeamStatus;
  notes?: string;
  evaluationType?: TeamEvaluationType;
  assignedPlaceIds?: string[]; // Cantieri abituali/assegnati
  createdAt: string;
  updatedAt?: string;
  edits?: {
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
  };
}

export type EntityNamingType = 'squadra' | 'team' | 'gruppo' | 'risorsa' | 'custom';

export interface TeamSettings {
  entityNaming: EntityNamingType;
  customSingularLabel?: string;
  customPluralLabel?: string;
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: TeamStatus;
  allowExternalParticipantsInActivities?: boolean;
}
