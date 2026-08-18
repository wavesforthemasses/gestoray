import { db, doc, getDoc, collection, getDocs, query, where, limit, startAfter, orderBy, setDoc, updateDoc } from '$lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { VersioningService, computeDiff } from '$lib/services/versioningService';
import { ClientsVersioningBridge } from './clients.versioning.bridge';
import type { ClientItem, ClientListItem, ClientOriginal } from './schema';

export interface ClientsFetchResult {
  list: ClientListItem[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export class ClientsService {
  /**
   * Recupera un singolo cliente tramite ID (escludendo i record contrassegnati come soft-deleted).
   */
  static async getClient(id: string): Promise<ClientItem | null> {
    try {
      const snap = await getDoc(doc(db, 'clients', id));
      if (snap.exists()) {
        const data = snap.data();
        if (data.derived?.deleted) return null;
        return { id: snap.id, ...data } as ClientItem;
      }
    } catch (e) {
      console.warn('Errore recupero cliente:', e);
    }
    return null;
  }

  /**
   * Recupera l'elenco completo dei clienti attivi.
   */
  static async getClients(): Promise<ClientItem[]> {
    try {
      const snap = await getDocs(collection(db, 'clients'));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ClientItem))
        .filter((c: ClientItem) => !c.derived?.deleted);
    } catch (e) {
      console.warn('Errore recupero lista clienti:', e);
      return [];
    }
  }

  /**
   * Esegue il soft-delete canonico di un'anagrafica cliente garantendo la conservazione dell'audit trail.
   */
  static async deleteClient(id: string, uid?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'clients', id), {
        'derived.deleted': true,
        'edits.deletedAt': now,
        'edits.deletedBy': uid || 'system',
        'edits.modifiedAt': now,
        'edits.modifiedBy': uid || 'system'
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Crea una nuova anagrafica cliente con validazione duplicati e dual-write transazionale di versioning.
   */
  static async createClient(
    clientData: Partial<ClientItem> & { id: string },
    historyData: any,
    computedFiscalId: string,
    isCommerciale: boolean,
    uid: string,
    tenantId: string = 'default',
    userEmail?: string
  ): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
      if (computedFiscalId) {
        let checkQuery;
        if (!isCommerciale) {
          checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', computedFiscalId));
        } else {
          checkQuery = query(
            collection(db, 'clients'),
            where('original.fiscalId', '==', computedFiscalId),
            where('original.createdBy', '==', uid)
          );
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
          performedByName: userEmail,
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

  /**
   * Recupera i clienti paginati e filtrati per la vista elenco.
   */
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

    // Ordinamento predefinito per data di creazione decrescente
    let snap;
    try {
      let orderedQ = query(q, orderBy('edits.createdAt', 'desc'));
      if (lastVisible) {
        orderedQ = query(orderedQ, startAfter(lastVisible));
      }
      orderedQ = query(orderedQ, limit(itemsPerPage));
      snap = await getDocs(orderedQ);
    } catch (err) {
      console.warn('Fallback query senza orderBy per compatibilità documenti:', err);
      let fallbackQ = q;
      if (lastVisible) {
        fallbackQ = query(fallbackQ, startAfter(lastVisible));
      }
      fallbackQ = query(fallbackQ, limit(itemsPerPage));
      snap = await getDocs(fallbackQ);
    }

    // Se la query ordinata non ha trovato nulla ma non c'è ricerca attiva, esegui fallback per includere record legacy senza edits.createdAt
    if (snap.empty && !searchVal && !lastVisible) {
      const fallbackSnap = await getDocs(query(q, limit(itemsPerPage)));
      if (!fallbackSnap.empty) {
        snap = fallbackSnap;
      }
    }

    const clList: ClientListItem[] = [];

    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      if (data.derived?.deleted) return;
      const orig: ClientOriginal = data.original || {};

      clList.push({
        id: docSnap.id,
        nome: orig.nome || '',
        cognome: orig.cognome || '',
        email: orig.email || orig.emailContatto || '',
        phone: orig.phone || orig.mainPhone || '',
        status: (orig.status as string) || 'prospect',
        clientCode: orig.clientCode || '',
        clientGroup: orig.clientGroup || '',
        certificationStatus: orig.certificationStatus || '',
        isItalianSubject: orig.isItalianSubject !== undefined ? orig.isItalianSubject : true,
        partitaIva: orig.partitaIva || '',
        codiceFiscale: orig.codiceFiscale || '',
        sdiCode: orig.sdiCode || '',
        pec: orig.pec || '',
        paymentTerms: orig.paymentTerms || '',
        iban: orig.iban || '',
        referenteTecnico: orig.referenteTecnico || '',
        telReferente: orig.telReferente || '',
        emailContatto: orig.emailContatto || orig.email || '',
        emailAlternativa: orig.emailAlternativa || '',
        crifCheck: orig.crifCheck || '',
        riskClass: orig.riskClass || '',
        maxCredit: orig.maxCredit || 0,
        residualCredit: orig.residualCredit || 0,
        paymentStatus: orig.paymentStatus || 'Regolare',
        internalAdminNotes: orig.internalAdminNotes || '',
        quoteAutoNotes: orig.quoteAutoNotes || '',
        notes: orig.notes || [],
        createdBy: orig.createdBy || '',
        createdAt: data.edits?.createdAt || data.original?.createdAt || new Date().toISOString(),
        derived: data.derived || {}
      });
    });

    // Se usata query di fallback, ordina in memoria
    clList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const hasMore = snap.docs.length === itemsPerPage;
    const newLastDoc = snap.docs.length > 0 ? (snap.docs[snap.docs.length - 1] as unknown as QueryDocumentSnapshot) : null;

    return { list: clList, lastDoc: newLastDoc, hasMore };
  }
}
