import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { ActivityType, ActivityTargetType, ActivityStatus } from '../../routes/dashboard/activities/schema';

export type { ActivityType, ActivityTargetType, ActivityStatus };

export const DEFAULT_ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'phone',
    name: 'Telefonata',
    code: 'TEL',
    icon: 'Phone',
    category: 'crm',
    allowedTargets: ['contact', 'client', 'user'],
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 1,
    isSystem: true
  },
  {
    id: 'visit',
    name: 'Incontro / Appuntamento',
    code: 'VIS',
    icon: 'Users',
    category: 'crm',
    allowedTargets: ['contact', 'client'],
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 2,
    isSystem: true
  },
  {
    id: 'email',
    name: 'Email / Comunicazione',
    code: 'EML',
    icon: 'Mail',
    category: 'crm',
    allowedTargets: ['contact', 'client'],
    isSchedulable: false,
    defaultPriority: 'bassa',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 3,
    isSystem: true
  },
  {
    id: 'quote_followup',
    name: 'Follow-up Preventivo / Offerta',
    code: 'PREV',
    icon: 'FileText',
    category: 'crm',
    allowedTargets: ['contract', 'client', 'contact'],
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'da_fare',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 4,
    isSystem: true
  },
  {
    id: 'internal_meeting',
    name: 'Riunione Interna / One-to-One',
    code: 'RIU',
    icon: 'Briefcase',
    category: 'internal',
    allowedTargets: ['user'],
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'da_fare',
    rolesInsert: ['superadmin', 'amministrazione', 'direzione', 'commerciale', 'tecnico'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 5,
    isSystem: true
  },
  {
    id: 'training_medical',
    name: 'Corso Formazione / Visita Medica',
    code: 'FOR',
    icon: 'ShieldCheck',
    category: 'internal',
    allowedTargets: ['user'],
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'da_fare',
    rolesInsert: ['superadmin', 'amministrazione', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 6,
    isSystem: true
  },
  {
    id: 'survey_inspection',
    name: 'Sopralluogo / Ispezione Impianto',
    code: 'SOP',
    icon: 'MapPin',
    category: 'operational',
    allowedTargets: ['place', 'client'],
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'da_fare',
    rolesInsert: ['superadmin', 'amministrazione', 'tecnico'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 7,
    isSystem: true
  },
  {
    id: 'vehicle_service',
    name: 'Revisione / Tagliando Mezzo',
    code: 'MEZ',
    icon: 'Truck',
    category: 'maintenance',
    allowedTargets: ['vehicle'],
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'da_fare',
    rolesInsert: ['superadmin', 'amministrazione', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 8,
    isSystem: true
  },
  {
    id: 'support',
    name: 'Intervento / Assistenza',
    code: 'AST',
    icon: 'Wrench',
    category: 'operational',
    allowedTargets: ['place', 'client', 'ticket'],
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'in_corso',
    rolesInsert: ['superadmin', 'amministrazione', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 9,
    isSystem: true
  },
  {
    id: 'note',
    name: 'Nota / Promemoria',
    code: 'NOTE',
    icon: 'MessageSquare',
    category: 'crm',
    allowedTargets: ['contact', 'client', 'user', 'place', 'vehicle', 'contract', 'ticket'],
    isSchedulable: true,
    defaultPriority: 'bassa',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'operaio'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    order: 10,
    isSystem: true
  }
];

export class ActivityTypesService {
  private static SETTINGS_DOC = 'settings/activity_types';

  static async getActivityTypes(): Promise<ActivityType[]> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'activity_types'));
      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.types) && data.types.length > 0) {
          // Normalize existing types to ensure allowedTargets is defined
          return data.types.map((t: any) => ({
            ...t,
            allowedTargets: Array.isArray(t.allowedTargets) && t.allowedTargets.length > 0
              ? t.allowedTargets
              : ['contact', 'client', 'user', 'place', 'vehicle', 'contract', 'ticket']
          })) as ActivityType[];
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
