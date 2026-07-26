import { describe, it, expect } from 'vitest';
import { UnitsOfMeasureService, DEFAULT_UNITS } from './unitsOfMeasureService';

describe('UnitsOfMeasureService Unit Tests', () => {
  it('should resolve exact unit codes correctly', () => {
    const resMc = UnitsOfMeasureService.resolveUnitSync('mc');
    expect(resMc.isValid).toBe(true);
    expect(resMc.canonicalCode).toBe('mc');

    const resMq = UnitsOfMeasureService.resolveUnitSync('mq');
    expect(resMq.isValid).toBe(true);
    expect(resMq.canonicalCode).toBe('mq');

    const resKg = UnitsOfMeasureService.resolveUnitSync('kg');
    expect(resKg.isValid).toBe(true);
    expect(resKg.canonicalCode).toBe('kg');
  });

  it('should resolve unit aliases and convert to canonical code', () => {
    const resM3 = UnitsOfMeasureService.resolveUnitSync('m3');
    expect(resM3.isValid).toBe(true);
    expect(resM3.canonicalCode).toBe('mc');

    const resMetriCubi = UnitsOfMeasureService.resolveUnitSync('metri cubi');
    expect(resMetriCubi.isValid).toBe(true);
    expect(resMetriCubi.canonicalCode).toBe('mc');

    const resM2 = UnitsOfMeasureService.resolveUnitSync('m2');
    expect(resM2.isValid).toBe(true);
    expect(resM2.canonicalCode).toBe('mq');

    const resHours = UnitsOfMeasureService.resolveUnitSync('hours');
    expect(resHours.isValid).toBe(true);
    expect(resHours.canonicalCode).toBe('ora');
  });

  it('should identify unknown unit strings', () => {
    const resUnknown = UnitsOfMeasureService.resolveUnitSync('unknown_xyz_unit');
    expect(resUnknown.isValid).toBe(false);
  });

  it('should respect decimal precision rules per unit of measure', () => {
    // 0 decimals for pz
    expect(UnitsOfMeasureService.getUnitDecimals('pz')).toBe(0);
    expect(UnitsOfMeasureService.getStepForUnit('pz')).toBe('1');
    expect(UnitsOfMeasureService.roundQuantity(12.789, 'pz')).toBe(13);
    expect(UnitsOfMeasureService.formatQuantity(12.789, 'pz')).toBe('13');

    // 3 decimals for mc (metri cubi)
    expect(UnitsOfMeasureService.getUnitDecimals('mc')).toBe(3);
    expect(UnitsOfMeasureService.getStepForUnit('mc')).toBe('0.001');
    expect(UnitsOfMeasureService.roundQuantity(0.04321, 'mc')).toBe(0.043);
    expect(UnitsOfMeasureService.formatQuantity(0.043, 'mc')).toBe('0,043');

    // 2 decimals for eur and mq
    expect(UnitsOfMeasureService.getUnitDecimals('eur')).toBe(2);
    expect(UnitsOfMeasureService.getStepForUnit('eur')).toBe('0.01');
    expect(UnitsOfMeasureService.roundQuantity(15.555, 'eur')).toBe(15.56);
    expect(UnitsOfMeasureService.formatQuantity(15.5, 'eur', true)).toBe('15,50 €');
  });
});
