import { db, collection, getDocs } from '$lib/firebase';
import { roundCurrency } from '$lib/utils/math';
import type { InvoiceItem } from './schema';

export class InvoicesKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for all Invoice KPIs.
   */
  static calculateKPIs(invoicesList: any[]) {
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

    let fatturatoMese = 0;
    let ivaDebitoMese = 0;
    let fattureAperte = 0;
    let totalInvoices = 0;

    for (const d of invoicesList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const inv = (d.data ? d.data() : d) as InvoiceItem;
      if (inv.status === 'annullata' || inv.status === 'scartata') continue;

      totalInvoices++;
      const isCurrentMonth = (inv.date || '').startsWith(currentMonthPrefix);
      if (isCurrentMonth) {
        fatturatoMese += Number(inv.totalNet || 0);
        ivaDebitoMese += Number(inv.totalVat || 0);
      }

      if (inv.status !== 'bozza' && inv.paymentStatus !== 'pagata_saldata') {
        fattureAperte++;
      }
    }

    return {
      fatturato_mese: roundCurrency(fatturatoMese),
      iva_debito_mese: roundCurrency(ivaDebitoMese),
      fatture_aperte: fattureAperte,
      total_invoices: totalInvoices
    };
  }

  static async fetchKPIs() {
    try {
      const snap = await getDocs(collection(db, 'invoices'));
      return this.calculateKPIs(snap.docs);
    } catch (e) {
      console.warn('Errore calcolo KPI invoices:', e);
      return {
        fatturato_mese: 0,
        iva_debito_mese: 0,
        fatture_aperte: 0,
        total_invoices: 0
      };
    }
  }
}

export async function getInvoicesKpis() {
  return InvoicesKPIBridge.fetchKPIs();
}

