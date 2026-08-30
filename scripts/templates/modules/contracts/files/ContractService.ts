import { ContractsService } from './contracts.service';
import type { ContractItem, ContractProductItem } from './schema';

/**
 * Proxy di retrocompatibilità: inoltra tutte le chiamate a ContractsService unificato
 */
export class ContractService {
  static async getClientContracts(clientId: string): Promise<ContractItem[]> {
    return ContractsService.getClientContracts(clientId);
  }

  static async getProjectContracts(projectId: string): Promise<ContractItem[]> {
    const list = await ContractsService.getContracts();
    return list.filter(c => c.projectId === projectId || (c as any).placeId === projectId);
  }

  static async approveContract(contractId: string, userId: string, userEmail: string): Promise<void> {
    return ContractsService.approveContract(contractId, userId, userEmail);
  }

  static async approveAndCollectFull(contractId: string, userId: string, userEmail: string): Promise<void> {
    return ContractsService.approveAndCollectFull(contractId, userId, userEmail);
  }

  static async collectInstallment(
    contractId: string, 
    installmentId: string, 
    actualAmount: number, 
    userId: string, 
    userEmail: string,
    productAllocations?: Array<{ productId: string, amount: number }>
  ): Promise<void> {
    return ContractsService.collectInstallment(
      contractId,
      installmentId,
      actualAmount,
      { uid: userId, email: userEmail },
      productAllocations
    );
  }

  static async saveQuote(
    clientId: string,
    clientNameStr: string,
    quoteItems: any[],
    quoteTotal: number,
    authObj: { uid: string; email: string }
  ): Promise<string> {
    return ContractsService.saveQuote(
      clientId,
      clientNameStr,
      quoteItems,
      quoteTotal,
      authObj
    );
  }

  static async approveQuoteToContract(
    quoteId: string,
    clientId: string,
    coSeller: { uid: string; share: number } | undefined,
    activeRole: string,
    authObj: { uid: string; email: string }
  ): Promise<void> {
    return ContractsService.submitForApproval(
      quoteId,
      coSeller ? { uid: coSeller.uid, share: coSeller.share } : undefined,
      authObj
    );
  }
}
