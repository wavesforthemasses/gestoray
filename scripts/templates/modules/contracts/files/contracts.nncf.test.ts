import { describe, it, expect } from 'vitest';
import { ContractsService } from './contracts.service';
import { extractContractEffectiveDate, compareContractEffectiveDates } from '../../../../functions/src/triggers/onContractCreated';

/**
 * GESTORAY NNCF (New Name in Central File) ORDER DOMAIN & TRIGGER TEST SUITE
 * Certifies the exact mathematical and state transition rules for NNCF order tagging:
 * - At most one active approved order per client has derived.isNNCF = true
 * - Earliest chronological order wins
 * - Retroactive backdating dynamically reallocates NNCF to the older order
 * - Deletion/cancellation safely and symmetrically re-elects the second oldest
 * - Deterministic tie-breakers on identical dates
 */

describe('NNCF (New Name in Central File) Order Election Domain Engine', () => {

  // Helper simulation of the syncClientAndVendorStats NNCF election logic
  function electClientNNCF(contractsList: Array<{
    id: string;
    clientId: string;
    status: string;
    contractNumber?: string;
    startDate?: string;
    createdAt?: string;
    derived?: { isNNCF?: boolean; deleted?: boolean };
    original?: any;
    edits?: any;
  }>) {
    // 1. Filter active approved contracts
    const approvedContracts = contractsList
      .filter(c => {
        if (c.derived?.deleted) return false;
        const status = c.status || c.original?.status || 'bozza';
        return ['approved', 'approvato', 'attivo', 'accettato', 'firmato'].includes(status);
      })
      .sort(compareContractEffectiveDates);

    // 2. Identify winner
    const winner = approvedContracts.length > 0 ? approvedContracts[0] : null;
    const nncfOrderId = winner ? winner.id : null;
    const nncfDate = winner ? extractContractEffectiveDate(winner) : null;

    // 3. Mark each contract
    const updatedContracts = contractsList.map(c => {
      const isWinner = winner !== null && c.id === winner.id;
      return {
        ...c,
        derived: {
          ...(c.derived || {}),
          isNNCF: isWinner
        }
      };
    });

    return {
      winnerOrderId: nncfOrderId,
      nncfDate,
      contracts: updatedContracts
    };
  }

  // =========================================================================
  // SCENARIO 1: FIRST ORDER CREATION
  // =========================================================================
  it('E1: assigns isNNCF = true to the first approved order of a client', () => {
    const ctr1 = {
      id: 'ctr-001',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0001',
      status: 'approvato',
      startDate: '2026-05-10',
      createdAt: '2026-05-10T09:00:00Z'
    };

    const result = electClientNNCF([ctr1]);

    expect(result.winnerOrderId).toBe('ctr-001');
    expect(result.nncfDate).toBe('2026-05-10');
    expect(result.contracts[0].derived.isNNCF).toBe(true);
  });

  // =========================================================================
  // SCENARIO 2: CHRONOLOGICAL SUBSEQUENT ORDER
  // =========================================================================
  it('E2: maintains isNNCF on first order and gives isNNCF = false to newer orders', () => {
    const ctr1 = {
      id: 'ctr-001',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0001',
      status: 'approvato',
      startDate: '2026-05-10'
    };
    const ctr2 = {
      id: 'ctr-002',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0002',
      status: 'approvato',
      startDate: '2026-06-15'
    };

    const result = electClientNNCF([ctr1, ctr2]);

    expect(result.winnerOrderId).toBe('ctr-001');
    expect(result.contracts.find(c => c.id === 'ctr-001')?.derived.isNNCF).toBe(true);
    expect(result.contracts.find(c => c.id === 'ctr-002')?.derived.isNNCF).toBe(false);
  });

  // =========================================================================
  // SCENARIO 3: RETROACTIVE BACKDATING (THE CORE USER REQUIREMENT)
  // =========================================================================
  it('E3: reallocates NNCF to an older backdated order and unmarks the previous NNCF order', () => {
    const ctr1 = {
      id: 'ctr-001',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0001',
      status: 'approvato',
      startDate: '2026-05-10'
    };
    const ctr2 = {
      id: 'ctr-002',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0002',
      status: 'approvato',
      startDate: '2026-06-15'
    };
    // Historical order inserted retroactively with date older than ctr1
    const ctr0_backdated = {
      id: 'ctr-000',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0000',
      status: 'approvato',
      startDate: '2026-03-01'
    };

    const result = electClientNNCF([ctr1, ctr2, ctr0_backdated]);

    expect(result.winnerOrderId).toBe('ctr-000');
    expect(result.nncfDate).toBe('2026-03-01');
    // Only ctr0 is NNCF
    expect(result.contracts.find(c => c.id === 'ctr-000')?.derived.isNNCF).toBe(true);
    expect(result.contracts.find(c => c.id === 'ctr-001')?.derived.isNNCF).toBe(false);
    expect(result.contracts.find(c => c.id === 'ctr-002')?.derived.isNNCF).toBe(false);
  });

  // =========================================================================
  // SCENARIO 4: DELETION / CANCELLATION OF NNCF ORDER (SELF-HEALING)
  // =========================================================================
  it('E4: re-elects the second oldest order as NNCF when the original NNCF order is deleted', () => {
    const ctr0_deleted = {
      id: 'ctr-000',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0000',
      status: 'approvato',
      startDate: '2026-03-01',
      derived: { deleted: true }
    };
    const ctr1 = {
      id: 'ctr-001',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0001',
      status: 'approvato',
      startDate: '2026-05-10'
    };
    const ctr2 = {
      id: 'ctr-002',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0002',
      status: 'approvato',
      startDate: '2026-06-15'
    };

    const result = electClientNNCF([ctr0_deleted, ctr1, ctr2]);

    expect(result.winnerOrderId).toBe('ctr-001');
    expect(result.nncfDate).toBe('2026-05-10');
    expect(result.contracts.find(c => c.id === 'ctr-001')?.derived.isNNCF).toBe(true);
    expect(result.contracts.find(c => c.id === 'ctr-002')?.derived.isNNCF).toBe(false);
  });

  // =========================================================================
  // SCENARIO 5: ALL ORDERS DELETED OR CANCELLED
  // =========================================================================
  it('E5: returns null NNCF when all orders are deleted or cancelled', () => {
    const ctr1_cancelled = {
      id: 'ctr-001',
      clientId: 'client-alpha',
      status: 'annullato',
      startDate: '2026-05-10'
    };
    const ctr2_deleted = {
      id: 'ctr-002',
      clientId: 'client-alpha',
      status: 'approvato',
      startDate: '2026-06-15',
      derived: { deleted: true }
    };

    const result = electClientNNCF([ctr1_cancelled, ctr2_deleted]);

    expect(result.winnerOrderId).toBeNull();
    expect(result.nncfDate).toBeNull();
    expect(result.contracts.every(c => !c.derived.isNNCF)).toBe(true);
  });

  // =========================================================================
  // SCENARIO 6: DRAFT VS APPROVED STATUS TRANSITION
  // =========================================================================
  it('E6: ignores older draft/quote orders and only elects NNCF from approved orders', () => {
    const draft_older = {
      id: 'prev-001',
      clientId: 'client-alpha',
      status: 'bozza', // Not approved
      startDate: '2026-01-01'
    };
    const ctr1_approved = {
      id: 'ctr-001',
      clientId: 'client-alpha',
      status: 'approvato',
      startDate: '2026-05-10'
    };

    const result1 = electClientNNCF([draft_older, ctr1_approved]);
    expect(result1.winnerOrderId).toBe('ctr-001');

    // When draft is upgraded and approved, it takes over NNCF
    const draft_now_approved = { ...draft_older, status: 'approvato' };
    const result2 = electClientNNCF([draft_now_approved, ctr1_approved]);
    expect(result2.winnerOrderId).toBe('prev-001');
    expect(result2.contracts.find(c => c.id === 'prev-001')?.derived.isNNCF).toBe(true);
    expect(result2.contracts.find(c => c.id === 'ctr-001')?.derived.isNNCF).toBe(false);
  });

  // =========================================================================
  // SCENARIO 7: DETERMINISTIC TIE-BREAKER ON SAME DAY
  // =========================================================================
  it('E7: breaks ties deterministically on identical dates via contractNumber', () => {
    const ctrA = {
      id: 'id-beta',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0002',
      status: 'approvato',
      startDate: '2026-05-10'
    };
    const ctrB = {
      id: 'id-alpha',
      clientId: 'client-alpha',
      contractNumber: 'CTR-2026-0001', // Lower number wins tie
      status: 'approvato',
      startDate: '2026-05-10'
    };

    const result = electClientNNCF([ctrA, ctrB]);
    expect(result.winnerOrderId).toBe('id-alpha');
    expect(result.contracts.find(c => c.id === 'id-alpha')?.derived.isNNCF).toBe(true);
    expect(result.contracts.find(c => c.id === 'id-beta')?.derived.isNNCF).toBe(false);
  });

  // =========================================================================
  // SCENARIO 8: CLIENT NORMALIZATION IN SERVICE LAYER
  // =========================================================================
  it('E8: normalizes isNNCF in ContractsService across dual-schema representations', () => {
    const rawDocWithDerived = {
      id: 'c1',
      title: 'Contratto Alpha',
      derived: { isNNCF: true }
    };
    const normalized1 = ContractsService.normalizeContractData(rawDocWithDerived, 'c1');
    expect(normalized1.isNNCF).toBe(true);
    expect(normalized1.derived?.isNNCF).toBe(true);

    const rawDocWithoutNNCF = {
      id: 'c2',
      title: 'Contratto Beta',
      derived: { isNNCF: false }
    };
    const normalized2 = ContractsService.normalizeContractData(rawDocWithoutNNCF, 'c2');
    expect(normalized2.isNNCF).toBe(false);
    expect(normalized2.derived?.isNNCF).toBe(false);
  });

});
