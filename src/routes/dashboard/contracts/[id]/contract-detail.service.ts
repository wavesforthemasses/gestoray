import { db, doc, getDoc, getDocs, updateDoc, setDoc, deleteDoc, collection, collectionGroup, query, where } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { ContractService } from '$lib/services/ContractService';

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
      'original.status': 'draft',
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
      'original.signature': signatureDataUrl,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }

  static async clearSignature(contractId: string, uid: string) {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contracts', contractId), {
      'original.signature': null,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }

  static async addInstallment(contract: any, contractId: string, installmentDueDate: string, installmentExpectedAmount: number, uid: string, email: string) {
    const now = new Date().toISOString();
    const instId = generateId('inst');
    
    const newInst = {
      original: {
        contractId,
        clientId: contract.original.clientId,
        clientName: contract.original.clientName,
        dueDate: installmentDueDate,
        expectedAmount: Number(installmentExpectedAmount),
        status: 'pending'
      },
      edits: {
        createdAt: now,
        createdBy: uid
      }
    };

    await setDoc(doc(db, 'contracts', contractId, 'installments', instId), newInst);
    
    const activityId = generateId('act');
    await setDoc(doc(db, 'clients', contract.original.clientId, 'activities', activityId), {
      original: {
        clientId: contract.original.clientId,
        clientName: contract.original.clientName,
        type: 'Sollecito Email',
        notes: `Pianificata scadenza di recupero credito per €${installmentExpectedAmount.toFixed(2)} in data ${installmentDueDate}`,
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

  static async postponeInstallment(contract: any, contractId: string, instId: string, newDate: string, uid: string, email: string) {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contracts', contractId, 'installments', instId), {
      'original.dueDate': newDate,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
    
    const activityId = generateId('act');
    await setDoc(doc(db, 'clients', contract.original.clientId, 'activities', activityId), {
      original: {
        clientId: contract.original.clientId,
        clientName: contract.original.clientName,
        type: 'Sollecito Telefonico',
        notes: `Posticipata scadenza pagamento al ${newDate}`,
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
    const hasWarning = editQuoteItems.some(item => item.priceSold < item.minPrice);
    
    let secondVendorEmail = '';
    if (editSecondVendorUid) {
      const found = usersList.find(u => u.uid === editSecondVendorUid);
      secondVendorEmail = found ? found.email : '';
    }

    await updateDoc(doc(db, 'contracts', contractId), {
      'original.products': editQuoteItems,
      'original.totalPrice': editQuoteTotal,
      'original.hasWarning': hasWarning,
      'original.secondVendorUid': editSecondVendorUid || null,
      'original.secondVendorEmail': secondVendorEmail || null,
      'original.secondVendorShare': editSecondVendorUid ? Number(editSecondVendorShare) : null,
      'edits.modifiedAt': now,
      'edits.modifiedBy': uid
    });
  }
}
