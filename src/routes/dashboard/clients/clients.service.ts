import { db, doc, getDoc, collection, getDocs, query, where, limit, startAfter, orderBy, setDoc, updateDoc } from '$lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { ClientsVersioningBridge } from './clients.versioning.bridge';

export interface ClientsFetchResult {
  list: any[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export class ClientsService {
  static async getClient(id: string): Promise<any | null> {
    try {
      const snap = await getDoc(doc(db, 'clients', id));
      if (snap.exists()) {
        const data = snap.data();
        if (data.derived?.deleted) return null;
        return { id: snap.id, ...data };
      }
    } catch (e) {
      console.warn('Errore recupero cliente:', e);
    }
    return null;
  }

  static async getClients(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(db, 'clients'));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((c: any) => !c.derived?.deleted);
    } catch (e) {
      console.warn('Errore recupero lista clienti:', e);
      return [];
    }
  }

  static async deleteClient(id: string, uid?: string): Promise<{ success: boolean, error?: string }> {
    try {
      await updateDoc(doc(db, 'clients', id), {
        'derived.deleted': true,
        'edits.deletedAt': new Date().toISOString(),
        'edits.deletedBy': uid || 'system'
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async createClient(clientData: any, historyData: any, computedFiscalId: string, isCommerciale: boolean, uid: string, tenantId: string = 'default'): Promise<{ success: boolean, error?: string, id?: string }> {
    try {
      if (computedFiscalId) {
        let checkQuery;
        if (!isCommerciale) {
          checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', computedFiscalId));
        } else {
          checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', computedFiscalId), where('original.createdBy', '==', uid));
        }
        const snap = await getDocs(checkQuery);
        const activeMatches = snap.docs.filter(d => !d.data()?.derived?.deleted);
        if (activeMatches.length > 0) {
          return { success: false, error: 'Un cliente con questa Partita IVA o Codice Fiscale è già registrato.' };
        }
      }

      const clientId = clientData.id;
      const clientRef = doc(db, 'clients', clientId);

      const diff = computeDiff(null, clientData, {
        semanticsMap: ClientsVersioningBridge.getSemanticsMap()
      });

      const fullClientName = ClientsVersioningBridge.getEntityLabel(clientData);

      await VersioningService.executeDualWriteTransaction(
        db,
        clientRef,
        clientData,
        {
          tenantId,
          module: 'clients',
          entityType: 'client',
          entityId: clientId,
          entityLabel: fullClientName,
          eventType: 'FIELD_MUTATION',
          keysChanged: diff.keysChanged,
          mutations: diff.mutations,
          performedBy: uid,
          actorType: 'USER',
          reason: 'Creazione anagrafica cliente'
        },
        0
      );

      // Compatibilità legacy history se presente
      if (historyData && historyData.id) {
        try {
          await setDoc(doc(db, 'clients', clientId, 'history', historyData.id), historyData);
        } catch (e) {
          console.warn('Scrittura legacy history secondaria non riuscita:', e);
        }
      }
      
      return { success: true, id: clientId };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async fetchClients(
    searchVal: string | undefined,
    activeRole: string,
    myUid: string | undefined,
    itemsPerPage: number = 50,
    lastVisible: QueryDocumentSnapshot | null = null
  ): Promise<ClientsFetchResult> {
    const isComm = activeRole === 'commerciale';
    let q: any = collection(db, 'clients');

    if (searchVal && searchVal.trim()) {
      const term = searchVal.trim().toLowerCase();
      q = query(q, where('derived.textSearch', 'array-contains', term));
    }

    if (isComm && myUid) {
      q = query(q, where('original.createdBy', '==', myUid));
    }

    // Default order by createdAt desc
    q = query(q, orderBy('edits.createdAt', 'desc'));

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    q = query(q, limit(itemsPerPage));

    const snap = await getDocs(q);
    const clList: any[] = [];

    snap.forEach((doc: any) => {
      const data = doc.data();
      if (data.derived?.deleted) return;
      const orig = data.original || {};

      clList.push({
        id: doc.id,
        nome: orig.nome || orig.ragioneSociale || '',
        cognome: orig.cognome || '',
        email: orig.email || orig.emailContatto || '',
        phone: orig.phone || orig.mainPhone || '',
        status: orig.status || 'prospect',
        clientCode: orig.clientCode || orig.codiceCliente || '',
        clientGroup: orig.clientGroup || orig.gruppoCliente || '',
        certificationStatus: orig.certificationStatus || orig.statoCertificazione || '',
        isItalianSubject: orig.isItalianSubject !== undefined ? orig.isItalianSubject : true,
        partitaIva: orig.partitaIva || '',
        codiceFiscale: orig.codiceFiscale || '',
        sdiCode: orig.sdiCode || orig.codiceSdi || '',
        pec: orig.pec || '',
        paymentTerms: orig.paymentTerms || orig.condizioniPagamento || '',
        iban: orig.iban || '',
        referenteTecnico: orig.referenteTecnico || '',
        telReferente: orig.telReferente || '',
        emailContatto: orig.emailContatto || orig.email || '',
        emailAlternativa: orig.emailAlternativa || '',
        crifCheck: orig.crifCheck || orig.controlloCrif || '',
        riskClass: orig.riskClass || orig.classeRischio || '',
        maxCredit: orig.maxCredit || orig.fidoMassimo || 0,
        residualCredit: orig.residualCredit || orig.fidoResiduo || 0,
        paymentStatus: orig.paymentStatus || orig.statoPagamenti || 'Regolare',
        internalAdminNotes: orig.internalAdminNotes || orig.noteAmministrative || '',
        quoteAutoNotes: orig.quoteAutoNotes || orig.notePreventivo || '',
        notes: orig.notes || [],
        createdBy: orig.createdBy || '',
        createdAt: data.edits?.createdAt || orig.createdAt || new Date().toISOString(),
        derived: data.derived || {}
      });
    });

    const hasMore = snap.docs.length === itemsPerPage;
    const newLastDoc = snap.docs.length > 0 ? (snap.docs[snap.docs.length - 1] as unknown as QueryDocumentSnapshot) : null;

    return { list: clList, lastDoc: newLastDoc, hasMore };
  }
}
