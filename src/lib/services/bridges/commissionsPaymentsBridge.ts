import { db, collection, getDocs, query, where } from '$lib/firebase';

export interface AgentPayoutSummary {
  agentUid: string;
  totalCommissionsMatured: number;
  totalCommissionsPaid: number;
  pendingBalance: number;
}

export class CommissionsPaymentsBridge {
  /**
   * Bridge Service: Calculates agent commission balances vs payment payouts.
   * Executed only when both 'commissions' and 'payments' modules are present.
   */
  static async getAgentPayoutSummary(agentUid: string): Promise<AgentPayoutSummary> {
    const commQuery = query(
      collection(db, 'commissions'),
      where('agentUid', '==', agentUid)
    );

    const commSnap = await getDocs(commQuery);
    let totalCommissionsMatured = 0;
    let totalCommissionsPaid = 0;

    commSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const amt = data.commissionAmount || 0;
      if (data.status === 'liquidata') {
        totalCommissionsPaid += amt;
      } else if (data.status === 'maturata') {
        totalCommissionsMatured += amt;
      }
    });

    return {
      agentUid,
      totalCommissionsMatured,
      totalCommissionsPaid,
      pendingBalance: totalCommissionsMatured
    };
  }
}
