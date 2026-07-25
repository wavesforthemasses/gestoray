import { db, doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';

export interface ClientDataPayload {
  clientDerived: any;
  originalProfile: any;
  clientCreatedAt: string;
  productsList: any[];
  activitiesList: any[];
  historyList: any[];
  contractsList: any[];
  quotesList: any[];
  usersList: any[];
  clientNotes: string[];
}

export class ClientDetailService {
  static async fetchClientData(clientId: string): Promise<ClientDataPayload> {
    const payload: ClientDataPayload = {
      clientDerived: {},
      originalProfile: {},
      clientCreatedAt: '',
      productsList: [],
      activitiesList: [],
      historyList: [],
      contractsList: [],
      quotesList: [],
      usersList: [],
      clientNotes: []
    };

    const clientDoc = await getDoc(doc(db, 'clients', clientId));
    if (!clientDoc.exists()) {
      throw new Error('Il cliente specificato non esiste.');
    }
    const data = clientDoc.data();
    const orig = data.original || data || {};
    payload.clientDerived = data.derived || {};

    payload.originalProfile = {
      nome: orig.nome || orig.companyName || orig.ragioneSociale || orig.name || data.nome || data.companyName || data.ragioneSociale || data.name || '',
      cognome: orig.cognome || data.cognome || '',
      email: orig.email || data.email || '',
      phone: orig.phone || data.phone || '',
      createdBy: orig.createdBy || data.createdBy || '',
      status: orig.status || data.status || 'prospect',
      fiscalId: orig.fiscalId || data.fiscalId || '',
      partitaIva: orig.partitaIva || data.partitaIva || '',
      codiceFiscale: orig.codiceFiscale || data.codiceFiscale || ''
    };

    payload.clientNotes = orig.notes || [];
    payload.clientCreatedAt = data.edits?.createdAt || orig.createdAt || '';

    // Helper per recupero sicuro ed agnostico dai vari moduli (architettura a micro-servizi pluggabili)
    const safeGetDocs = async (queryOrCol: any) => {
      try {
        return await getDocs(queryOrCol);
      } catch (err) {
        // Se un modulo opzionale non è presente o non è abilitato per il ruolo, non blocca l'anagrafica cliente
        return { docs: [], forEach: () => {} };
      }
    };

    const [productsSnap, activitiesSnap, historySnap, contractsSnap, usersSnap] = await Promise.all([
      safeGetDocs(collection(db, 'products')),
      safeGetDocs(collection(db, 'clients', clientId, 'activities')),
      safeGetDocs(collection(db, 'clients', clientId, 'history')),
      safeGetDocs(query(collection(db, 'contracts'), where('original.clientId', '==', clientId))),
      safeGetDocs(collection(db, 'users'))
    ]);

    const prods: any[] = [];
    if (productsSnap.forEach) {
      productsSnap.forEach((d: any) => {
        const p = d.data()?.original || d.data();
        prods.push({
          id: d.id,
          name: p.name,
          listPrice: p.listPrice,
          minPrice: p.minPrice
        });
      });
    }
    payload.productsList = prods;

    const contracts: any[] = [];
    const quotes: any[] = [];
    if (contractsSnap.forEach) {
      contractsSnap.forEach((d: any) => {
        const c = d.data();
        const docData = { id: d.id, ...c.original, edits: c.edits, derived: c.derived };
        if (c.original?.status === 'draft') {
          quotes.push(docData);
        } else {
          contracts.push(docData);
        }
      });
    }
    payload.contractsList = contracts.sort((a, b) => new Date(b.edits?.createdAt || 0).getTime() - new Date(a.edits?.createdAt || 0).getTime());
    payload.quotesList = quotes.sort((a, b) => new Date(b.edits?.createdAt || 0).getTime() - new Date(a.edits?.createdAt || 0).getTime());

    const acts: any[] = [];
    if (activitiesSnap.forEach) {
      activitiesSnap.forEach((d: any) => {
        const act = d.data();
        acts.push({ id: d.id, ...act.original, edits: act.edits });
      });
    }
    payload.activitiesList = acts.sort((a, b) => new Date(b.edits?.createdAt || a.date).getTime() - new Date(a.edits?.createdAt || b.date).getTime());

    const histories: any[] = [];
    if (historySnap.forEach) {
      historySnap.forEach((d: any) => {
        const h = d.data();
        histories.push({ id: d.id, ...h.original, edits: h.edits });
      });
    }
    payload.historyList = histories.sort((a, b) => {
      const timeB = new Date(b.edits?.createdAt || b.createdAt || 0).getTime();
      const timeA = new Date(a.edits?.createdAt || a.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const uList: any[] = [];
    if (usersSnap.forEach) {
      usersSnap.forEach((d: any) => {
        const u = d.data()?.original || d.data();
        uList.push({ uid: d.id, ...u });
      });
    }
    payload.usersList = uList;

    return payload;
  }

  static async updateProfile(clientId: string, activeRole: string, originalProfile: any, newProfile: any, authObj: { uid: string, email: string }) {
    const isDirezione = activeRole === 'direzione';

    if (!isDirezione) {
      const checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', newProfile.fiscalId));
      const checkSnap = await getDocs(checkQuery);
      const otherWithSameId = checkSnap.docs.some((d: any) => d.id !== clientId);
      if (otherWithSameId) {
        throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
      }
    }

    const now = new Date().toISOString();
    
    const fields = ['nome', 'cognome', 'email', 'phone', 'status', 'fiscalId', 'partitaIva', 'codiceFiscale'];
    const newOriginal: any = {};
    fields.forEach(f => {
      newOriginal[f] = isDirezione ? originalProfile[f] : newProfile[f];
    });

    const fullClientName = `${newOriginal.nome || ''} ${newOriginal.cognome || ''}`.trim();
    const updatedTerms = generateSearchTerms(fullClientName, newOriginal.partitaIva, newOriginal.codiceFiscale, newOriginal.email);

    await updateDoc(doc(db, 'clients', clientId), {
      'original.nome': newOriginal.nome,
      'original.cognome': newOriginal.cognome,
      'original.email': newOriginal.email,
      'original.phone': newOriginal.phone,
      'original.status': newOriginal.status,
      'original.fiscalId': newOriginal.fiscalId,
      'original.partitaIva': newOriginal.partitaIva,
      'original.codiceFiscale': newOriginal.codiceFiscale,
      'original.createdBy': newProfile.createdBy,
      'derived.textSearch': updatedTerms,
      'edits.modifiedAt': now,
      'edits.modifiedBy': authObj.uid
    });

    await CacheLookupService.updateClientCache(clientId, fullClientName);

    const changes: Record<string, { oldVal: any, newVal: any }> = {};
    let hasChanges = false;

    fields.forEach(f => {
      const oldVal = originalProfile[f] || '';
      const newVal = newOriginal[f] || '';
      if (oldVal !== newVal) {
        changes[f] = { oldVal, newVal };
        hasChanges = true;
      }
    });

    if (hasChanges) {
      const historyId = generateId('audit');
      await setDoc(doc(db, 'clients', clientId, 'history', historyId), {
        original: {
          clientId,
          updatedBy: authObj.uid,
          updatedEmail: authObj.email,
          changes
        },
        edits: {
          createdAt: now
        }
      });
    }

    return newOriginal;
  }

  static async deleteClient(clientId: string, activitiesList: any[], historyList: any[]) {
    for (const act of activitiesList) {
      try {
        await deleteDoc(doc(db, 'clients', clientId, 'activities', act.id));
      } catch (e) {}
    }
    for (const hist of historyList) {
      try {
        await deleteDoc(doc(db, 'clients', clientId, 'history', hist.id));
      } catch (e) {}
    }
    
    try {
      const contractsSnap = await getDocs(query(collection(db, 'contracts'), where('original.clientId', '==', clientId)));
      for (const cDoc of contractsSnap.docs) {
        const installmentsSnap = await getDocs(collection(db, 'contracts', cDoc.id, 'installments'));
        for (const instDoc of installmentsSnap.docs) {
          await deleteDoc(doc(db, 'contracts', cDoc.id, 'installments', instDoc.id));
        }
        await deleteDoc(doc(db, 'contracts', cDoc.id));
      }
    } catch (e) {}

    try {
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('original.clientId', '==', clientId)));
      for (const pDoc of paymentsSnap.docs) {
        const allocationsSnap = await getDocs(collection(db, 'payments', pDoc.id, 'contractsPaid'));
        for (const allocDoc of allocationsSnap.docs) {
          await deleteDoc(doc(db, 'payments', pDoc.id, 'contractsPaid', allocDoc.id));
        }
        await deleteDoc(doc(db, 'payments', pDoc.id));
      }
    } catch (e) {}

    await deleteDoc(doc(db, 'clients', clientId));
  }

  static async addNote(clientId: string, clientNotes: string[], noteText: string, authObj: { uid: string, email: string }) {
    const noteObject = {
      text: noteText,
      createdAt: new Date().toISOString(),
      createdByEmail: authObj.email
    };

    const updatedNotes = [...clientNotes, JSON.stringify(noteObject)];
    await updateDoc(doc(db, 'clients', clientId), {
      'original.notes': updatedNotes,
      'edits.modifiedAt': new Date().toISOString(),
      'edits.modifiedBy': authObj.uid
    });
  }

  static async logActivity(
    clientId: string, 
    clientNameStr: string, 
    clientStatus: string, 
    type: string, 
    notes: string, 
    datetimeVal: string | undefined, 
    authObj: { uid: string, email: string }
  ) {
    const activityId = generateId('act');
    const activityDate = datetimeVal || new Date().toISOString();
    
    const terms = generateSearchTerms(clientNameStr + ' ' + type + ' ' + notes + ' ' + authObj.email);

    await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
      original: {
        clientId,
        clientName: clientNameStr,
        type,
        notes,
        date: activityDate,
        loggedBy: authObj.uid,
        loggedEmail: authObj.email,
        status: 'completata'
      },
      edits: {
        createdAt: activityDate,
        createdBy: authObj.uid
      },
      derived: {
        textSearch: terms
      }
    });

    if (clientStatus === 'prospect') {
      await updateDoc(doc(db, 'clients', clientId), {
        'original.status': 'contacted'
      });
    }
    
    return activityId;
  }

  static async updateActivity(
    clientId: string,
    activityId: string,
    payload: { notes?: string, date?: string }
  ) {
    const docRef = doc(db, 'clients', clientId, 'activities', activityId);
    const updates: any = {
      'edits.modifiedAt': new Date().toISOString()
    };
    if (payload.notes !== undefined) {
      updates['original.notes'] = payload.notes;
    }
    if (payload.date !== undefined) {
      updates['original.date'] = payload.date;
    }

    await updateDoc(docRef, updates);
  }

  static async saveQuote(
    clientId: string, 
    clientNameStr: string, 
    clientEmail: string, 
    clientStatus: string, 
    quoteItems: any[], 
    quoteTotal: number, 
    secondVendorUid: string, 
    secondVendorEmail: string, 
    secondVendorShare: number, 
    authObj: { uid: string, email: string }
  ) {
    const contractId = generateId('contract');
    const now = new Date().toISOString();

    const newQuoteDraft = {
      original: {
        clientId,
        clientName: clientNameStr,
        clientEmail,
        vendorUid: authObj.uid,
        vendorEmail: authObj.email,
        products: quoteItems,
        totalPrice: quoteTotal,
        status: 'draft',
        hasWarning: quoteItems.some(item => item.priceSold < item.minPrice),
        ...(secondVendorUid ? {
          secondVendorUid,
          secondVendorEmail,
          secondVendorShare: Number(secondVendorShare)
        } : {})
      },
      edits: {
        createdAt: now,
        createdBy: authObj.uid
      }
    };

    await setDoc(doc(db, 'contracts', contractId), newQuoteDraft);
    
    if (clientStatus === 'prospect') {
      await updateDoc(doc(db, 'clients', clientId), {
        'original.status': 'proposal_sent'
      });
    }
  }

  static async convertToContract(
    clientId: string, 
    clientNameStr: string, 
    clientEmail: string, 
    clientStatus: string, 
    quoteItems: any[], 
    secondVendorUid: string, 
    secondVendorEmail: string, 
    secondVendorShare: number, 
    authObj: { uid: string, email: string },
    quoteId?: string
  ) {
    const hasWarning = quoteItems.some(item => item.priceSold < item.minPrice);
    const totalContractPrice = quoteItems.reduce((sum, item) => sum + item.priceSold * item.quantity, 0);
    const now = new Date().toISOString();

    if (quoteId) {
      await updateDoc(doc(db, 'contracts', quoteId), {
        'original.status': 'pending',
        'original.totalPrice': totalContractPrice,
        'original.products': quoteItems,
        'original.hasWarning': hasWarning,
        'original.secondVendorUid': secondVendorUid || null,
        'original.secondVendorEmail': secondVendorEmail || null,
        'original.secondVendorShare': secondVendorUid ? Number(secondVendorShare) : null,
        'edits.modifiedAt': now,
        'edits.modifiedBy': authObj.uid
      });
    } else {
      const contractId = generateId('contract');
      const newContract = {
        original: {
          clientId,
          clientName: clientNameStr,
          clientEmail,
          vendorUid: authObj.uid,
          vendorEmail: authObj.email,
          totalPrice: totalContractPrice,
          products: quoteItems,
          status: 'pending',
          hasWarning,
          ...(secondVendorUid ? {
            secondVendorUid,
            secondVendorEmail,
            secondVendorShare: Number(secondVendorShare)
          } : {})
        },
        edits: {
          createdAt: now,
          createdBy: authObj.uid
        }
      };
      await setDoc(doc(db, 'contracts', contractId), newContract);
    }

    if (clientStatus === 'prospect') {
      await updateDoc(doc(db, 'clients', clientId), {
        'original.status': 'proposal_sent'
      });
    }
  }
}
