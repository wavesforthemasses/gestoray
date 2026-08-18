import { 
  db, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  collectionGroup,
  query,
  where,
  getDocs,
  collection
} from "$lib/firebase";
import { generateId } from "$lib/utils/helpers";

export class ContractService {
  static async getClientContracts(clientId: string): Promise<any[]> {
    try {
      const snap1 = await getDocs(query(collection(db, 'contracts'), where('clientId', '==', clientId)));
      const snap2 = await getDocs(query(collection(db, 'contracts'), where('original.clientId', '==', clientId)));
      
      const map = new Map();
      snap1.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
      snap2.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
      return Array.from(map.values());
    } catch (e) {
      console.error('Errore getClientContracts:', e);
      return [];
    }
  }

  static async getProjectContracts(projectId: string): Promise<any[]> {
    try {
      let list: any[] = [];
      const snap = await getDocs(query(collection(db, 'contracts'), where('projectId', '==', projectId)));
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));

      if (list.length === 0) {
        const legacySnap = await getDocs(query(collection(db, 'contracts'), where('cantiereId', '==', projectId)));
        legacySnap.forEach(d => list.push({ id: d.id, ...d.data() }));
      }
      return list;
    } catch (e) {
      console.error('Errore getProjectContracts:', e);
      return [];
    }
  }
  /**
   * Approves a contract, marking its status as approved.
   */
  static async approveContract(contractId: string, userId: string, userEmail: string): Promise<void> {
    const contractRef = doc(db, 'contracts', contractId);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) {
      throw new Error("Contract not found");
    }

    await updateDoc(contractRef, {
      'original.status': 'approved',
      'original.approvedAt': new Date().toISOString(),
      'original.approvedBy': userId,
      'original.approvedEmail': userEmail
    });
  }

  /**
   * Approves a contract and immediately registers a full payment for its entire value.
   * Auto-allocates the payment across all products according to their final price.
   */
  static async approveAndCollectFull(contractId: string, userId: string, userEmail: string): Promise<void> {
    const now = new Date().toISOString();
    const contractRef = doc(db, 'contracts', contractId);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) {
      throw new Error("Contract not found");
    }

    const cData = contractSnap.data();
    const clientId = cData.original.clientId;
    const clientName = cData.original.clientName;
    const amount = cData.original.totalPrice;
    const products = cData.original.products || [];

    // 1. Approve contract
    await updateDoc(contractRef, {
      'original.status': 'approved',
      'original.approvedAt': now,
      'original.approvedBy': userId,
      'original.approvedEmail': userEmail,
      'edits.modifiedAt': now,
      'edits.modifiedBy': userId
    });

    // 2. Create Payment
    const paymentId = generateId('pay');
    await setDoc(doc(db, 'payments', paymentId), {
      original: {
        clientId,
        clientName,
        contractId,
        amount,
        date: now,
        recordedBy: userId,
        recordedEmail: userEmail
      },
      edits: {
        createdAt: now,
        createdBy: userId
      }
    });

    // 3. Create full product allocations
    const fullAllocations = products.map((p: any) => ({
      productId: p.productId,
      amount: p.finalPrice || 0
    })).filter((a: any) => a.amount > 0);

    // 4. Register contractsPaid mapping
    await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', contractId), {
      original: {
        contractId,
        paymentId,
        amount,
        clientId,
        clientName,
        productAllocations: fullAllocations
      },
      edits: {
        createdAt: now,
        createdBy: userId
      }
    });

    // 5. Log activity
    const activityId = generateId('act');
    await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
      original: {
        clientId,
        clientName,
        type: 'Sollecito Telefonico',
        notes: `Contratto validato e saldo interamente registrato per €${amount.toFixed(2)}.`,
        date: now,
        loggedBy: userId,
        loggedEmail: userEmail,
        status: 'completata'
      },
      edits: {
        createdAt: now,
        createdBy: userId
      }
    });
  }

  /**
   * Collects an installment, creates a payment record, and maps allocations.
   * If productAllocations is not provided, it will attempt to calculate a proportional default.
   */
  static async collectInstallment(
    contractId: string, 
    installmentId: string, 
    actualAmount: number, 
    userId: string, 
    userEmail: string,
    productAllocations?: Array<{ productId: string, amount: number }>
  ): Promise<void> {
    const now = new Date().toISOString();
    
    // 1. Fetch parent contract info
    const contractRef = doc(db, 'contracts', contractId);
    const contractDoc = await getDoc(contractRef);
    
    if (!contractDoc.exists()) {
      throw new Error("Contract not found");
    }

    const cData = contractDoc.data();
    const clientId = cData.original.clientId;
    const clientName = cData.original.clientName;
    const products = cData.original.products || [];

    // 2. Determine product allocations if not provided
    let finalAllocations = productAllocations;
    if (!finalAllocations) {
      // Calculate remaining balances to auto-allocate
      const allPaymentsSnap = await getDocs(query(collectionGroup(db, 'contractsPaid'), where('original.contractId', '==', contractId)));
      const paidPerProduct: Record<string, number> = {};
      
      allPaymentsSnap.forEach((d: any) => {
        const allocs = d.data()?.original?.productAllocations || [];
        allocs.forEach((a: any) => {
          paidPerProduct[a.productId] = (paidPerProduct[a.productId] || 0) + a.amount;
        });
      });

      const productsStatus = products.map((p: any) => {
        const paid = paidPerProduct[p.productId] || 0;
        return {
          productId: p.productId,
          price: p.finalPrice,
          paid,
          remaining: p.finalPrice - paid
        };
      });

      const totalRemaining = productsStatus.reduce((acc: number, p: any) => acc + p.remaining, 0);

      if (totalRemaining > 0) {
        finalAllocations = productsStatus.map((p: any) => {
          const ratio = p.remaining / totalRemaining;
          return {
            productId: p.productId,
            amount: Number((actualAmount * ratio).toFixed(2))
          };
        });
        
        // Fix rounding issues
        if (finalAllocations) {
          const sum = finalAllocations.reduce((acc: any, curr: any) => acc + curr.amount, 0);
          if (Math.abs(sum - actualAmount) > 0.001 && finalAllocations.length > 0) {
            finalAllocations[0].amount += Number((actualAmount - sum).toFixed(2));
          }
        }
      } else {
        finalAllocations = [];
      }
    }

    // Filter out 0 amounts
    if (finalAllocations) finalAllocations = finalAllocations.filter((a: any) => a.amount > 0);

    // 3. Update installment status in subcollection
    await updateDoc(doc(db, 'contracts', contractId, 'installments', installmentId), {
      'original.status': 'paid',
      'original.paidAmount': actualAmount,
      'original.paidAt': now,
      'edits.modifiedAt': now,
      'edits.modifiedBy': userId
    });

    // 4. Register payment at top-level
    const paymentId = generateId('pay');
    await setDoc(doc(db, 'payments', paymentId), {
      original: {
        clientId,
        clientName,
        contractId, // Legacy backward compatibility, should use contractsPaid map
        amount: actualAmount,
        date: now,
        recordedBy: userId,
        recordedEmail: userEmail,
        installmentId
      },
      edits: {
        createdAt: now,
        createdBy: userId
      }
    });

    // 5. Register payment contractsPaid allocation
    await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', contractId), {
      original: {
        contractId,
        paymentId,
        amount: actualAmount,
        clientId,
        clientName,
        installmentId,
        productAllocations: finalAllocations
      },
      edits: {
        createdAt: now,
        createdBy: userId
      }
    });

    // 6. Log activity under client
    const activityId = generateId('act');
    await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
      original: {
        clientId,
        clientName,
        type: 'Sollecito Telefonico',
        notes: `Riscossa rata / recupero credito di €${actualAmount.toFixed(2)}.`,
        date: now,
        loggedBy: userId,
        loggedEmail: userEmail,
        status: 'completata'
      },
      edits: {
        createdAt: now,
        createdBy: userId
      }
    });
  }

  /**
   * Salva una bozza di preventivo (draft contract).
   */
  static async saveQuote(
    clientId: string,
    clientNameStr: string,
    quoteItems: any[],
    quoteTotal: number,
    authObj: { uid: string; email: string }
  ): Promise<string> {
    const contractId = generateId('contract');
    const now = new Date().toISOString();

    const newQuoteDraft = {
      original: {
        clientId,
        clientName: clientNameStr,
        vendorUid: authObj.uid,
        vendorEmail: authObj.email,
        products: quoteItems,
        totalPrice: quoteTotal,
        status: 'draft',
        hasWarning: quoteItems.some(item => item.priceSold < item.minPrice)
      },
      edits: {
        createdAt: now,
        createdBy: authObj.uid
      }
    };

    await setDoc(doc(db, 'contracts', contractId), newQuoteDraft);
    return contractId;
  }

  /**
   * Converte un preventivo in contratto in attesa di approvazione.
   */
  static async approveQuoteToContract(
    quoteId: string,
    clientId: string,
    coSeller: { uid: string; share: number } | undefined,
    activeRole: string,
    authObj: { uid: string; email: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contracts', quoteId), {
      'original.status': 'pending',
      ...(coSeller ? {
        'original.secondVendorUid': coSeller.uid,
        'original.secondVendorShare': coSeller.share
      } : {}),
      'edits.modifiedAt': now,
      'edits.modifiedBy': authObj.uid
    });
  }
}
