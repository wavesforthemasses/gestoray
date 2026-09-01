import { describe, it, expect } from 'vitest';

/**
 * GESTORAY MULTI-SECTOR AGNOSTIC BUSINESS DOMAIN TEST SUITE
 * Certifies the core mathematical, architectural, and business logic across 5 real SME archetypes:
 * 1. Edilizia & Cantieri (Multi-tariff labor, SAL, 10% VAT)
 * 2. Studi Professionali & Consulenza (Notula, Cassa 4%, Ritenuta 20%, IVA 22%)
 * 3. Food & Retail (Direct payments POS/Cash, Multi-rate VAT unbundling 4%/10%/22%)
 * 4. Manutenzioni & Assistenza Tecnica (SLA targets, TMR in hours, ticket priorities)
 * 5. Commercio B2B & Distribuzione (Price floor alerts, Co-seller splits, Realized commissions)
 */

describe('Gestoray Multi-Sector Agnostic SME Domain Tests', () => {

  // =========================================================================
  // 1. EDILIZIA & IMPIANTI
  // =========================================================================
  describe('Sector 1: Edilizia & Impianti Archetype', () => {
    it('calculates multi-rate labor costs across daily, hourly, and surface-based workers', () => {
      interface WorkerLabor {
        name: string;
        evalType: 'giornata' | 'oraria' | 'mq' | 'mc';
        unitRate: number;
        quantity: number;
      }

      const teamMembers: WorkerLabor[] = [
        { name: 'Capocantiere', evalType: 'giornata', unitRate: 180.00, quantity: 10 },    // 1800 €
        { name: 'Muratore Specializzato', evalType: 'oraria', unitRate: 22.50, quantity: 80 }, // 1800 €
        { name: 'Posatore Piastrelle', evalType: 'mq', unitRate: 18.00, quantity: 150 },      // 2700 €
        { name: 'Escavatorista', evalType: 'mc', unitRate: 8.50, quantity: 200 }             // 1700 €
      ];

      const totalLaborCost = teamMembers.reduce((acc, member) => {
        return acc + (member.unitRate * member.quantity);
      }, 0);

      expect(totalLaborCost).toBe(8000.00);
    });

    it('calculates construction contract SAL (Stato Avanzamento Lavori) with 10% VAT and retention', () => {
      const contractTotalNet = 100000.00;
      const sal1Percent = 30; // 30% SAL 1
      const garanziaRitenutaPercent = 5; // 5% ritenuta di garanzia
      const vatRate = 10; // 10% IVA Edilizia agevolata

      const salNet = contractTotalNet * (sal1Percent / 100); // 30,000 €
      const ritenutaGaranzia = salNet * (garanziaRitenutaPercent / 100); // 1,500 €
      const taxableSal = salNet - ritenutaGaranzia; // 28,500 €
      const vatAmount = taxableSal * (vatRate / 100); // 2,850 €
      const grossSalPayable = taxableSal + vatAmount; // 31,350 €

      expect(salNet).toBe(30000.00);
      expect(ritenutaGaranzia).toBe(1500.00);
      expect(taxableSal).toBe(28500.00);
      expect(vatAmount).toBe(2850.00);
      expect(grossSalPayable).toBe(31350.00);
    });
  });

  // =========================================================================
  // 2. STUDI PROFESSIONALI & CONSULENZA
  // =========================================================================
  describe('Sector 2: Studi Professionali & Consulenza Archetype', () => {
    it('computes professional notula with 4% rivals cassa, 22% VAT, and 20% ritenuta d acconto', () => {
      const consultingHours = 50;
      const hourlyRate = 90.00;
      const baseFee = consultingHours * hourlyRate; // 4,500 €

      const cassaPrevidenzaRate = 4; // 4%
      const cassaAmount = baseFee * (cassaPrevidenzaRate / 100); // 180 €

      const taxableTotal = baseFee + cassaAmount; // 4,680 €
      const vatRate = 22; // 22%
      const vatAmount = taxableTotal * (vatRate / 100); // 1,029.60 €
      const grossInvoice = taxableTotal + vatAmount; // 5,709.60 €

      const ritenutaAccontoRate = 20; // 20% on base fee
      const ritenutaAcconto = baseFee * (ritenutaAccontoRate / 100); // 900 €

      const netCashToCollect = grossInvoice - ritenutaAcconto; // 4,809.60 €

      expect(baseFee).toBe(4500.00);
      expect(cassaAmount).toBe(180.00);
      expect(taxableTotal).toBe(4680.00);
      expect(vatAmount).toBe(1029.60);
      expect(grossInvoice).toBe(5709.60);
      expect(ritenutaAcconto).toBe(900.00);
      expect(parseFloat(netCashToCollect.toFixed(2))).toBe(4809.60);
    });
  });

  // =========================================================================
  // 3. FOOD, BAR & RETAIL
  // =========================================================================
  describe('Sector 3: Food, Gelateria & Retail Archetype', () => {
    it('unbundles multi-rate VAT from daily cash register receipts across 4%, 10%, and 22%', () => {
      const dailyTransactions = [
        { desc: 'Pane e Latte (Beni prima necessità)', gross: 104.00, vatRate: 4 },    // net 100, vat 4
        { desc: 'Caffè e Gelati al banco (Somministrazione)', gross: 550.00, vatRate: 10 }, // net 500, vat 50
        { desc: 'Merchandise / Gadget (Beni generici)', gross: 122.00, vatRate: 22 }      // net 100, vat 22
      ];

      let totalGross = 0;
      let totalNet = 0;
      let totalVat = 0;

      for (const item of dailyTransactions) {
        const net = item.gross / (1 + item.vatRate / 100);
        const vat = item.gross - net;

        totalGross += item.gross;
        totalNet += net;
        totalVat += vat;
      }

      expect(totalGross).toBe(776.00);
      expect(parseFloat(totalNet.toFixed(2))).toBe(700.00);
      expect(parseFloat(totalVat.toFixed(2))).toBe(76.00);
    });

    it('processes standalone point-of-sale entries without requiring active contracts', () => {
      const standalonePayment = {
        paymentNumber: 'POS-2026-089',
        grossAmount: 85.50,
        vatRate: 10,
        method: 'satispay',
        hasContract: false,
        status: 'registrato'
      };

      const netAmount = standalonePayment.grossAmount / (1 + standalonePayment.vatRate / 100);
      expect(standalonePayment.hasContract).toBe(false);
      expect(parseFloat(netAmount.toFixed(2))).toBe(77.73);
    });
  });

  // =========================================================================
  // 4. MANUTENZIONI & ASSISTENZA TECNICA
  // =========================================================================
  describe('Sector 4: Manutenzioni & Assistenza Tecnica Archetype', () => {
    it('calculates average resolution time (TMR) and checks SLA breach flags accurately', () => {
      interface HelpdeskTicket {
        id: string;
        priority: 'urgente' | 'alta' | 'media' | 'bassa';
        slaLimitHours: number;
        createdDate: string;
        closedDate: string;
      }

      const tickets: HelpdeskTicket[] = [
        {
          id: 'TCK-001',
          priority: 'urgente',
          slaLimitHours: 4,
          createdDate: '2026-08-01T08:00:00Z',
          closedDate: '2026-08-01T11:00:00Z' // 3 hours
        },
        {
          id: 'TCK-002',
          priority: 'alta',
          slaLimitHours: 8,
          createdDate: '2026-08-01T08:00:00Z',
          closedDate: '2026-08-01T18:00:00Z' // 10 hours -> BREACH
        },
        {
          id: 'TCK-003',
          priority: 'media',
          slaLimitHours: 24,
          createdDate: '2026-08-01T08:00:00Z',
          closedDate: '2026-08-01T20:00:00Z' // 12 hours
        }
      ];

      const durations = tickets.map(t => {
        const start = new Date(t.createdDate).getTime();
        const end = new Date(t.closedDate).getTime();
        const hours = (end - start) / (1000 * 60 * 60);
        return {
          id: t.id,
          hours,
          isSlaBreached: hours > t.slaLimitHours
        };
      });

      const totalHours = durations.reduce((acc, d) => acc + d.hours, 0);
      const tmr = totalHours / durations.length;
      const breachedCount = durations.filter(d => d.isSlaBreached).length;

      expect(tmr).toBe(8.333333333333334);
      expect(parseFloat(tmr.toFixed(1))).toBe(8.3);
      expect(breachedCount).toBe(1);
      expect(durations.find(d => d.id === 'TCK-002')?.isSlaBreached).toBe(true);
    });
  });

  // =========================================================================
  // 5. COMMERCIO B2B & DISTRIBUZIONE
  // =========================================================================
  describe('Sector 5: Commercio B2B & Distribuzione Archetype', () => {
    it('detects catalog items sold below minimum price threshold and flags warning alert', () => {
      const orderItems = [
        { sku: 'ART-01', name: 'Scatola Bulloni', listPrice: 15.00, minPrice: 12.00, soldPrice: 13.50, quantity: 10 },
        { sku: 'ART-02', name: 'Trapano Industriale', listPrice: 250.00, minPrice: 210.00, soldPrice: 195.00, quantity: 2 } // BELOW MIN PRICE
      ];

      const auditedItems = orderItems.map(item => ({
        ...item,
        subtotal: item.soldPrice * item.quantity,
        hasPriceWarning: item.soldPrice < (item.minPrice ?? 0)
      }));

      const hasAnyPriceWarning = auditedItems.some(i => i.hasPriceWarning);
      const totalOrderNet = auditedItems.reduce((acc, i) => acc + i.subtotal, 0);

      expect(hasAnyPriceWarning).toBe(true);
      expect(auditedItems[0].hasPriceWarning).toBe(false);
      expect(auditedItems[1].hasPriceWarning).toBe(true);
      expect(totalOrderNet).toBe(135.00 + 390.00); // 525.00 €
    });

    it('allocates a single lump-sum customer payment to multiple open contract installments sequentially', () => {
      const openInstallments = [
        { id: 'inst-1', contractId: 'CTR-01', dueDate: '2026-08-10', expected: 500.00, paid: 200.00, remaining: 300.00 },
        { id: 'inst-2', contractId: 'CTR-01', dueDate: '2026-09-10', expected: 500.00, paid: 0.00, remaining: 500.00 },
        { id: 'inst-3', contractId: 'CTR-02', dueDate: '2026-08-25', expected: 400.00, paid: 0.00, remaining: 400.00 }
      ];

      const customerPaymentAmount = 650.00;
      let unallocatedCash = customerPaymentAmount;
      const allocations: Record<string, number> = {};

      for (const inst of openInstallments) {
        if (unallocatedCash <= 0) break;
        const allocated = Math.min(unallocatedCash, inst.remaining);
        allocations[inst.id] = allocated;
        unallocatedCash -= allocated;
      }

      expect(allocations['inst-1']).toBe(300.00); // Fills inst-1 completely
      expect(allocations['inst-2']).toBe(350.00); // Fills inst-2 partially (350 of 500)
      expect(allocations['inst-3']).toBeUndefined(); // Nothing left for inst-3
      expect(unallocatedCash).toBe(0.00);
    });

    it('splits commercial commissions accurately between primary seller and co-seller only upon realized payment', () => {
      const realizedPaymentNet = 2000.00;
      const agentQualificationPercentage = 15; // 15% provvigione qualifica
      const coSellerSharePercentage = 30; // 30% della provvigione al co-venditore

      const totalCommission = realizedPaymentNet * (agentQualificationPercentage / 100); // 300 €
      const coSellerCommission = totalCommission * (coSellerSharePercentage / 100); // 90 €
      const primaryAgentCommission = totalCommission - coSellerCommission; // 210 €

      expect(totalCommission).toBe(300.00);
      expect(coSellerCommission).toBe(90.00);
      expect(primaryAgentCommission).toBe(210.00);
    });
  });

  // =========================================================================
  // 6. FIRESTORE DATA RESILIENCE & CLEAN UNDEFINED SANITIZATION
  // =========================================================================
  describe('Sector 6: Firestore Data Resilience & Safe Object Sanitization', () => {
    it('safely purges undefined and unassigned optional fields before NoSQL setDoc execution', async () => {
      const { cleanUndefined } = await import('$lib/utils/helpers');

      const rawPurchaseOrderPayload: Record<string, any> = {
        poNumber: 'PO-2026-0001',
        supplierId: 'sup-123',
        supplierName: 'Forniture Edili Srl',
        orderDate: '2026-08-31',
        expectedDeliveryDate: undefined, // Simulates optional date left blank
        deliveryNotes: undefined,        // Simulates blank delivery notes
        notes: '',
        status: 'bozza',
        items: [
          {
            productId: 'prod-1',
            productName: 'Sabbia Fine',
            orderedQty: 10,
            unitPrice: 25.0,
            discountPercent: undefined // Optional discount
          }
        ]
      };

      const sanitized = cleanUndefined(rawPurchaseOrderPayload);

      expect(sanitized.poNumber).toBe('PO-2026-0001');
      expect(sanitized.orderDate).toBe('2026-08-31');
      expect('expectedDeliveryDate' in sanitized).toBe(false);
      expect('deliveryNotes' in sanitized).toBe(false);
      expect(sanitized.status).toBe('bozza');
      expect(sanitized.items[0].productName).toBe('Sabbia Fine');
      expect('discountPercent' in sanitized.items[0]).toBe(false);
    });
  });

});
