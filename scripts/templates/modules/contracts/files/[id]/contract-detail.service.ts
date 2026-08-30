import { db, doc, getDoc, getDocs, updateDoc, setDoc, deleteDoc, collection, collectionGroup, query, where } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { ContractService } from '../ContractService';

export interface ContractDataPayload {
  contract: any;
  vendorQual: string;
  installmentsList: any[];
  paymentsList: any[];
  productsList: any[];
  usersList: any[];
}

export class ContractDetailService {
  static async fetchContractData(contractId: string): Promise<ContractDataPayload> {
    const payload: ContractDataPayload = {
      contract: null,
      vendorQual: 'junior',
      installmentsList: [],
      paymentsList: [],
      productsList: [],
      usersList: []
    };

    const contractDoc = await getDoc(doc(db, 'contracts', contractId));
    if (!contractDoc.exists()) {
      throw new Error('Impossibile trovare il contratto specificato.');
    }
    payload.contract = contractDoc.data();

    const vendorUid = payload.contract.original?.vendorUid;
    if (vendorUid) {
      const vendorDoc = await getDoc(doc(db, 'users', vendorUid));
      if (vendorDoc.exists()) {
        payload.vendorQual = vendorDoc.data()?.original?.qualification || 'junior';
      }
    }

    const instSnap = await getDocs(collection(db, 'contracts', contractId, 'installments'));
    const list: any[] = [];
    instSnap.forEach((d: any) => {
      list.push({ id: d.id, ...d.data()?.original });
    });
    payload.installmentsList = list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const paymentsSnap = await getDocs(
      query(collectionGroup(db, 'contractsPaid'), where('original.contractId', '==', contractId))
    );
    const payList: any[] = [];
    paymentsSnap.forEach((d: any) => {
      const data = d.data();
      payList.push({ id: d.id, ...data.original, edits: data.edits });
    });
    payload.paymentsList = payList.sort((a, b) => new Date(b.edits?.createdAt || 0).getTime() - new Date(a.edits?.createdAt || 0).getTime());

    const prodsSnap = await getDocs(collection(db, 'products'));
    const pList: any[] = [];
    prodsSnap.forEach((doc: any) => pList.push({ id: doc.id, ...doc.data().original }));
    payload.productsList = pList;

    const usersSnap = await getDocs(collection(db, 'users'));
    const uList: any[] = [];
    usersSnap.forEach((doc: any) => uList.push({ uid: doc.id, ...doc.data().original }));
    payload.usersList = uList;

    return payload;
  }

  static async approveOnly(contractId: string, uid: string, email: string) {
    await ContractService.approveContract(contractId, uid, email);
  }

  static async approveAndCollectFull(contractId: string, uid: string, email: string) {
    await ContractService.approveAndCollectFull(contractId, uid, email);
  }

  static async deleteContract(contractId: string, installmentsList: any[]) {
    for (const inst of installmentsList) {
      await deleteDoc(doc(db, 'contracts', contractId, 'installments', inst.id));
    }
    await deleteDoc(doc(db, 'contracts', contractId));
  }

  static async deleteInstallment(contractId: string, instId: string) {
    await deleteDoc(doc(db, 'contracts', contractId, 'installments', instId));
  }

  static async reopenContract(contractId: string, uid: string) {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contracts', contractId), {
      status: 'bozza',
      approvedAt: null,
      approvedBy: null,
      approvedEmail: null,
      'original.status': 'bozza',
      'original.approvedAt': null,
      'original.approvedBy': null,
      'original.approvedEmail': null,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }

  static async saveSignature(contractId: string, signatureDataUrl: string, uid: string) {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contracts', contractId), {
      signature: signatureDataUrl,
      'original.signature': signatureDataUrl,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }

  static async clearSignature(contractId: string, uid: string) {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contracts', contractId), {
      signature: null,
      'original.signature': null,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }

