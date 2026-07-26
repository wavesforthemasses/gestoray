import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from '$lib/firebase';
import { activeRoleState } from '$lib/auth.svelte';

export interface ActivityType {
  id: string;
  code: string;
  name: string;
  icon: string;
  isSchedulable: boolean;
  defaultPriority: 'bassa' | 'media' | 'alta' | 'urgente';
  defaultStatus: 'da_fare' | 'in_corso' | 'completata';
  rolesInsert: string[];
  canAssignToOthers: string[];
  isSystem?: boolean;
  order?: number;
  updatedAt?: string;
}

export const DEFAULT_ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'act_type_phone',
    code: 'telefonata',
    name: 'Telefonata Commerciale / Cliente',
    icon: 'Phone',
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    isSystem: true,
    order: 1
  },
  {
    id: 'act_type_visit',
    code: 'incontro',
    name: 'Incontro / Visita Cliente',
    icon: 'Users',
    isSchedulable: true,
    defaultPriority: 'media',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    isSystem: true,
    order: 2
  },
  {
    id: 'act_type_email',
    code: 'email',
    name: 'Email / Comunicazione Inviata',
    icon: 'Mail',
    isSchedulable: false,
    defaultPriority: 'bassa',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    isSystem: true,
    order: 3
  },
  {
    id: 'act_type_quote',
    code: 'preventivo',
    name: 'Preventivo / Offerta Inviata',
    icon: 'FileText',
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    isSystem: true,
    order: 4
  },
  {
    id: 'act_type_intervention',
    code: 'intervento',
    name: 'Intervento Tecnico / Assistenza',
    icon: 'Wrench',
    isSchedulable: true,
    defaultPriority: 'alta',
    defaultStatus: 'da_fare',
    rolesInsert: ['superadmin', 'amministrazione', 'tecnico', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    isSystem: true,
    order: 5
  },
  {
    id: 'act_type_note',
    code: 'nota',
    name: 'Nota Operativa / Informazione',
    icon: 'MessageSquare',
    isSchedulable: false,
    defaultPriority: 'bassa',
    defaultStatus: 'completata',
    rolesInsert: ['superadmin', 'amministrazione', 'commerciale', 'tecnico', 'direzione'],
    canAssignToOthers: ['superadmin', 'amministrazione', 'direzione'],
    isSystem: true,
    order: 6
  }
];

export class ActivityTypesService {
  private static COLLECTION_NAME = 'activity_types';

  /**
   * Restituisce tutti i Tipi di Attività salvati su Firestore.
   * Se la collezione è vuota, restituisce i default di sistema senza forzare salvataggi.
   */
  static async getActivityTypes(): Promise<ActivityType[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('order', 'asc')
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        return DEFAULT_ACTIVITY_TYPES;
      }
      
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityType));
    } catch (e) {
      console.warn('Impossibile caricare activity_types da Firestore, uso fallback default:', e);
      return DEFAULT_ACTIVITY_TYPES;
    }
  }

  /**
   * Salva o aggiorna un Tipo di Attività su Firestore.
   */
  static async saveActivityType(typeData: ActivityType): Promise<void> {
    const docId = typeData.id || `act_type_${Date.now()}`;
    const payload: ActivityType = {
      ...typeData,
      id: docId,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, this.COLLECTION_NAME, docId), payload, { merge: true });
  }

  /**
   * Elimina un Tipo di Attività da Firestore.
   */
  static async deleteActivityType(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }

  /**
   * Popola o ripristina le impostazioni predefinite dei tipi di attività (1-click reset).
   */
  static async resetDefaults(): Promise<ActivityType[]> {
    for (const item of DEFAULT_ACTIVITY_TYPES) {
      await setDoc(doc(db, this.COLLECTION_NAME, item.id), {
        ...item,
        updatedAt: new Date().toISOString()
      });
    }
    return DEFAULT_ACTIVITY_TYPES;
  }

  /**
   * Verifica se il ruolo fornito può riassegnare le attività ad altri utenti.
   */
  static canAssignToOthers(role: string | null | undefined, activityType?: ActivityType | null): boolean {
    const activeRole = role || activeRoleState.role || '';
    if (activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione') {
      return true;
    }
    if (activityType && Array.isArray(activityType.canAssignToOthers)) {
      return activityType.canAssignToOthers.includes(activeRole);
    }
    return false;
  }
}
