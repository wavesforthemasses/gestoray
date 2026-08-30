import { describe, it, expect } from 'vitest';
import { SchedulingKPIBridge } from './scheduling.kpi.bridge';

describe('SchedulingKPIBridge Unit Tests', () => {
  it('calculateKPIs should count active interventions and activities correctly', () => {
    const mockInterventions = [
      { id: 'int_1', status: 'pianificato' },
      { id: 'int_2', status: 'in_corso' },
      { id: 'int_3', status: 'completato' },
      { id: 'int_4', status: 'annullato' },
      { id: 'int_5', status: 'pianificato', derived: { deleted: true } }
    ];

    const mockActivities = [
      { id: 'act_1', status: 'pianificato' },
      { id: 'act_2', status: 'in_corso' },
      { id: 'act_3', status: 'completata' },
      { id: 'act_4', status: 'da_fare' }
    ];

    const kpis = SchedulingKPIBridge.calculateKPIs(mockInterventions, mockActivities);

    expect(kpis.activeInterventions).toBe(2);
    expect(kpis.activeActivities).toBe(2);
    expect(kpis.activeSchedulingCount).toBe(4);
    expect(kpis.active_scheduling).toBe(4);
  });

  it('calculateKPIs handles empty inputs gracefully', () => {
    const kpis = SchedulingKPIBridge.calculateKPIs([], []);
    expect(kpis.activeSchedulingCount).toBe(0);
    expect(kpis.activeInterventions).toBe(0);
    expect(kpis.activeActivities).toBe(0);
  });
});