  static async addInstallment(contract: any, contractId: string, installmentDueDate: string, installmentExpectedAmount: number, uid: string, email: string) {
    const now = new Date().toISOString();
    const instId = generateId('inst');
    const clientId = contract?.original?.clientId || contract?.clientId || '';
    const clientName = contract?.original?.clientName || contract?.clientName || 'Cliente';
    const amountVal = Number(installmentExpectedAmount) || 0;
    
    const newInst = {
      original: {
        contractId,
        clientId,
        clientName,
        dueDate: installmentDueDate,
        expectedAmount: amountVal,
        status: 'pending',
        vendorUid: contract?.original?.vendorUid || contract?.agentId || null,
        secondVendorUid: contract?.original?.secondVendorUid || null
      },
      edits: {
        createdAt: now,
        createdBy: uid
      }
    };

    await setDoc(doc(db, 'contracts', contractId, 'installments', instId), newInst);
    
    let activityId = generateId('act');
    const actNotes = `Pianificata scadenza di recupero credito per €${(Number(amountVal) || 0).toFixed(2)} in data ${installmentDueDate}`;

    // 1. Dynamic delegation to ActivitiesService (Principle #18)
    try {
      const { ActivitiesService } = await import('../../activities/activities.service');
      activityId = await ActivitiesService.createActivity({
        title: 'Sollecito Email',
        description: actNotes,
        targetType: 'contract',
        targetId: contractId,
        targetName: contract?.title || contract?.contractNumber || 'Contratto',
        clientId,
        executionDate: installmentDueDate || now.slice(0, 10),
        priority: 'media',
        status: 'completata',
        category: 'crm',
        assignedUid: uid,
        assignedName: email || 'Operatore'
      }, {
        uid,
        displayName: email,
        tenantId: 'default'
      });
    } catch {
      // Fallback if activities module is inactive
    }

    // 2. Dual-write to subcollection for backward compatibility
    if (clientId) {
      await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
        original: {
          clientId,
          clientName,
          type: 'Sollecito Email',
          notes: actNotes,
          status: 'completata',
          loggedBy: uid,
          loggedEmail: email
        },
        edits: {
          createdAt: now,
          createdBy: uid
        }
      });
    }
  }

  static async postponeInstallment(contract: any, contractId: string, instId: string, newDate: string, uid: string, email: string) {
    const now = new Date().toISOString();
    const clientId = contract?.original?.clientId || contract?.clientId || '';
    const clientName = contract?.original?.clientName || contract?.clientName || 'Cliente';

    await updateDoc(doc(db, 'contracts', contractId, 'installments', instId), {
      'original.dueDate': newDate,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
    
    let activityId = generateId('act');
    const actNotes = `Posticipata scadenza pagamento al ${newDate}`;

    // 1. Dynamic delegation to ActivitiesService (Principle #18)
    try {
      const { ActivitiesService } = await import('../../activities/activities.service');
      activityId = await ActivitiesService.createActivity({
        title: 'Sollecito Telefonico',
        description: actNotes,
        targetType: 'contract',
        targetId: contractId,
        targetName: contract?.title || contract?.contractNumber || 'Contratto',
        clientId,
        executionDate: newDate || now.slice(0, 10),
        priority: 'media',
        status: 'completata',
        category: 'crm',
        assignedUid: uid,
        assignedName: email || 'Operatore'
      }, {
        uid,
        displayName: email,
        tenantId: 'default'
      });
    } catch {
      // Fallback
    }

    // 2. Dual-write to subcollection for backward compatibility
    if (clientId) {
      await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
        original: {
          clientId,
          clientName,
          type: 'Sollecito Telefonico',
          notes: actNotes,
          status: 'completata',
          loggedBy: uid,
          loggedEmail: email
        },
        edits: {
          createdAt: now,
          createdBy: uid
        }
      });
    }
  }

  static async collectInstallment(contractId: string, instId: string, actualAmount: number, uid: string, email: string, allocations: any[]) {
    await ContractService.collectInstallment(
      contractId, 
      instId, 
      actualAmount, 
      uid, 
      email,
      allocations
    );
  }

  static async saveEditedProducts(contractId: string, editQuoteItems: any[], editQuoteTotal: number, editSecondVendorUid: string, usersList: any[], editSecondVendorShare: number, uid: string) {
    const now = new Date().toISOString();
    const hasWarning = editQuoteItems.some(item => (Number(item.priceSold) || 0) < (Number(item.minPrice) || 0));
    const totalVal = Number(editQuoteTotal) || 0;
    
    let secondVendorEmail = '';
    if (editSecondVendorUid) {
      const found = usersList.find(u => u.uid === editSecondVendorUid);
      secondVendorEmail = found ? found.email : '';
    }

    await updateDoc(doc(db, 'contracts', contractId), {
      items: editQuoteItems,
      totalAmount: totalVal,
      hasWarning,
      secondVendorUid: editSecondVendorUid || null,
      secondVendorEmail: secondVendorEmail || null,
      secondVendorShare: editSecondVendorUid ? Number(editSecondVendorShare) : null,
      'original.products': editQuoteItems,
      'original.totalPrice': totalVal,
      'original.hasWarning': hasWarning,
      'original.secondVendorUid': editSecondVendorUid || null,
      'original.secondVendorEmail': secondVendorEmail || null,
      'original.secondVendorShare': editSecondVendorUid ? Number(editSecondVendorShare) : null,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }
}
