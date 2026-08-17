import { db, doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { AuditHistoryService } from '$lib/services/auditHistoryService';
import { VersioningService, computeDiff, type SystemLedgerEntry } from '$lib/services/versioningService';
import { ClientsVersioningBridge } from '../clients.versioning.bridge';

export interface ClientDataPayload {
  clientDerived: any;
  originalProfile: any;
  clientCreatedAt: string;
  productsList: any[];
  activitiesList: any[];
  historyList: any[];
  timelineList: SystemLedgerEntry[];
  aggregateVersion: number;
  contractsList: any[];
  quotesList: any[];
  usersList: any[];
  clientNotes: string[];
}

export class ClientDetailService {
  static async fetchClientData(clientId: string, activeModuleIds: string[] = []): Promise<ClientDataPayload> {
    const payload: ClientDataPayload = {
      clientDerived: {},
      originalProfile: {},
      clientCreatedAt: '',
      productsList: [],
      activitiesList: [],
      historyList: [],
      timelineList: [],
      aggregateVersion: 0,
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
      
      // Anagrafica & ERP additions
      clientCode: orig.clientCode || orig.codiceCliente || data.clientCode || '',
      clientGroup: orig.clientGroup || orig.gruppoCliente || data.clientGroup || '',
      certificationStatus: orig.certificationStatus || orig.statoCertificazione || data.certificationStatus || '',
      isItalianSubject: orig.isItalianSubject !== undefined ? orig.isItalianSubject : true,
      
      // SDI & Bank Data
      sdiCode: orig.sdiCode || data.sdiCode || orig.sdi_code || orig.codiceSdi || '',
      pec: orig.pec || data.pec || '',
      iban: orig.iban || data.iban || '',
      bankName: orig.bankName || data.bankName || '',
      paymentTerms: orig.paymentTerms || data.paymentTerms || orig.condizioniPagamento || '',
      mainPhone: orig.mainPhone || orig.telefonoCentralino || orig.phone || '',

      // Referenti Rapidi
      referenteTecnico: orig.referenteTecnico || '',
      telReferente: orig.telReferente || '',
      emailContatto: orig.emailContatto || orig.email || '',
      emailAlternativa: orig.emailAlternativa || '',

      // Affidabilità & Credito
      crifCheck: orig.crifCheck || orig.controlloCrif || 'NON ESEGUITO',
      riskClass: orig.riskClass || orig.classeRischio || 'AAA (Basso Rischio)',
      maxCredit: orig.maxCredit || orig.fidoMassimo || 0,
      residualCredit: orig.residualCredit || orig.fidoResiduo || 0,
      paymentStatus: orig.paymentStatus || orig.statoPagamenti || 'Regolare',

      // Note ERP
      internalAdminNotes: orig.internalAdminNotes || orig.noteAmministrative || '',
      quoteAutoNotes: orig.quoteAutoNotes || orig.notePreventivo || '',

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

    const [activitiesSnap, historySnap, usersSnap] = await Promise.all([
      safeGetDocs(collection(db, 'clients', clientId, 'activities')),
      safeGetDocs(collection(db, 'clients', clientId, 'history')),
      safeGetDocs(collection(db, 'users'))
    ]);

    const acts: any[] = [];
    if (activitiesSnap.forEach) {
      activitiesSnap.forEach((d: any) => {
        const act = d.data();
        acts.push({ id: d.id, ...act.original, edits: act.edits });
      });
    }
    payload.activitiesList = acts.sort((a, b) => new Date(b.edits?.createdAt || a.date).getTime() - new Date(a.edits?.createdAt || b.date).getTime());

    payload.historyList = await AuditHistoryService.getEntityHistory('clients', clientId);
    payload.timelineList = await VersioningService.getEntityTimeline(clientId);
    payload.aggregateVersion = (data.edits?.aggregateVersion as number) || 0;

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

  static async updateProfile(clientId: string, activeRole: string, originalProfile: any, newProfile: any, authObj: { uid: string, email: string, tenantId?: string }, expectedBaseVersion?: number) {
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
      'clientCode', 'clientGroup', 'certificationStatus', 'isItalianSubject',
      'sdiCode', 'pec', 'iban', 'bankName', 'paymentTerms', 'mainPhone',
      'referenteTecnico', 'telReferente', 'emailContatto', 'emailAlternativa',
      'crifCheck', 'riskClass', 'maxCredit', 'residualCredit', 'paymentStatus',
      'internalAdminNotes', 'quoteAutoNotes',
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

    const clientRef = doc(db, 'clients', clientId);
    const clientSnap = await getDoc(clientRef);
    const currentData = clientSnap.exists() ? clientSnap.data() : {};

    const nextEntityData = {
      ...currentData,
      original: {
        ...(currentData.original || {}),
        ...newOriginal
      },
      derived: {
        ...(currentData.derived || {}),
        textSearch: updatedTerms
      }
    };

    const diff = computeDiff(currentData, nextEntityData, {
      semanticsMap: ClientsVersioningBridge.getSemanticsMap()
    });

    if (diff.keysChanged.length > 0) {
      await VersioningService.executeDualWriteTransaction(
        db,
        clientRef,
        nextEntityData,
        {
          tenantId: authObj.tenantId || 'default',
          module: 'clients',
          entityType: 'client',
          entityId: clientId,
          entityLabel: fullClientName,
          eventType: 'FIELD_MUTATION',
          keysChanged: diff.keysChanged,
          mutations: diff.mutations,
          performedBy: authObj.uid,
          performedByName: authObj.email,
          actorType: 'USER',
          reason: 'Modifica scheda anagrafica cliente'
        },
        expectedBaseVersion !== undefined ? expectedBaseVersion : (currentData.edits?.aggregateVersion ?? 0)
      );
    }

    await CacheLookupService.updateClientCache(clientId, fullClientName);

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
