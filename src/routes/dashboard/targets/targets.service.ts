import { db, collection, doc, getDoc, getDocs, setDoc, query, where } from '$lib/firebase';
import type { 
  TargetGranularity, 
  TargetSubjectType, 
  TargetPlanDefinition, 
  TargetRecordDocument, 
  TargetRecordWithProgress, 
  TargetProgressMetric, 
  TargetAchievementTier, 
  SubmissionWindowConfig, 
  SubmissionWindowInfo,
  UserSubjectContext,
  EvaluatedPermissions
} from './schema';
import { formatDate } from '$lib/utils/formatters';

export interface PeriodInfo {
  key: string;       // e.g. "2026-09"
  label: string;     // e.g. "Settembre 2026"
  startDate: string; // ISO
  endDate: string;   // ISO
  granularity: TargetGranularity;
}

export class TargetsService {
  /**
   * Generates standard ISO period boundaries and formatted keys based on granularity
   */
  static generatePeriodInfo(granularity: TargetGranularity, referenceDate: Date = new Date()): PeriodInfo {
    const d = new Date(referenceDate);

    if (granularity === 'settimanale') {
      const day = d.getDay();
      const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d.setDate(diffToMon));
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      // ISO week number calculation
      const tempDate = new Date(start.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

      const year = start.getFullYear();
      const weekStr = String(weekNumber).padStart(2, '0');
      const startFormatted = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
      const endFormatted = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`;

      return {
        key: `${year}-W${weekStr}`,
        label: `Settimana ${weekNumber} (${startFormatted} - ${endFormatted})`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        granularity
      };
    }

    if (granularity === 'annuale') {
      const year = d.getFullYear();
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

      return {
        key: `${year}`,
        label: `Anno ${year}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        granularity
      };
    }

    // Default: 'mensile'
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const monthNames = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    const monthStr = String(month + 1).padStart(2, '0');

