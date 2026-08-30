import { db, doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { AuditHistoryService } from '$lib/services/auditHistoryService';
import { VersioningService, computeDiff, type SystemLedgerEntry } from '$lib/services/versioningService';
import { ClientsVersioningBridge } from '../clients.versioning.bridge';
import { ClientsService } from '../clients.service';
import type { ClientOriginal, ClientDerived } from '../schema';

export interface ClientDataPayload {
  clientDerived: ClientDerived;
  originalProfile: ClientOriginal;
  clientCreatedAt: string;
  activitiesList: any[];
  historyList: any[];
  timelineList: SystemLedgerEntry[];
  aggregateVersion: number;
  usersList: any[];
  clientNotes: string[];
}

export class ClientDetailService {
  /**
   * Recupera i dati anagrafici completi, lo storico audit, le attività e gli utenti per la scheda cliente.
   */
  static async fetchClientData(clientId: string, activeModuleIds: string[] = []): Promise<ClientDataPayload> {
    const clientDoc = await getDoc(doc(db, 'clients', clientId));
    if (!clientDoc.exists()) {
      throw new Error('Il cliente specificato non esiste.');
    }
    const data = clientDoc.data();
    if (data.derived?.deleted) {
      throw new Error('Questa anagrafica cliente è stata eliminata.');
    }
    const orig: ClientOriginal = data.original || data || {};
    const clientDerived: ClientDerived = data.derived || {};

    const originalProfile: ClientOriginal = {
      nome: orig.nome || '',
      cognome: orig.cognome || '',
      email: orig.email || '',
      phone: orig.phone || '',
      website: orig.website || '',
      createdBy: orig.createdBy || '',
      assignedAdminId: orig.assignedAdminId || orig.createdBy || '',
      status: orig.status || 'prospect',
      fiscalId: orig.fiscalId || '',
      partitaIva: orig.partitaIva || '',
      codiceFiscale: orig.codiceFiscale || '',

      // Anagrafica & ERP additions
      clientCode: orig.clientCode || '',
      clientGroup: orig.clientGroup || 'Standard',
      certificationStatus: orig.certificationStatus || 'in_attesa',
      isItalianSubject: orig.isItalianSubject !== undefined ? orig.isItalianSubject : true,

      // SDI & Bank Data
      sdiCode: orig.sdiCode || '',
      pec: orig.pec || '',
      iban: orig.iban || '',
      bankName: orig.bankName || '',
      paymentTerms: orig.paymentTerms || '',
      mainPhone: orig.mainPhone || orig.phone || '',

      // Referenti Rapidi
      referenteTecnico: orig.referenteTecnico || '',
      telReferente: orig.telReferente || '',
      emailContatto: orig.emailContatto || orig.email || '',
      emailAlternativa: orig.emailAlternativa || '',

      // Affidabilità & Credito
      crifCheck: orig.crifCheck || 'NON ESEGUITO',
      riskClass: orig.riskClass || 'AAA (Basso Rischio)',
      maxCredit: orig.maxCredit || 0,
      residualCredit: orig.residualCredit || 0,
      paymentStatus: orig.paymentStatus || 'Regolare',

      // Note ERP
      internalAdminNotes: orig.internalAdminNotes || '',
      quoteAutoNotes: orig.quoteAutoNotes || '',
      notes: orig.notes || [],

      // Sede Principale / Operativa
      address: orig.address || '',
      city: orig.city || '',
      province: orig.province || '',
      postalCode: orig.postalCode || '',
      country: orig.country || 'Italy',

      // Sede Legale / Fatturazione
      billingAddress: orig.billingAddress || orig.address || '',
      billingCity: orig.billingCity || orig.city || '',
      billingProvince: orig.billingProvince || orig.province || '',
      billingPostalCode: orig.billingPostalCode || orig.postalCode || '',
      billingCountry: orig.billingCountry || orig.country || 'Italy',

      // Sede Spedizione / Cantiere
      shippingAddress: orig.shippingAddress || orig.billingAddress || orig.address || '',
      shippingCity: orig.shippingCity || orig.billingCity || orig.city || '',
      shippingProvince: orig.shippingProvince || orig.billingProvince || orig.province || '',
      shippingPostalCode: orig.shippingPostalCode || orig.billingPostalCode || orig.postalCode || '',
      shippingCountry: orig.shippingCountry || orig.billingCountry || orig.country || 'Italy'
    };

    const clientNotes = orig.notes || [];
    const clientCreatedAt = data.edits?.createdAt || '';

    const safeGetDocs = async (queryOrCol: any) => {
      try {
        return await getDocs(queryOrCol);
      } catch (err) {
        return { docs: [], forEach: () => {} };
      }
    };

    const [subActsSnap, rootTargetSnap, rootClientSnap, usersSnap] = await Promise.all([
      safeGetDocs(collection(db, 'clients', clientId, 'activities')),
      safeGetDocs(query(collection(db, 'activities'), where('targetId', '==', clientId))),
      safeGetDocs(query(collection(db, 'activities'), where('clientId', '==', clientId))),
      safeGetDocs(collection(db, 'users'))
    ]);

    const actsMap = new Map<string, any>();
    const processDoc = (d: any) => {
      if (!d || !d.data) return;
      const act = d.data();
      if (act.derived?.deleted || act.deleted) return;
      const id = d.id;
      const orig = act.original || {};
      const merged = {
        id,
        type: orig.type || act.activityType || act.type || act.category || 'Attività',
        notes: orig.notes || act.description || act.notes || act.title || '',
        date: orig.date || act.executionDate || act.dueDate || act.createdAt || act.edits?.createdAt || '',
        loggedBy: orig.loggedBy || act.assignedUid || act.loggedBy || act.edits?.createdBy || '',
        loggedEmail: orig.loggedEmail || act.loggedEmail || '',
        status: orig.status || act.status || 'completata',
        title: act.title || orig.title || '',
        activityNumber: act.activityNumber || orig.activityNumber || '',
        edits: act.edits || orig.edits || {}
      };
      actsMap.set(id, merged);
    };

    if (subActsSnap.docs) subActsSnap.docs.forEach(processDoc);
    if (rootTargetSnap.docs) rootTargetSnap.docs.forEach(processDoc);
    if (rootClientSnap.docs) rootClientSnap.docs.forEach(processDoc);

    const activitiesList = Array.from(actsMap.values()).sort(
      (a, b) => new Date(b.edits?.createdAt || b.date || 0).getTime() - new Date(a.edits?.createdAt || a.date || 0).getTime()
    );

    const historyList = await AuditHistoryService.getEntityHistory('clients', clientId);
    const timelineList = await VersioningService.getEntityTimeline(clientId);
    const aggregateVersion = (data.edits?.aggregateVersion as number) || 0;

    const uList: any[] = [];
    if (usersSnap.forEach) {
      usersSnap.forEach((d: any) => {
        const u = d.data()?.original || d.data();
        uList.push({ uid: d.id, ...u });
      });
    }

    return {
      clientDerived,
      originalProfile,
      clientCreatedAt,
      activitiesList,
      historyList,
      timelineList,
      aggregateVersion,
      usersList: uList,
      clientNotes
    };
  }

  /**
   * Aggiorna la scheda anagrafica cliente con validazione duplicati e transazione atomica dual-write (OCC).
   */
  static async updateProfile(
    clientId: string,
    activeRole: string,
    originalProfile: ClientOriginal,
    newProfile: ClientOriginal,
    authObj: { uid: string; email: string; tenantId?: string },
    expectedBaseVersion?: number
  ): Promise<ClientOriginal> {
    const isDirezione = activeRole === 'direzione';

    const computedFiscalId = (newProfile.partitaIva?.trim() || newProfile.codiceFiscale?.trim() || newProfile.fiscalId?.trim() || '');
    newProfile.fiscalId = computedFiscalId;

    if (!isDirezione && computedFiscalId) {
      const checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', computedFiscalId));
      const checkSnap = await getDocs(checkQuery);
      const otherWithSameId = checkSnap.docs.some((d: any) => d.id !== clientId && !d.data()?.derived?.deleted);
      if (otherWithSameId) {
        throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
      }
    }

    const fields: (keyof ClientOriginal)[] = [
      'nome',
      'cognome',
      'email',
      'phone',
      'website',
      'status',
      'fiscalId',
      'partitaIva',
      'codiceFiscale',
      'clientCode',
      'clientGroup',
      'certificationStatus',
      'isItalianSubject',
      'sdiCode',
      'pec',
      'iban',
      'bankName',
      'paymentTerms',
      'mainPhone',
      'referenteTecnico',
      'telReferente',
      'emailContatto',
      'emailAlternativa',
      'crifCheck',
      'riskClass',
      'maxCredit',
      'residualCredit',
      'paymentStatus',
      'internalAdminNotes',
      'quoteAutoNotes',
      'address',
      'city',
      'province',
      'postalCode',
      'country',
      'billingAddress',
      'billingCity',
      'billingProvince',
      'billingPostalCode',
      'billingCountry',
      'shippingAddress',
      'shippingCity',
      'shippingProvince',
      'shippingPostalCode',
      'shippingCountry',
      'createdBy',
      'assignedAdminId'
    ];

    const newOriginal: any = {};
    fields.forEach((f) => {
      newOriginal[f] = isDirezione
        ? originalProfile[f] ?? ''
        : newProfile[f] !== undefined
          ? newProfile[f]
          : (originalProfile[f] ?? '');
    });

    const fullClientName = (newOriginal.nome || newOriginal.ragioneSociale || newOriginal.cognome || '').trim();
    const updatedTerms = generateSearchTerms(
      newOriginal.nome || '',
      newOriginal.cognome || '',
      newOriginal.partitaIva || '',
      newOriginal.codiceFiscale || '',
      newOriginal.email || newOriginal.emailContatto || ''
    );

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

    try {
      await CacheLookupService.updateClientCache(clientId, fullClientName);
    } catch (e) {
      // Ignora avviso cache se eseguito in modalità client-restricted
    }

    return newOriginal as ClientOriginal;
  }

  /**
   * Esegue il soft delete dell'anagrafica cliente delegando al ClientsService canonico.
   */
  static async deleteClient(clientId: string, uid?: string): Promise<{ success: boolean; error?: string }> {
    return await ClientsService.deleteClient(clientId, uid);
  }

  /**
   * Aggiunge una nota interna all'anagrafica cliente.
   */
  static async addNote(clientId: string, noteText: string, authorEmail: string): Promise<string[]> {
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

  /**
   * Registra un'attività rapida nella sotto-collezione activities del cliente.
   */
  static async logActivity(
    clientId: string,
    activityType: string,
    notes: string,
    appointmentDate: string | undefined,
    authObj: { uid: string; email: string; tenantId?: string; displayName?: string }
  ): Promise<string> {
    let activityId = generateId('act');
    const activityDate = appointmentDate || new Date().toISOString();

    // 1. Dynamic delegation to ActivitiesService on root collection (Principle #18)
    try {
      const { ActivitiesService } = await import('../../activities/activities.service');
      activityId = await ActivitiesService.createActivity({
        title: activityType || 'Nota / Attività',
        description: notes || activityType,
        targetType: 'client',
        targetId: clientId,
        targetName: '',
        clientId,
        executionDate: activityDate.slice(0, 10),
        priority: 'media',
        status: 'completata',
        category: 'crm',
        assignedUid: authObj.uid,
        assignedName: authObj.displayName || authObj.email || 'Operatore'
      }, {
        uid: authObj.uid,
        displayName: authObj.displayName || authObj.email,
        tenantId: authObj.tenantId || 'default'
      });
    } catch {
      // Fallback
    }

    // 2. Dual-write to subcollection for backward compatibility
    await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
      original: {
        clientId,
        type: activityType || 'Nota / Attività',
        notes: notes || activityType,
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

    try {
      const clientRef = doc(db, 'clients', clientId);
      const snap = await getDoc(clientRef);
      if (snap.exists()) {
        const currentCount = snap.data()?.derived?.activitiesCount || 0;
        await updateDoc(clientRef, {
          'derived.activitiesCount': currentCount + 1,
          'derived.lastActivityDate': activityDate,
          'edits.modifiedAt': new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Aggiornamento derived activitiesCount:', e);
    }

    return activityId;
  }

  /**
   * Aggiorna un'attività esistente.
   */
  static async updateActivity(
    clientId: string,
    activityId: string,
    payload: { notes?: string; date?: string }
  ): Promise<void> {
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
}
