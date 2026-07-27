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
  order?: number;
  isSystem?: boolean;
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
    canAssignToOthers: ['superadmin', 'amministrazione'],
    order: 1,
    isSystem: true
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
    canAssignToOthers: ['superadmin', 'amministrazione'],
    order: 2,
    isSystem: true
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
    canAssignToOthers: ['superadmin', 'amministrazione'],
    order: 3,
    isSystem: true
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
    canAssignToOthers: ['superadmin', 'amministrazione'],
    order: 4,
    isSystem: true
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
    canAssignToOthers: ['superadmin', 'amministrazione'],
    order: 5,
    isSystem: true
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
    canAssignToOthers: ['superadmin', 'amministrazione'],
    order: 6,
    isSystem: true
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

  static async saveActivityType(typeToSave: ActivityType): Promise<void> {
    const types = await this.getActivityTypes();
    const existingIndex = types.findIndex(t => t.id === typeToSave.id);
    if (existingIndex >= 0) {
      types[existingIndex] = typeToSave;
    } else {
      types.push(typeToSave);
    }
    await this.saveActivityTypes(types);
  }

  static async deleteActivityType(id: string): Promise<void> {
    const types = await this.getActivityTypes();
    const updated = types.filter(t => t.id !== id);
    await this.saveActivityTypes(updated);
  }

  static async resetDefaults(): Promise<void> {
    await this.saveActivityTypes(DEFAULT_ACTIVITY_TYPES);
  }

  static canAssignToOthers(userRole: string | null | undefined, type?: ActivityType | null): boolean {
    if (!userRole) return false;
    if (userRole === 'superadmin') return true;
    if (type && Array.isArray(type.canAssignToOthers)) {
      return type.canAssignToOthers.includes(userRole);
    }
    return ['superadmin', 'amministrazione', 'direzione'].includes(userRole);
  }

  static canRoleAssignToOthers(type: ActivityType, userRole: string): boolean {
    return this.canAssignToOthers(userRole, type);
  }
}
