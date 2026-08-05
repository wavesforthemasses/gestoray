import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  functions: {},
  httpsCallable: () => vi.fn().mockResolvedValue({
    data: {
      data: [100, 200, 300],
      results: [100, 200, 300]
    }
  })
}));

describe('DashboardService - Chart Aggregations Engine', () => {
  it('should generate periods correctly for monthly granularity', () => {
    const periods = DashboardService.generateChartPeriods('2026-08-03', 'mensile');
    expect(periods.length).toBeGreaterThan(0);
    expect(periods[0]).toHaveProperty('start');
    expect(periods[0]).toHaveProperty('end');
  });

  it('should fetch chart aggregations and extract array safely from response data/results', async () => {
    const periods = [
      { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
      { start: new Date('2026-02-01'), end: new Date('2026-02-28') },
      { start: new Date('2026-03-01'), end: new Date('2026-03-31') }
    ];

    const results = await DashboardService.fetchChartAggregations(periods, 'superadmin', 'test-uid', 'vss');
    expect(results).toEqual([100, 200, 300]);
  });
});
