import { db, collection, getDocs, query, where } from '$lib/firebase';

export interface ContractPaymentLink {
  contractId: string;
  totalPaid: number;
  totalPending: number;
  paymentsCount: number;
}

export class ContractsPaymentsBridge {
  /**
   * Bridge Service: Connects Contract Installments with Cash Payments.
   * Executed only when both 'contracts' and 'payments' modules are installed.
   */
  static async getContractPaymentsSummary(contractId: string): Promise<ContractPaymentLink> {
    const q = query(
      collection(db, 'payments'),
      where('contractId', '==', contractId)
    );

    const snap = await getDocs(q);
    let totalPaid = 0;
    let totalPending = 0;

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const amt = data.amount || 0;
      if (data.status === 'pagato') {
        totalPaid += amt;
      } else {
        totalPending += amt;
      }
    });

    return {
      contractId,
      totalPaid,
      totalPending,
      paymentsCount: snap.docs.length
    };
  }
}
