import { db, doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from '$lib/firebase';
import { roundCurrency } from '$lib/utils/math';
import type { InvoiceItem } from '../schema';

export class InvoicesPaymentsBridge {
  private static COLLECTION = 'invoices';

  /**
   * Recupera le fatture emesse non ancora saldate per un dato cliente
   */
  static async getUnpaidInvoicesForClient(clientId: string): Promise<InvoiceItem[]> {
    if (!clientId) return [];
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('clientId', '==', clientId),
        where('status', 'in', ['emessa', 'inviata_sdi', 'consegnata'])
      );
      const snap = await getDocs(q);
      const invoices: InvoiceItem[] = [];
      snap.forEach(d => {
        const data = d.data() as InvoiceItem;
        if (data.paymentStatus !== 'pagata_saldata') {
          invoices.push({ id: d.id, ...data });
        }
      });
      return invoices;
    } catch (e) {
      console.warn('Errore lettura fatture aperte:', e);
      return [];
    }
  }

  /**
   * Registra un incasso totale o parziale su una fattura, riconciliando lo stato
   */
  static async registerPaymentOnInvoice(
    invoiceId: string, 
    amountPaid: number, 
    paymentId?: string
  ): Promise<{ newPaidAmount: number; newRemainingAmount: number; status: string }> {
    const docRef = doc(db, this.COLLECTION, invoiceId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Fattura ${invoiceId} non trovata`);
    }

    const data = snap.data() as InvoiceItem;
    const currentPaid = Number(data.paidAmount || 0);
    const totalDue = Number(data.netToPay || data.totalGross || 0);

    const newPaidAmount = roundCurrency(currentPaid + amountPaid);
    const newRemainingAmount = Math.max(0, roundCurrency(totalDue - newPaidAmount));

    let paymentStatus: 'non_pagata' | 'pagata_parziale' | 'pagata_saldata' = 'non_pagata';
    if (newRemainingAmount === 0) {
      paymentStatus = 'pagata_saldata';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'pagata_parziale';
    }

    await updateDoc(docRef, {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus,
      updatedAt: new Date().toISOString()
    });

    return { newPaidAmount, newRemainingAmount, status: paymentStatus };
  }

  /**
   * Registra una scadenza nel modulo deadlines se attivo
   */
  static async syncDeadlineToSchedule(invoice: InvoiceItem): Promise<void> {
    if (!invoice.id || !invoice.dueDate || invoice.paymentStatus === 'pagata_saldata') return;
    try {
      const deadlineDocId = `dl_inv_${invoice.id}`;
      await setDoc(doc(db, 'deadlines', deadlineDocId), {
        title: `Incasso ${invoice.invoiceNumber} - ${invoice.clientName}`,
        date: invoice.dueDate,
        dueDate: invoice.dueDate,
        amount: invoice.remainingAmount || invoice.netToPay,
        entityType: 'invoice',
        entityId: invoice.id,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        status: 'pending',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Sync scadenza fattura non riuscita:', e);
    }
  }
}
