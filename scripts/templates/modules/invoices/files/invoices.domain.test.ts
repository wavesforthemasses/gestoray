import { describe, it, expect } from 'vitest';
import { InvoicesService } from './invoices.service';
import type { InvoiceLine } from './schema';

describe('Invoices Domain & Calculation Engine SSOT Tests', () => {
  it('computes basic single-rate invoice totals with standard 22% VAT', () => {
    const lines: InvoiceLine[] = [
      {
        id: 'l1',
        description: 'Consulenza Direzionale',
        quantity: 1,
        unitPrice: 1000,
        vatRate: 22,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      }
    ];

    const res = InvoicesService.calculateTotals(lines);
    expect(res.totalNet).toBe(1000);
    expect(res.totalVat).toBe(220);
    expect(res.totalGross).toBe(1220);
    expect(res.netToPay).toBe(1220);
    expect(res.castelletto.length).toBe(1);
    expect(res.castelletto[0].rate).toBe(22);
    expect(res.castelletto[0].taxableAmount).toBe(1000);
    expect(res.castelletto[0].vatAmount).toBe(220);
  });

  it('correctly calculates professional notula with 4% pension fund and 20% withholding tax', () => {
    const lines: InvoiceLine[] = [
      {
        id: 'l1',
        description: 'Prestazione Professionale Geometra',
        quantity: 1,
        unitPrice: 1000,
        vatRate: 22,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      }
    ];

    const res = InvoicesService.calculateTotals(lines, {
      pensionFundRate: 4,     // 4% di 1000 = 40 €
      withholdingTaxRate: 20  // 20% di 1000 = 200 €
    });

    expect(res.totalNet).toBe(1000);
    expect(res.pensionFundAmount).toBe(40);
    expect(res.totalVat).toBe(220);
    expect(res.totalGross).toBe(1260); // 1000 + 40 + 220
    expect(res.withholdingTaxAmount).toBe(200);
    // Netto a pagare = Lordo (1260) - Ritenuta (200) = 1060
    expect(res.netToPay).toBe(1060);
  });

  it('correctly computes Split Payment PA (Art. 17-ter) where customer pays net and PA remits VAT', () => {
    const lines: InvoiceLine[] = [
      {
        id: 'l1',
        description: 'Lavori di Manutenzione Comunale',
        quantity: 1,
        unitPrice: 5000,
        vatRate: 22,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      }
    ];

    const res = InvoicesService.calculateTotals(lines, {
      isSplitPayment: true
    });

    expect(res.totalNet).toBe(5000);
    expect(res.totalVat).toBe(1100);
    expect(res.totalGross).toBe(6100);
    expect(res.splitPaymentAmount).toBe(1100);
    // In Split Payment, il cliente PA bonifica solo l'imponibile
    expect(res.netToPay).toBe(5000);
  });

  it('aggregates multi-rate items into official Castelletto without rounding squadrature', () => {
    const lines: InvoiceLine[] = [
      {
        id: 'l1',
        description: 'Materiale Edile al 10%',
        quantity: 2,
        unitPrice: 150.55,
        vatRate: 10,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      },
      {
        id: 'l2',
        description: 'Noleggio Attrezzatura al 22%',
        quantity: 1,
        unitPrice: 500.25,
        vatRate: 22,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      },
      {
        id: 'l3',
        description: 'Subappalto Reverse Charge 0%',
        quantity: 1,
        unitPrice: 2000.00,
        vatRate: 0,
        natureCode: 'N6.3',
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      }
    ];

    const res = InvoicesService.calculateTotals(lines);
    // Netto 10%: 301.10 -> IVA: 30.11
    // Netto 22%: 500.25 -> IVA: 110.06
    // Netto 0%: 2000.00 -> IVA: 0.00
    expect(res.totalNet).toBe(2801.35);
    expect(res.totalVat).toBe(140.17);
    expect(res.totalGross).toBe(2941.52);
    expect(res.castelletto.length).toBe(3);
  });
});
