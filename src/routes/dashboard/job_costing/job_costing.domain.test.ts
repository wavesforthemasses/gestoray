import { describe, it, expect } from 'vitest';
import { JobCostingService } from './jobCosting.service';
import { JobCostingKPIBridge } from './jobCosting.kpi.bridge';
import type { JobBudgetBreakdown, JobActualsBreakdown, JobRevenuesBreakdown, JobCostingProject } from './schema';

describe('Job Costing & Controllo di Gestione Domain Engine', () => {
  const mockBudget: JobBudgetBreakdown = {
    labor: 5000,
    materials: 4000,
    equipment: 1000,
    subcontractor: 2000,
    other: 500,
    total: 12500
  };

  it('T1: computes gross margin and healthy status on profitable project within budget', () => {
    const actuals: JobActualsBreakdown = {
      labor: 4200,
      materials: 3500,
      equipment: 800,
      subcontractor: 1500,
      other: 300,
      total: 10300,
      laborHoursTotal: 140,
      materialsCountTotal: 45
    };

    const revenues: JobRevenuesBreakdown = {
      contractValue: 18000,
      invoicedTotal: 10000,
      paidTotal: 5000
    };

    const metrics = JobCostingService.calculateProfitability(mockBudget, actuals, revenues, {
      warningMarginThresholdPercent: 20,
      criticalMarginThresholdPercent: 10
    });

    // Total actuals = 10,300
    // Expected Revenue = 18,000
    // Gross Margin = 18,000 - 10,300 = 7,700
    // Margin % = (7,700 / 18,000) * 100 = 42.78%
    expect(metrics.grossMarginAmount).toBe(7700);
    expect(metrics.grossMarginPercent).toBe(42.78);
    expect(metrics.isLossMaking).toBe(false);
    expect(metrics.isOverBudget).toBe(false);
    expect(metrics.budgetVarianceAmount).toBe(-2200); // 10,300 - 12,500 = -2,200 (under budget)
    expect(metrics.healthStatus).toBe('healthy');
  });

  it('T2: flags critical status when project exceeds budget (over-budget)', () => {
    const actuals: JobActualsBreakdown = {
      labor: 6500,
      materials: 5000,
      equipment: 1200,
      subcontractor: 2500,
      other: 600,
      total: 15800,
      laborHoursTotal: 210,
      materialsCountTotal: 60
    };

    const revenues: JobRevenuesBreakdown = {
      contractValue: 17000,
      invoicedTotal: 8000,
      paidTotal: 4000
    };

    const metrics = JobCostingService.calculateProfitability(mockBudget, actuals, revenues);

    // Total costs = 15,800 vs Budget 12,500 (+3,300 over budget)
    expect(metrics.budgetVarianceAmount).toBe(3300);
    expect(metrics.isOverBudget).toBe(true);
    expect(metrics.healthStatus).toBe('critical');
  });

  it('T3: detects loss-making project (negative margin) accurately', () => {
    const actuals: JobActualsBreakdown = {
      labor: 7000,
      materials: 6000,
      equipment: 2000,
      subcontractor: 3000,
      other: 1000,
      total: 19000,
      laborHoursTotal: 240,
      materialsCountTotal: 80
    };

    const revenues: JobRevenuesBreakdown = {
      contractValue: 15000,
      invoicedTotal: 5000,
      paidTotal: 5000
    };

    const metrics = JobCostingService.calculateProfitability(mockBudget, actuals, revenues);

    // Revenue 15,000 - Costs 19,000 = -4,000
    expect(metrics.grossMarginAmount).toBe(-4000);
    expect(metrics.isLossMaking).toBe(true);
    expect(metrics.healthStatus).toBe('critical');
  });

  it('T4: aggregates global KPIs across multiple projects via JobCostingKPIBridge', () => {
    const p1: Partial<JobCostingProject> = {
      id: 'p1',
      status: 'in_corso',
      revenues: { contractValue: 20000, invoicedTotal: 10000, paidTotal: 5000 },
      actuals: { labor: 5000, materials: 5000, equipment: 1000, subcontractor: 0, other: 0, total: 11000, laborHoursTotal: 150, materialsCountTotal: 20 },
      profitability: { grossMarginAmount: 9000, grossMarginPercent: 45, realizedMarginAmount: -6000, budgetVarianceAmount: -2000, budgetVariancePercent: -10, isOverBudget: false, isLossMaking: false, healthStatus: 'healthy' }
    };

    const p2: Partial<JobCostingProject> = {
      id: 'p2',
      status: 'in_corso',
      revenues: { contractValue: 10000, invoicedTotal: 10000, paidTotal: 10000 },
      actuals: { labor: 6000, materials: 4000, equipment: 1000, subcontractor: 1000, other: 0, total: 12000, laborHoursTotal: 180, materialsCountTotal: 30 },
      profitability: { grossMarginAmount: -2000, grossMarginPercent: -20, realizedMarginAmount: -2000, budgetVarianceAmount: 2000, budgetVariancePercent: 20, isOverBudget: true, isLossMaking: true, healthStatus: 'critical' }
    };

    const kpis = JobCostingKPIBridge.calculateKPIs([p1, p2]);

    expect(kpis.valore_totale_commesse).toBe(30000);
    expect(kpis.costi_totali_consuntivati).toBe(23000);
    expect(kpis.margine_lordo_totale).toBe(7000);
    expect(kpis.margine_medio_percent).toBe(23.3); // (7,000 / 30,000) * 100
    expect(kpis.commesse_in_allerta).toBe(1);
    expect(kpis.commesse_in_perdita).toBe(1);
    expect(kpis.commesse_attive_count).toBe(2);
  });

  it('T5: gracefully handles zero revenues and empty values without crash or NaN', () => {
    const emptyActuals: JobActualsBreakdown = {
      labor: 0, materials: 0, equipment: 0, subcontractor: 0, other: 0, total: 0, laborHoursTotal: 0, materialsCountTotal: 0
    };
    const emptyRevenues: JobRevenuesBreakdown = {
      contractValue: 0, invoicedTotal: 0, paidTotal: 0
    };

    const metrics = JobCostingService.calculateProfitability(mockBudget, emptyActuals, emptyRevenues);

    expect(metrics.grossMarginAmount).toBe(0);
    expect(metrics.grossMarginPercent).toBe(0);
    expect(Number.isNaN(metrics.grossMarginPercent)).toBe(false);
    expect(metrics.isLossMaking).toBe(false);
  });
});
