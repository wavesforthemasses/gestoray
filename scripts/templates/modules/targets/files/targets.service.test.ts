import { describe, it, expect } from 'vitest';
import { TargetsService } from './targets.service';
import type { 
  SubmissionWindowConfig, 
  TargetRecordDocument, 
  TargetPlanDefinition,
  UserSubjectContext 
} from './schema';

describe('TargetsService - Domain Logic, SSOT & Permissions Matrix', () => {
  describe('Period Generation Engine', () => {
    it('should generate accurate monthly period keys and bounds', () => {
      const date = new Date('2026-09-15T12:00:00.000Z');
      const period = TargetsService.generatePeriodInfo('mensile', date);

      expect(period.key).toBe('2026-09');
      expect(period.label).toBe('Settembre 2026');
      expect(period.granularity).toBe('mensile');
      expect(period.startDate.startsWith('2026-09-01')).toBe(true);
      expect(period.endDate.startsWith('2026-09-30')).toBe(true);
    });

    it('should generate accurate annual period keys and bounds', () => {
      const date = new Date('2026-05-20T12:00:00.000Z');
      const period = TargetsService.generatePeriodInfo('annuale', date);

      expect(period.key).toBe('2026');
      expect(period.label).toBe('Anno 2026');
      expect(period.granularity).toBe('annuale');
      expect(period.startDate.startsWith('2026-01-01')).toBe(true);
      expect(period.endDate.startsWith('2026-12-31')).toBe(true);
    });

    it('should navigate adjacent periods correctly (monthly +/- 1)', () => {
      const prev = TargetsService.getAdjacentPeriod('mensile', '2026-09-01T00:00:00.000Z', -1);
      expect(prev.key).toBe('2026-08');
      expect(prev.label).toBe('Agosto 2026');

      const next = TargetsService.getAdjacentPeriod('mensile', '2026-09-01T00:00:00.000Z', 1);
      expect(next.key).toBe('2026-10');
      expect(next.label).toBe('Ottobre 2026');
    });
  });

  describe('Submission Window Calculation', () => {
    const config: SubmissionWindowConfig = {
      enabled: true,
      daysBeforePeriodStart: 6,
      daysAfterPeriodStart: 2,
      allowLateEdit: false
    };
    const periodStart = '2026-09-01T00:00:00.000Z';

    it('should mark window as not_yet_open when before opening date', () => {
      const now = new Date('2026-08-20T12:00:00.000Z');
      const result = TargetsService.calculateSubmissionWindow(config, periodStart, now);

      expect(result.isOpen).toBe(false);
      expect(result.status).toBe('not_yet_open');
      expect(result.message).toContain('Finestra non ancora aperta');
    });

    it('should mark window as open when within range pre-start', () => {
      const now = new Date('2026-08-28T12:00:00.000Z');
      const result = TargetsService.calculateSubmissionWindow(config, periodStart, now);

      expect(result.isOpen).toBe(true);
      expect(result.status).toBe('open');
      expect(result.message).toContain('Finestra aperta');
    });

    it('should mark window as open when 1 day after start', () => {
      const now = new Date('2026-09-02T12:00:00.000Z');
      const result = TargetsService.calculateSubmissionWindow(config, periodStart, now);

      expect(result.isOpen).toBe(true);
      expect(result.status).toBe('open');
    });

    it('should mark window as closed when past grace period', () => {
      const now = new Date('2026-09-10T12:00:00.000Z');
      const result = TargetsService.calculateSubmissionWindow(config, periodStart, now);

      expect(result.isOpen).toBe(false);
      expect(result.status).toBe('closed');
      expect(result.message).toContain('Finestra di compilazione chiusa');
    });
  });

  describe('Subject-Relationship Permissions Matrix (evaluateTargetPermissions)', () => {
    const mockPlan: TargetPlanDefinition = {
      id: 'plan_1',
      name: 'Piano Commerciale',
      description: 'Test',
      granularity: 'mensile',
      targetSubject: 'user',
      assignedRoles: ['commerciale'],
      kpiIds: ['vss', 'nncf', 'gi'],
      compilationMode: 'self_submission',
      submissionWindow: { enabled: true, daysBeforePeriodStart: 6, daysAfterPeriodStart: 2, allowLateEdit: false },
      permissions: {
        userSelfView: true,
        userSelfEdit: true,
        userOthersViewRoles: ['superadmin', 'direzione', 'amministrazione'],
        userOthersEditRoles: ['superadmin', 'direzione'],
        teamMembersView: true,
        teamMembersEdit: false,
        teamLeaderView: true,
        teamLeaderEdit: true,
        teamOthersViewRoles: ['superadmin', 'direzione'],
        teamOthersEditRoles: ['superadmin', 'direzione'],
        companyViewRoles: ['superadmin', 'direzione', 'amministrazione', 'commerciale'],
        companyEditRoles: ['superadmin', 'direzione']
      },
      enabled: true,
      order: 1
    };

    it('should allow owner to view and edit self target when window is open', () => {
      const userCtx: UserSubjectContext = { uid: 'user_123', role: 'commerciale' };
      const perm = TargetsService.evaluateTargetPermissions(mockPlan, 'user_123', 'user', userCtx, true);

      expect(perm.relationship).toBe('owner');
      expect(perm.canView).toBe(true);
      expect(perm.canEdit).toBe(true);
    });

    it('should prevent non-manager collaborator from viewing another user target', () => {
      const userCtx: UserSubjectContext = { uid: 'user_999', role: 'commerciale' };
      const perm = TargetsService.evaluateTargetPermissions(mockPlan, 'user_123', 'user', userCtx, true);

      expect(perm.canView).toBe(false);
      expect(perm.canEdit).toBe(false);
      expect(perm.relationship).toBe('external');
    });

    it('should allow manager (direzione) to view and edit any user target even if window closed', () => {
      const userCtx: UserSubjectContext = { uid: 'dir_1', role: 'direzione' };
      const perm = TargetsService.evaluateTargetPermissions(mockPlan, 'user_123', 'user', userCtx, false);

      expect(perm.canView).toBe(true);
      expect(perm.canEdit).toBe(true);
      expect(perm.relationship).toBe('manager');
    });

    it('should handle team leader permissions (canView: true, canEdit: true)', () => {
      const teamPlan: TargetPlanDefinition = { ...mockPlan, targetSubject: 'team' };
      const userCtx: UserSubjectContext = {
        uid: 'leader_1',
        role: 'tecnico',
        teamMemberships: [{ teamId: 'sqd_alfa', isLeader: true }]
      };
      const perm = TargetsService.evaluateTargetPermissions(teamPlan, 'sqd_alfa', 'team', userCtx, true);

      expect(perm.relationship).toBe('team_leader');
      expect(perm.canView).toBe(true);
      expect(perm.canEdit).toBe(true);
    });

    it('should handle team member permissions (canView: true, canEdit: false)', () => {
      const teamPlan: TargetPlanDefinition = { ...mockPlan, targetSubject: 'team' };
      const userCtx: UserSubjectContext = {
        uid: 'member_2',
        role: 'tecnico',
        teamMemberships: [{ teamId: 'sqd_alfa', isLeader: false }]
      };
      const perm = TargetsService.evaluateTargetPermissions(teamPlan, 'sqd_alfa', 'team', userCtx, true);

      expect(perm.relationship).toBe('team_member');
      expect(perm.canView).toBe(true);
      expect(perm.canEdit).toBe(false);
    });
  });

  describe('Progress Calculation & Achievement Tiers', () => {
    const sampleDoc: TargetRecordDocument = {
      id: 'plan1_user_u1_2026-09',
      planId: 'plan1',
      planName: 'Target Mensile',
      granularity: 'mensile',
      periodKey: '2026-09',
      periodLabel: 'Settembre 2026',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-30T23:59:59.999Z',
      subjectType: 'user',
      subjectId: 'u1',
      subjectName: 'Mario Rossi',
      targetValues: {
        vss: 10000,
        nncf: 4,
        gi: 8000
      },
      status: 'approved',
      edits: {
        createdAt: '2026-09-01T00:00:00.000Z',
        createdBy: 'Admin',
        updatedAt: '2026-09-01T00:00:00.000Z',
        updatedBy: 'Admin'
      }
    };

    it('should compute progress, deltas, and tiers correctly', () => {
      const actuals = {
        vss: 12000, // 120% -> over_100
        nncf: 3,    // 75%  -> between_50_80
        gi: 7000    // 87.5% -> between_80_100
      };

      const result = TargetsService.calculateProgress(sampleDoc, actuals, [
        { id: 'vss', name: 'Valore Venduto', acronym: 'VSS', isCurrency: true },
        { id: 'nncf', name: 'Nuovi Clienti', acronym: 'NNCF', isCurrency: false },
        { id: 'gi', name: 'Già Incassato', acronym: 'GI', isCurrency: true }
      ]);

      expect(result.progressMetrics).toHaveLength(3);

      const vss = result.progressMetrics.find(m => m.kpiId === 'vss')!;
      expect(vss.rate).toBe(120);
      expect(vss.delta).toBe(2000);
      expect(vss.tier).toBe('over_100');

      const nncf = result.progressMetrics.find(m => m.kpiId === 'nncf')!;
      expect(nncf.rate).toBe(75);
      expect(nncf.delta).toBe(-1);
      expect(nncf.tier).toBe('between_50_80');

      const gi = result.progressMetrics.find(m => m.kpiId === 'gi')!;
      expect(gi.rate).toBe(87.5);
      expect(gi.delta).toBe(-1000);
      expect(gi.tier).toBe('between_80_100');

      expect(result.overallRate).toBe(94.2);
      expect(result.overallTier).toBe('between_80_100');
    });

    it('should handle zero target safely without crashing or NaN', () => {
      const docWithZero: TargetRecordDocument = {
        ...sampleDoc,
        targetValues: { vss: 0 }
      };
      const result = TargetsService.calculateProgress(docWithZero, { vss: 500 });
      expect(result.progressMetrics[0].rate).toBe(100);
      expect(result.progressMetrics[0].tier).toBe('over_100');
    });
  });
});
