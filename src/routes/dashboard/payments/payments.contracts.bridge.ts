import { db, doc, setDoc, updateDoc } from '$lib/firebase';
import { menuConfigStore } from '$lib/stores/menu';
import { get } from 'svelte/store';

export interface PendingInstallmentOption {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  installmentId?: string;
  installmentNumber?: number;
  dueDate?: string;
  expectedAmount: number;
  paidAmount?: number;
  remainingAmount: number;
  status: string;
}

export class PaymentsContractsBridge {
  /**
   * Verifica se il modulo contratti è attivo nel tenant
   */
  static isContractsActive(): boolean {
    try {
      const active = get(menuConfigStore);
      return active.some(m => m.id === 'contracts');
    } catch {
      return false;
    }
  }

  /**
   * Recupera le scadenze e le rate pendenti per un dato cliente
   */
  static async getPendingInstallmentsForClient(clientId: string): Promise<PendingInstallmentOption[]> {
    if (!this.isContractsActive() || !clientId) return [];

    try {
      // Dynamic import isolato
      const { ContractsService } = await import('../contracts/contracts.service');
      const contracts = await ContractsService.getClientContracts(clientId);
      
      const results: PendingInstallmentOption[] = [];

      for (const contract of contracts) {
        if (!contract.id) continue;
        const s = (contract.status as string) || '';
        if (s === 'rifiutato' || s === 'annullato' || s === 'scaduto') continue;

        const installments = await ContractsService.getInstallments(contract.id);

        if (installments.length === 0) {
          // Se non ha rate specifiche, mostra il contratto come riga complessiva
          const totalPaid = Number(contract.derived?.totalPaid || 0);
          const totalAmount = Number(contract.totalAmount || 0);
          const remaining = Math.max(0, totalAmount - totalPaid);

          if (remaining > 0) {
            results.push({
              contractId: contract.id,
              contractNumber: contract.contractNumber || 'CTR',
              contractTitle: contract.title,
              expectedAmount: totalAmount,
              paidAmount: totalPaid,
              remainingAmount: remaining,
              status: contract.status
            });
          }
        } else {
          // Se ha rate nello scadenzario, elenca le rate non ancora saldate
          for (const inst of installments) {
            const isPaid = inst.status === 'pagato' || inst.status === 'paid';
            if (!isPaid && inst.id) {
              const expected = Number(inst.expectedAmount ?? inst.amount ?? 0);
              const paid = Number(inst.paidAmount ?? 0);
              const remaining = Math.max(0, expected - paid);

              results.push({
                contractId: contract.id,
                contractNumber: contract.contractNumber || 'CTR',
                contractTitle: contract.title,
                installmentId: inst.id,
                installmentNumber: inst.installmentNumber,
                dueDate: inst.dueDate,
                expectedAmount: expected,
                paidAmount: paid,
                remainingAmount: remaining,
                status: inst.status
              });
            }
          }
        }
      }

      return results;
    } catch (e) {
      console.warn('Bridge PaymentsContractsBridge non disponibile:', e);
      return [];
    }
  }

  /**
   * Registra le allocazioni dell'incasso sui contratti/rate e aggiorna i saldi
   */
  static async allocatePayment(
    paymentId: string,
    clientId: string,
    clientName: string,
    allocations: Array<{ contractId: string; installmentId?: string; amount: number }>,
    authUser: { uid: string; email: string }
  ): Promise<void> {
    if (!this.isContractsActive()) return;

    try {
      const now = new Date().toISOString();
      const { ContractsService } = await import('../contracts/contracts.service');

      for (const alloc of allocations) {
        if (alloc.amount <= 0) continue;

        // 1. Registra su subcollection contractsPaid del pagamento
        await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', alloc.contractId), {
          paymentId,
          contractId: alloc.contractId,
          installmentId: alloc.installmentId || null,
          amount: alloc.amount,
          clientId,
          clientName,
          original: {
            paymentId,
            contractId: alloc.contractId,
            installmentId: alloc.installmentId || null,
            amount: alloc.amount,
            clientId,
            clientName,
            date: now
          },
          edits: {
            createdAt: now,
            createdBy: authUser.uid
          }
        });

        // 2. Se è specificata una rata, aggiorna lo stato della rata a pagato
        if (alloc.installmentId) {
          await ContractsService.updateInstallment(alloc.contractId, alloc.installmentId, {
            status: 'pagato',
            paidAmount: alloc.amount,
            paidAt: now
          });
        }
      }
    } catch (e) {
      console.warn('Errore durante allocazione bridge pagamenti-contratti:', e);
    }
  }
}
