import { db, doc, getDoc, getDocs, collection, updateDoc, deleteDoc, deleteField } from '$lib/firebase';

export interface PaymentDataPayload {
  payment: any;
  allocationsList: any[];
  recordedUserName: string;
}

export class PaymentDetailService {
  static async fetchPaymentData(paymentId: string): Promise<PaymentDataPayload> {
    const payDoc = await getDoc(doc(db, 'payments', paymentId));
    if (!payDoc.exists()) {
      throw new Error("Impossibile trovare questo incasso nel database.");
    }
    const payment = payDoc.data();

    const allocSnap = await getDocs(collection(db, 'payments', paymentId, 'contractsPaid'));
    const allocationsList: any[] = [];
    allocSnap.forEach((d: any) => {
      allocationsList.push({ id: d.id, ...d.data().original });
    });

    let recordedUserName = payment.original?.recordedEmail || 'Sconosciuto';
    if (payment.original?.recordedBy) {
      const userDoc = await getDoc(doc(db, 'users', payment.original.recordedBy));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        recordedUserName = `${uData.original?.nome || ''} ${uData.original?.cognome || ''}`.trim() || recordedUserName;
      }
    }

    return { payment, allocationsList, recordedUserName };
  }

  static async fetchContractForDistribution(contractId: string) {
    const cDoc = await getDoc(doc(db, 'contracts', contractId));
    if (!cDoc.exists()) throw new Error("Contratto non trovato.");
    return cDoc.data();
  }

  static async saveDistribution(paymentId: string, allocId: string, productAllocations: any[], uid: string) {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'payments', paymentId, 'contractsPaid', allocId), {
      'original.productAllocations': productAllocations.filter(a => a.amount > 0),
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }

  static async deletePayment(paymentId: string, allocationsList: any[]) {
    for (const alloc of allocationsList) {
      if (alloc.installmentId) {
        try {
          const targetContractId = alloc.contractId || alloc.id;
          await updateDoc(doc(db, 'contracts', targetContractId, 'installments', alloc.installmentId), {
            'original.status': 'pending',
            'original.paidAmount': deleteField(),
            'original.paidAt': deleteField()
          });
        } catch (instErr) {
          console.error("Failed to reset installment: ", instErr);
        }
      }
      await deleteDoc(doc(db, 'payments', paymentId, 'contractsPaid', alloc.id));
    }

    await deleteDoc(doc(db, 'payments', paymentId));
  }
}
