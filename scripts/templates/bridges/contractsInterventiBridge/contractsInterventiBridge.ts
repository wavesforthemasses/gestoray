import { db, collection, getDocs, query, where } from '$lib/firebase';

export interface ContractInterventionSummary {
  contractId: string;
  totalInterventions: number;
  totalHoursSpent: number;
  interventions: { id: string; title: string; date: string; hours: number }[];
}

export class ContractsInterventiBridge {
  /**
   * Bridge Service: Calculates total hours used by interventions for a specific contract.
   * Only called if both 'contracts' and 'interventi' modules are present.
   */
  static async getContractHoursSummary(contractId: string): Promise<ContractInterventionSummary> {
    const q = query(
      collection(db, 'interventions'),
      where('contractId', '==', contractId)
    );

    const snap = await getDocs(q);
    let totalHoursSpent = 0;
    const interventions: { id: string; title: string; date: string; hours: number }[] = [];

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const hours = data.estimatedHours || data.estimatedQuantity || 1;
      totalHoursSpent += hours;

      interventions.push({
        id: docSnap.id,
        title: data.title || 'Intervento',
        date: data.scheduledStartAt ? data.scheduledStartAt.slice(0, 10) : 'N.D.',
        hours
      });
    });

    return {
      contractId,
      totalInterventions: snap.docs.length,
      totalHoursSpent,
      interventions
    };
  }
}