    return {
      key: `${year}-${monthStr}`,
      label: `${monthNames[month]} ${year}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      granularity: 'mensile'
    };
  }

  /**
   * Helper to navigate previous / next period seamlessly
   */
  static getAdjacentPeriod(granularity: TargetGranularity, currentStartDate: string, offset: number): PeriodInfo {
    const d = new Date(currentStartDate);
    if (granularity === 'settimanale') {
      d.setDate(d.getDate() + (offset * 7));
    } else if (granularity === 'annuale') {
      d.setFullYear(d.getFullYear() + offset);
    } else {
      d.setMonth(d.getMonth() + offset);
    }
    return this.generatePeriodInfo(granularity, d);
  }

  /**
   * Pure evaluation of Submission Window status and message
   */
  static calculateSubmissionWindow(
    config: SubmissionWindowConfig,
    periodStartDate: string,
    now: Date = new Date()
  ): SubmissionWindowInfo {
    if (!config || !config.enabled) {
      return {
        isOpen: true,
        status: 'open',
        windowStartDate: '',
        windowEndDate: '',
        message: 'Finestra di compilazione sempre aperta'
      };
    }

    const pStart = new Date(periodStartDate);
    const windowStart = new Date(pStart);
    windowStart.setDate(pStart.getDate() - config.daysBeforePeriodStart);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(pStart);
    windowEnd.setDate(pStart.getDate() + config.daysAfterPeriodStart);
    windowEnd.setHours(23, 59, 59, 999);

    const nowTime = now.getTime();
    const startTime = windowStart.getTime();
    const endTime = windowEnd.getTime();

    if (nowTime < startTime) {
      const daysUntil = Math.ceil((startTime - nowTime) / (1000 * 60 * 60 * 24));
      return {
        isOpen: false,
        status: 'not_yet_open',
        windowStartDate: windowStart.toISOString(),
        windowEndDate: windowEnd.toISOString(),
        daysRemaining: daysUntil,
        message: `Finestra non ancora aperta (apre il ${windowStart.toLocaleDateString('it-IT')} - tra ${daysUntil} gg)`
      };
    }

    if (nowTime > endTime) {
      return {
        isOpen: false,
        status: 'closed',
        windowStartDate: windowStart.toISOString(),
        windowEndDate: windowEnd.toISOString(),
        message: `Finestra di compilazione chiusa il ${windowEnd.toLocaleDateString('it-IT')}`
      };
    }

    const daysLeft = Math.ceil((endTime - nowTime) / (1000 * 60 * 60 * 24));
    return {
      isOpen: true,
      status: 'open',
      windowStartDate: windowStart.toISOString(),
      windowEndDate: windowEnd.toISOString(),
      daysRemaining: daysLeft,
      message: `Finestra aperta (scade il ${windowEnd.getDate()}/${windowEnd.getMonth() + 1} - ancora ${daysLeft} gg)`
    };
  }

  /**
   * Pure authorization function evaluating permissions (canView, canEdit) based on Subject Relationship & Role Matrix
   */
  static evaluateTargetPermissions(
    plan: TargetPlanDefinition,
    subjectId: string,
    subjectType: TargetSubjectType,
    userContext: UserSubjectContext,
    windowIsOpen: boolean = true
  ): EvaluatedPermissions {
    const isSuperadmin = userContext.role === 'superadmin';
    const isDirezione = ['superadmin', 'direzione', 'amministrazione'].includes(userContext.role);

    // Fallback default permissions if not explicitly stored
    const perms = plan.permissions || {
      userSelfView: true,
      userSelfEdit: plan.compilationMode === 'self_submission',
      userOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
      userOthersEditRoles: ['superadmin', 'direzione'],
      teamMembersView: true,
      teamMembersEdit: false,
      teamLeaderView: true,
      teamLeaderEdit: true,
      teamOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
      teamOthersEditRoles: ['superadmin', 'direzione'],
      companyViewRoles: ['superadmin', 'direzione', 'amministrazione', 'commerciale', 'tecnico'],
      companyEditRoles: ['superadmin', 'direzione']
    };

    if (isSuperadmin) {
      return { canView: true, canEdit: true, relationship: 'manager' };
    }

    // 1. Single User Subject
    if (subjectType === 'user') {
      const isOwner = subjectId === userContext.uid;
      if (isOwner) {
        const canView = perms.userSelfView ?? true;
        const canEdit = (perms.userSelfEdit ?? (plan.compilationMode === 'self_submission')) && (windowIsOpen || isDirezione);
        return { canView, canEdit, relationship: 'owner' };
      }
      const canView = (perms.userOthersViewRoles || ['superadmin', 'direzione', 'amministrazione']).includes(userContext.role);
      const canEdit = (perms.userOthersEditRoles || ['superadmin', 'direzione']).includes(userContext.role);
      return { canView, canEdit, relationship: canEdit ? 'manager' : 'external' };
    }

    // 2. Team Subject
    if (subjectType === 'team') {
      const membership = userContext.teamMemberships?.find(m => m.teamId === subjectId);
      if (membership) {
        if (membership.isLeader) {
          const canView = perms.teamLeaderView ?? true;
          const canEdit = (perms.teamLeaderEdit ?? true) && (windowIsOpen || isDirezione);
          return { canView, canEdit, relationship: 'team_leader' };
        }
        const canView = perms.teamMembersView ?? true;
        const canEdit = (perms.teamMembersEdit ?? false) && (windowIsOpen || isDirezione);
        return { canView, canEdit, relationship: 'team_member' };
      }
      const canView = (perms.teamOthersViewRoles || ['superadmin', 'direzione', 'amministrazione']).includes(userContext.role);
      const canEdit = (perms.teamOthersEditRoles || ['superadmin', 'direzione']).includes(userContext.role);
      return { canView, canEdit, relationship: canEdit ? 'manager' : 'external' };
    }

    // 3. Company Subject
    const canView = (perms.companyViewRoles || ['superadmin', 'direzione', 'amministrazione', 'commerciale', 'tecnico']).includes(userContext.role);
    const canEdit = (perms.companyEditRoles || ['superadmin', 'direzione']).includes(userContext.role);
    return { canView, canEdit, relationship: canEdit ? 'manager' : 'external' };
  }

  /**
   * Pure calculation of Progress, Completion Rates, Deltas, and Achievement Tiers
   */
  static calculateProgress(
    targetDoc: TargetRecordDocument,
    actuals: Record<string, number>,
    kpiMetadata: Array<{ id: string; name: string; acronym?: string; isCurrency?: boolean }> = []
  ): TargetRecordWithProgress {
    const progressMetrics: TargetProgressMetric[] = [];
    let totalRatesSum = 0;
    let countedMetrics = 0;

    const targetValues = targetDoc.targetValues || {};

    for (const [kpiId, targetVal] of Object.entries(targetValues)) {
      const target = Number(targetVal) || 0;
      const actual = Number(actuals[kpiId]) || 0;
      const delta = actual - target;

      // Rate in percentage (e.g. 100.0)
      let rate = 0;
      if (target > 0) {
        rate = Math.round((actual / target) * 1000) / 10;
      } else if (actual > 0) {
        rate = 100;
      }

      let tier: TargetAchievementTier = 'below_50';
      if (rate >= 100) {
        tier = 'over_100';
      } else if (rate >= 80) {
        tier = 'between_80_100';
      } else if (rate >= 50) {
        tier = 'between_50_80';
      } else {
        tier = 'below_50';
      }

      const meta = kpiMetadata.find(m => m.id === kpiId);
      const isCurr = meta?.isCurrency ?? ['vss', 'total_incassato', 'gi', 'totalVenduto'].includes(kpiId);

      progressMetrics.push({
        kpiId,
        kpiName: meta?.name || kpiId,
        acronym: meta?.acronym || kpiId.slice(0, 3).toUpperCase(),
        isCurrency: isCurr,
        target,
        actual,
        rate,
        delta,
        tier
      });

      if (target > 0) {
        totalRatesSum += rate;
        countedMetrics++;
      }
    }

    const overallRate = countedMetrics > 0 ? Math.round((totalRatesSum / countedMetrics) * 10) / 10 : 0;
    let overallTier: TargetAchievementTier = 'below_50';
    if (overallRate >= 100) {
      overallTier = 'over_100';
    } else if (overallRate >= 80) {
      overallTier = 'between_80_100';
    } else if (overallRate >= 50) {
      overallTier = 'between_50_80';
    }

    return {
      ...targetDoc,
      progressMetrics,
      overallRate,
      overallTier
    };
  }

  /**
   * Deterministic ID generation for target records: O(1) read/write
   */
  static getTargetRecordId(planId: string, subjectType: string, subjectId: string, periodKey: string): string {
    return `${planId}_${subjectType}_${subjectId}_${periodKey}`;
  }

  /**
   * Saves or updates a target record in Firestore
   */
  static async saveTargetRecord(
    record: Partial<TargetRecordDocument>,
    actor: { uid: string; name: string }
  ): Promise<string> {
    if (!record.planId || !record.subjectId || !record.periodKey) {
      throw new Error('Parametri record target mancanti (planId, subjectId o periodKey)');
    }

    const id = record.id || this.getTargetRecordId(
      record.planId,
      record.subjectType || 'user',
      record.subjectId,
      record.periodKey
    );

    const now = new Date().toISOString();
    const docRef = doc(db, 'targets_records', id);
    const existingSnap = await getDoc(docRef);

    const payload: TargetRecordDocument = {
      id,
      planId: record.planId,
      planName: record.planName || 'Piano Target',
      granularity: record.granularity || 'mensile',
      periodKey: record.periodKey,
      periodLabel: record.periodLabel || record.periodKey,
      startDate: record.startDate || now,
      endDate: record.endDate || now,
      subjectType: record.subjectType || 'user',
      subjectId: record.subjectId,
      subjectName: record.subjectName || 'Soggetto',
      subjectRole: record.subjectRole || '',
      leaderId: record.leaderId,
      leaderName: record.leaderName,
      targetValues: record.targetValues || {},
      status: record.status || 'approved',
      notes: record.notes || '',
      edits: {
        createdAt: existingSnap.exists() ? (existingSnap.data()?.edits?.createdAt || now) : now,
        createdBy: existingSnap.exists() ? (existingSnap.data()?.edits?.createdBy || actor.name) : actor.name,
        updatedAt: now,
        updatedBy: actor.name
      }
    };

    await setDoc(docRef, payload, { merge: true });
    return id;
  }

  /**
   * Fetches target records for a specific plan and period
   */
  static async getTargetRecords(planId: string, periodKey: string): Promise<TargetRecordDocument[]> {
    try {
      const q = query(
        collection(db, 'targets_records'),
        where('planId', '==', planId),
        where('periodKey', '==', periodKey)
      );
      const snap = await getDocs(q);
      const results: TargetRecordDocument[] = [];
      snap.forEach(d => {
        results.push(d.data() as TargetRecordDocument);
      });
      return results;
    } catch (e) {
      console.warn('Errore lettura target records:', e);
      return [];
    }
  }

  /**
   * Fast cloning of targets from previous period with optional % growth rate
   */
  static async cloneTargetsFromPreviousPeriod(
    plan: TargetPlanDefinition,
    fromPeriodKey: string,
    toPeriod: PeriodInfo,
    growthPct: number = 0,
    actor: { uid: string; name: string }
  ): Promise<number> {
    const previousRecords = await this.getTargetRecords(plan.id, fromPeriodKey);
    if (previousRecords.length === 0) return 0;

    const multiplier = 1 + (growthPct / 100);
    let clonedCount = 0;

    for (const prev of previousRecords) {
      const adjustedValues: Record<string, number> = {};
      for (const [k, v] of Object.entries(prev.targetValues || {})) {
        adjustedValues[k] = Math.round(Number(v) * multiplier);
      }

      await this.saveTargetRecord({
        planId: plan.id,
        planName: plan.name,
        granularity: plan.granularity,
        periodKey: toPeriod.key,
        periodLabel: toPeriod.label,
        startDate: toPeriod.startDate,
        endDate: toPeriod.endDate,
        subjectType: prev.subjectType,
        subjectId: prev.subjectId,
        subjectName: prev.subjectName,
        subjectRole: prev.subjectRole,
        leaderId: prev.leaderId,
        leaderName: prev.leaderName,
        targetValues: adjustedValues,
        status: 'approved',
        notes: `Clonato da ${fromPeriodKey}${growthPct ? ` (+${growthPct}%)` : ''}`
      }, actor);

      clonedCount++;
    }

    return clonedCount;
  }

  /**
   * Fetches actual KPI values for a subject from active modules
   */
  static async fetchActualsForSubject(
    subjectId: string,
    subjectRole: string,
    startDateIso: string,
    endDateIso: string,
    kpiIds: string[]
  ): Promise<Record<string, number>> {
    const actuals: Record<string, number> = {};
    for (const k of kpiIds) {
      actuals[k] = 0;
    }

    const start = new Date(startDateIso).getTime();
    const end = new Date(endDateIso).getTime();

    // 1. Contracts & VSS / GI / NNCF
    if (kpiIds.some(k => ['vss', 'nncf', 'gi', 'totalVenduto'].includes(k))) {
      try {
        const snap = await getDocs(collection(db, 'contracts'));
        snap.forEach(d => {
          const c = d.data()?.original || d.data();
          if (c.deleted || c?.derived?.deleted) return;

          // Agent filter if not 'company'
          if (subjectId !== 'company') {
            const isMyContract = c.agentId === subjectId || 
                                 c.vendorUid === subjectId || 
                                 c.original?.vendorUid === subjectId ||
                                 c.original?.secondVendorUid === subjectId;
            if (!isMyContract) return;
          }

          const cDate = new Date(c.createdAt || c.date || c.original?.createdAt || 0).getTime();
          if (cDate >= start && cDate <= end) {
            const amount = Number(c.totalAmount || c.totalPrice || c.original?.totalPrice || 0);
            if (actuals['vss'] !== undefined) actuals['vss'] += amount;
            if (actuals['totalVenduto'] !== undefined) actuals['totalVenduto'] += amount;
            
            // Già Incassato (GI) on this contract
            const paid = Number(c.totalPaid || c.paidAmount || c.original?.paidAmount || 0);
            if (actuals['gi'] !== undefined) actuals['gi'] += paid;

            if (actuals['nncf'] !== undefined && (c.isFirstOrder || c.firstOrder)) {
              actuals['nncf'] += 1;
            }
          }
        });
      } catch (e) {
        console.warn('Errore lettura contratti per target actuals:', e);
      }
    }

    // 2. Payments & GI / Total Incassato
    if (kpiIds.some(k => ['gi', 'total_incassato'].includes(k))) {
      try {
        const snap = await getDocs(collection(db, 'payments'));
        snap.forEach(d => {
          const p = d.data()?.original || d.data();
          if (p.deleted || p?.derived?.deleted) return;

          if (subjectId !== 'company') {
            const isMyPayment = p.agentId === subjectId || p.vendorUid === subjectId || p.createdBy === subjectId;
            if (!isMyPayment) return;
          }

          const pDate = new Date(p.paymentDate || p.date || p.createdAt || 0).getTime();
          if (pDate >= start && pDate <= end) {
            const amount = Number(p.netAmount ?? p.grossAmount ?? p.amount ?? 0);
            if (actuals['gi'] !== undefined && actuals['gi'] === 0) actuals['gi'] += amount;
            if (actuals['total_incassato'] !== undefined) actuals['total_incassato'] += amount;
          }
        });
      } catch (e) {
        console.warn('Errore lettura pagamenti per target actuals:', e);
      }
    }

    // 3. Activities & Completed Tasks
    if (kpiIds.some(k => ['activities', 'completed_tasks', 'attivit_aziendale'].includes(k))) {
      try {
        const snap = await getDocs(collection(db, 'activities'));
        snap.forEach(d => {
          const a = d.data()?.original || d.data();
          if (a.deleted || a?.derived?.deleted) return;

          if (subjectId !== 'company') {
            const isAssigned = a.assignedTo === subjectId || 
                               a.userId === subjectId || 
                               a.assignedEntities?.some((e: any) => e.id === subjectId);
            if (!isAssigned) return;
          }

          const aDate = new Date(a.date || a.createdAt || 0).getTime();
          if (aDate >= start && aDate <= end) {
            if (actuals['activities'] !== undefined) actuals['activities'] += 1;
            if (actuals['attivit_aziendale'] !== undefined) actuals['attivit_aziendale'] += 1;
            if (actuals['completed_tasks'] !== undefined && ['completata', 'chiusa', 'eseguita'].includes(a.status)) {
              actuals['completed_tasks'] += 1;
            }
          }
        });
      } catch (e) {
        console.warn('Errore lettura attività per target actuals:', e);
      }
    }

    return actuals;
  }
}
