import { describe, it, expect } from 'vitest';
import { InterventiService } from './interventi.service';

describe('Interventi Service - Overbooking Logic', () => {
  it('should detect vehicle overbooking when time intervals overlap', () => {
    const existingInterventions = [
      {
        id: 'int-1',
        vehicles: ['furgone-01'],
        scheduledStartAt: '2026-07-25T09:00:00.000Z',
        scheduledEndAt: '2026-07-25T11:00:00.000Z'
      }
    ];

    // New intervention during overlapping time (10:00 to 12:00) with same vehicle
    const result = InterventiService.evaluateOverbookingOverlap(
      ['furgone-01'],
      '2026-07-25T10:00:00.000Z',
      '2026-07-25T12:00:00.000Z',
      existingInterventions
    );

    expect(result.hasOverbooking).toBe(true);
    expect(result.conflictingVehicleId).toBe('furgone-01');
  });

  it('should NOT report overbooking when time intervals do not overlap', () => {
    const existingInterventions = [
      {
        id: 'int-1',
        vehicles: ['furgone-01'],
        scheduledStartAt: '2026-07-25T09:00:00.000Z',
        scheduledEndAt: '2026-07-25T11:00:00.000Z'
      }
    ];

    // New intervention after end time (11:30 to 13:00)
    const result = InterventiService.evaluateOverbookingOverlap(
      ['furgone-01'],
      '2026-07-25T11:30:00.000Z',
      '2026-07-25T13:00:00.000Z',
      existingInterventions
    );

    expect(result.hasOverbooking).toBe(false);
  });
});
