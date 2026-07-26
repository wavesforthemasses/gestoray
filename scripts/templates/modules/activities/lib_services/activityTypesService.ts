import { db, doc, getDoc, setDoc } from '$lib/firebase';

export interface ActivityType {
  id: string;
  name: string;
  code: string;
  icon: string;
  isSchedulable: boolean;
  defaultPriority: 'bassa' | 'media' | 'alta' | 'urgente';
  defaultStatus: 'da_fare' | 'in_corso' | 'completata';
  rolesInsert: string[];
  canAssignToOthers: string[];
}

export const DEFAULT_ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'phone',
    name: 'Telefonata',
    code: 'TEL',
    icon: 'Phone',
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione']
  },
  {
    id: 'visit',
    name: 'Visita / Incontro',
    code: 'VIS',
    icon: 'Users',
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico'],
    canAssignToOthers: ['superadmin', 'amministrazione']
  },
  {
    id: 'email',
    name: 'Email / Comunicazione',
    code: 'EML',
    icon: 'Mail',
    isSchedulable: false,
    defaultPriority: 'bassa',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale'],
    canAssignToOthers: ['superadmin', 'amministrazione']
  },
  {
    id: 'quote',
    name: 'Invio Preventivo',
    code: 'PREV',
    icon: 'FileText',
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale'],
    canAssignToOthers: ['superadmin', 'amministrazione']
  },
  {
    id: 'support',
    name: 'Intervento / Assistenza',
    code: 'AST',
    icon: 'Wrench',
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'in_corso',
    rolesInsert: ['superadmin', 'amministrazione', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione']
  },
  {
    id: 'note',
    name: 'Nota / Promemoria',
    code: 'NOTE',
    icon: 'MessageSquare',
    isSchedulable: true,
    defaultPriority: 'bassa',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione']
  }
];

export class ActivityTypesService {
  private static SETTINGS_DOC = 'settings/activity_types';

  static async getActivityTypes(): Promise<ActivityType[]> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'activity_types'));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.types) && data.types.length > 0) {
          return data.types as ActivityType[];
        }
      }
    } catch (e) {
      console.warn('Errore lettura tipi attività da Firestore, uso default:', e);
    }
    return DEFAULT_ACTIVITY_TYPES;
  }

  static async saveActivityTypes(types: ActivityType[]): Promise<void> {
    await setDoc(doc(db, 'settings', 'activity_types'), { types }, { merge: true });
  }

  static canRoleCreateType(type: ActivityType, userRole: string): boolean {
    if (!userRole) return false;
    if (userRole === 'superadmin') return true;
    return Array.isArray(type.rolesInsert) && type.rolesInsert.includes(userRole);
  }

  static canRoleAssignToOthers(type: ActivityType, userRole: string): boolean {
    if (!userRole) return false;
    if (userRole === 'superadmin') return true;
    return Array.isArray(type.canAssignToOthers) && type.canAssignToOthers.includes(userRole);
  }
}
