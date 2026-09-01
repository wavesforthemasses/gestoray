import { db, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from '$lib/firebase';
import type { TargetPlanDefinition, TargetsGlobalSettings } from './schema';

const DEFAULT_PLANS: TargetPlanDefinition[] = [
  {
    id: 'commercial_monthly',
    name: 'Target Commerciali Mensili',
    description: 'Obiettivi di stipulato (VSS), conversioni nuovi clienti (NNCF) e incassato reale (GI).',
    granularity: 'mensile',
    targetSubject: 'user',
    assignedRoles: ['commerciale'],
    kpiIds: ['vss', 'nncf', 'gi'],
    compilationMode: 'manager_only',
    submissionWindow: {
      enabled: true,
      daysBeforePeriodStart: 6,
      daysAfterPeriodStart: 2,
      allowLateEdit: false
    },
    permissions: {
      userSelfView: true,
      userSelfEdit: false,
      userOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
      userOthersEditRoles: ['superadmin', 'direzione'],
      teamMembersView: true,
      teamMembersEdit: false,
      teamLeaderView: true,
      teamLeaderEdit: true,
      teamOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
      teamOthersEditRoles: ['superadmin', 'direzione'],
      companyViewRoles: ['superadmin', 'direzione', 'amministrazione', 'commerciale'],
      companyEditRoles: ['superadmin', 'direzione']
    },
    defaultGrowthPct: 5,
    enabled: true,
    order: 1
  },
  {
    id: 'technicians_weekly_tasks',
    name: 'Target Operativi Settimanali',
    description: 'Pianificazione del volume settimanale di attività e interventi svolti da tecnici e squadre.',
    granularity: 'settimanale',
    targetSubject: 'team',
    assignedRoles: ['tecnico'],
    kpiIds: ['completed_tasks'],
    compilationMode: 'manager_only',
    submissionWindow: {
      enabled: true,
      daysBeforePeriodStart: 4,
      daysAfterPeriodStart: 1,
      allowLateEdit: false
    },
    permissions: {
      userSelfView: true,
      userSelfEdit: false,
      userOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
      userOthersEditRoles: ['superadmin', 'direzione'],
      teamMembersView: true,
      teamMembersEdit: false,
      teamLeaderView: true,
      teamLeaderEdit: true,
      teamOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
      teamOthersEditRoles: ['superadmin', 'direzione'],
      companyViewRoles: ['superadmin', 'direzione', 'amministrazione', 'tecnico'],
      companyEditRoles: ['superadmin', 'direzione']
    },
    defaultGrowthPct: 0,
    enabled: true,
    order: 2
  }
];

export class TargetsSettingsService {
  /**
   * Retrieves all configured target plans from Firestore 'targets_plans'
   * If none exist, initializes the default plans.
   */
  static async getPlans(): Promise<TargetPlanDefinition[]> {
    try {
      const snap = await getDocs(collection(db, 'targets_plans'));
      if (!snap.empty) {
        const plans: TargetPlanDefinition[] = [];
        snap.forEach(d => {
          plans.push({ id: d.id, ...(d.data() as any) });
        });
        return plans.sort((a, b) => (a.order || 0) - (b.order || 0));
      }

      // Initialize default plans
      for (const p of DEFAULT_PLANS) {
        await setDoc(doc(db, 'targets_plans', p.id), p, { merge: true });
      }
      return DEFAULT_PLANS;
    } catch (e) {
      console.warn('Lettura targets_plans da Firestore fallita, uso default in memoria:', e);
      return DEFAULT_PLANS;
    }
  }

  static async savePlan(plan: TargetPlanDefinition): Promise<void> {
    const id = plan.id || `plan_${Date.now()}`;
    const cleanPlan: TargetPlanDefinition = {
      ...plan,
      id
    };
    await setDoc(doc(db, 'targets_plans', id), cleanPlan, { merge: true });
  }

  static async deletePlan(planId: string): Promise<void> {
    await deleteDoc(doc(db, 'targets_plans', planId));
  }

  static async getGlobalSettings(): Promise<TargetsGlobalSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'targets'));
      if (snap.exists()) {
        return snap.data() as TargetsGlobalSettings;
      }
    } catch (e) {
      console.warn('Lettura settings/targets fallita:', e);
    }
    return {
      showCompanySummaryOnTop: true
    };
  }

  static async saveGlobalSettings(settings: TargetsGlobalSettings): Promise<void> {
    await setDoc(doc(db, 'settings', 'targets'), settings, { merge: true });
  }
}
