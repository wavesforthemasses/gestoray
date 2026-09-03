import { describe, it, expect } from 'vitest';
import { VatRatesService, DEFAULT_VAT_RATES } from './vatRatesService';

describe('VatRatesService SSOT Unit Tests', () => {
  it('contains essential standard Italian VAT rates and exemption codes out of the box', () => {
    const rates = DEFAULT_VAT_RATES.map(r => r.rate);
    expect(rates).toContain(22);
    expect(rates).toContain(10);
    expect(rates).toContain(5);
    expect(rates).toContain(4);
    expect(rates).toContain(0);

    const reverseCharge = DEFAULT_VAT_RATES.find(r => r.natureCode === 'N6.3');
    expect(reverseCharge).toBeDefined();
    expect(reverseCharge?.rate).toBe(0);
  });

  it('calculates line VAT and gross accurately with decimal rounding', () => {
    const res = VatRatesService.calculateLineVat(100, 22);
    expect(res.netAmount).toBe(100);
    expect(res.vatAmount).toBe(22);
    expect(res.grossAmount).toBe(122);

    const resReduced = VatRatesService.calculateLineVat(33.33, 10);
    expect(resReduced.netAmount).toBe(33.33);
    expect(resReduced.vatAmount).toBe(3.33);
    expect(resReduced.grossAmount).toBe(36.66);
  });

  it('unbundles VAT from cash register or gross payment accurately', () => {
    const unbundled22 = VatRatesService.unbundleVat(122, 22);
    expect(unbundled22.netAmount).toBe(100);
    expect(unbundled22.vatAmount).toBe(22);

    const unbundled10 = VatRatesService.unbundleVat(550, 10);
    expect(unbundled10.netAmount).toBe(500);
    expect(unbundled10.vatAmount).toBe(50);

    const unbundledZero = VatRatesService.unbundleVat(1000, 0);
    expect(unbundledZero.netAmount).toBe(1000);
    expect(unbundledZero.vatAmount).toBe(0);
  });

  it('computes official Castelletto IVA aggregation without cent rounding errors', () => {
    const lines = [
      { netAmount: 100.33, vatRate: 22 },
      { netAmount: 200.67, vatRate: 22 }, // Total 22%: 301.00 -> VAT: 66.22
      { netAmount: 50.00, vatRate: 10 },  // Total 10%: 50.00 -> VAT: 5.00
      { netAmount: 1000.00, vatRate: 0, natureCode: 'N6.3' } // Total 0%: 1000.00 -> VAT: 0
    ];

    const totals = VatRatesService.calculateTotalsByVat(lines);
    expect(totals.totalNet).toBe(1351.00);
    expect(totals.totalVat).toBe(71.22);
    expect(totals.totalGross).toBe(1422.22);

    expect(totals.castelletto.length).toBe(3);
    const g22 = totals.castelletto.find(c => c.rate === 22);
    expect(g22?.taxableAmount).toBe(301.00);
    expect(g22?.vatAmount).toBe(66.22);

    const g10 = totals.castelletto.find(c => c.rate === 10);
    expect(g10?.taxableAmount).toBe(50.00);
    expect(g10?.vatAmount).toBe(5.00);

    const g0 = totals.castelletto.find(c => c.rate === 0);
    expect(g0?.taxableAmount).toBe(1000.00);
    expect(g0?.vatAmount).toBe(0);
    expect(g0?.natureCode).toBe('N6.3');
  });
});
