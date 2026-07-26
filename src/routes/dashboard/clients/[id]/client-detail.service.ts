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
      website: orig.website || data.website || '',
      createdBy: orig.createdBy || data.createdBy || '',
      assignedAdminId: orig.assignedAdminId || data.assignedAdminId || orig.createdBy || data.createdBy || '',
      status: orig.status || data.status || 'prospect',
      fiscalId: orig.fiscalId || data.fiscalId || '',
      partitaIva: orig.partitaIva || data.partitaIva || '',
      codiceFiscale: orig.codiceFiscale || data.codiceFiscale || '',
      
      // SDI & Bank Data
      sdiCode: orig.sdiCode || data.sdiCode || orig.sdi_code || '',
      pec: orig.pec || data.pec || '',
      iban: orig.iban || data.iban || '',
      bankName: orig.bankName || data.bankName || '',
      paymentTerms: orig.paymentTerms || data.paymentTerms || '',

      // Sede Principale
      address: orig.address || data.address || '',
      city: orig.city || data.city || '',
      province: orig.province || data.province || '',
      postalCode: orig.postalCode || data.postalCode || '',
      country: orig.country || data.country || 'Italy',

      // Fatturazione
      billingAddress: orig.billingAddress || data.billingAddress || orig.address || data.address || '',
      billingCity: orig.billingCity || data.billingCity || orig.city || data.city || '',
      billingProvince: orig.billingProvince || data.billingProvince || orig.province || data.province || '',
      billingPostalCode: orig.billingPostalCode || data.billingPostalCode || orig.postalCode || data.postalCode || '',
      billingCountry: orig.billingCountry || data.billingCountry || orig.country || data.country || 'Italy',

      // Spedizione
      shippingAddress: orig.shippingAddress || data.shippingAddress || orig.billingAddress || data.billingAddress || orig.address || data.address || '',
      shippingCity: orig.shippingCity || data.shippingCity || orig.billingCity || data.billingCity || orig.city || data.city || '',
      shippingProvince: orig.shippingProvince || data.shippingProvince || orig.billingProvince || data.billingProvince || orig.province || data.province || '',
      shippingPostalCode: orig.shippingPostalCode || data.shippingPostalCode || orig.billingPostalCode || data.billingPostalCode || orig.postalCode || data.postalCode || '',
      shippingCountry: orig.shippingCountry || data.shippingCountry || orig.billingCountry || data.billingCountry || orig.country || data.country || 'Italy'
    };

    payload.clientNotes = orig.notes || [];
    payload.clientCreatedAt = data.edits?.createdAt || orig.createdAt || '';

    const safeGetDocs = async (queryOrCol: any) => {
      try {
        return await getDocs(queryOrCol);
      } catch (err) {
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

    if (!isDirezione && newProfile.fiscalId && newProfile.fiscalId.trim()) {
      const checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', newProfile.fiscalId.trim()));
      const checkSnap = await getDocs(checkQuery);
      const otherWithSameId = checkSnap.docs.some((d: any) => d.id !== clientId);
      if (otherWithSameId) {
        throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
      }
    }

    const now = new Date().toISOString();
    
    const fields = [
      'nome', 'cognome', 'email', 'phone', 'website', 'status', 'fiscalId', 'partitaIva', 'codiceFiscale',
      'sdiCode', 'pec', 'iban', 'bankName', 'paymentTerms',
      'address', 'city', 'province', 'postalCode', 'country',
      'billingAddress', 'billingCity', 'billingProvince', 'billingPostalCode', 'billingCountry',
      'shippingAddress', 'shippingCity', 'shippingProvince', 'shippingPostalCode', 'shippingCountry',
      'createdBy', 'assignedAdminId'
    ];

    const newOriginal: any = {};
    fields.forEach(f => {
      newOriginal[f] = isDirezione ? (originalProfile[f] || '') : (newProfile[f] !== undefined ? newProfile[f] : (originalProfile[f] || ''));
    });

    const fullClientName = `${newOriginal.nome || ''} ${newOriginal.cognome || ''}`.trim();
    const updatedTerms = generateSearchTerms(fullClientName, newOriginal.partitaIva || '', newOriginal.codiceFiscale || '', newOriginal.email || '');

    const updatePayload: Record<string, any> = {
      'derived.textSearch': updatedTerms,
      'edits.modifiedAt': now,
      'edits.modifiedBy': authObj.uid
    };

    fields.forEach(f => {
      updatePayload[`original.${f}`] = newOriginal[f];
    });

    await updateDoc(doc(db, 'clients', clientId), updatePayload);

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

  static async deleteClientCascade(clientId: string) {
    try {
      const activitiesSnap = await getDocs(collection(db, 'clients', clientId, 'activities'));
      for (const docItem of activitiesSnap.docs) {
        await deleteDoc(doc(db, 'clients', clientId, 'activities', docItem.id));
      }
    } catch (e) {}

    try {
      const historySnap = await getDocs(collection(db, 'clients', clientId, 'history'));
      for (const docItem of historySnap.docs) {
        await deleteDoc(doc(db, 'clients', clientId, 'history', docItem.id));
      }
    } catch (e) {}

    await deleteDoc(doc(db, 'clients', clientId));
  }

  static async deleteClient(clientId: string, activitiesList: any[], historyList: any[]) {
    await this.deleteClientCascade(clientId);
  }

  static async addNote(clientId: string, noteText: string, authorEmail: string) {
    const noteObject = {
      text: noteText,
      createdAt: new Date().toISOString(),
      createdByEmail: authorEmail
    };

    const clientDoc = await getDoc(doc(db, 'clients', clientId));
    const currentNotes = clientDoc.data()?.original?.notes || [];
    const updatedNotes = [...currentNotes, JSON.stringify(noteObject)];

    await updateDoc(doc(db, 'clients', clientId), {
      'original.notes': updatedNotes,
      'edits.modifiedAt': new Date().toISOString()
    });

    return updatedNotes;
  }

  static async logActivity(
    clientId: string,
    notes: string,
    appointmentDate: string | undefined,
    authObj: { uid: string, email: string }
  ) {
    const activityId = generateId('act');
    const activityDate = appointmentDate || new Date().toISOString();

    await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
      original: {
        clientId,
        type: 'Nota / Attività',
        notes,
        date: activityDate,
        loggedBy: authObj.uid,
        loggedEmail: authObj.email,
        status: 'completata'
      },
      edits: {
        createdAt: activityDate,
        createdBy: authObj.uid
      }
    });

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
    quoteItems: any[],
    quoteTotal: number,
    authObj: { uid: string, email: string }
  ) {
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
  }

  static async approveQuoteToContract(
    quoteId: string,
    clientId: string,
    coSeller: { uid: string, share: number } | undefined,
    activeRole: string,
    authObj: { uid: string, email: string }
  ) {
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
