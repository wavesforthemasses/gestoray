export type TeamStatus = 'attiva' | 'inattiva' | 'in_servizio';

export type TeamEvaluationType = 'mc' | 'mq' | 'mc_plus_mq' | 'giornata';
export type MemberEvaluationType = 'mc' | 'mq' | 'giornata';

export interface TeamMember {
  userId: string;
  userName: string;
  roleInTeam?: string;
  isLeader?: boolean;
  evaluationType?: MemberEvaluationType;
}

export interface TeamItem {
  id: string;
  code: string;
  name: string;
  leaderId?: string;
  leaderName?: string;
  vehicleId?: string;
  vehicleName?: string;
  members: TeamMember[];
  status: TeamStatus;
  notes?: string;
  evaluationType?: TeamEvaluationType;
  createdAt: string;
  updatedAt?: string;
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
}
