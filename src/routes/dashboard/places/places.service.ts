import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from '$lib/firebase';
import type { PlaceItem } from './schema';
import { PlaceSettingsService } from './placeSettingsService';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { cleanUndefined } from '$lib/utils/helpers';

export class PlacesService {
  private static COLLECTION = 'places';

  static async getPlaces(clientId?: string): Promise<PlaceItem[]> {
    try {
      let snap;
      if (clientId) {
        snap = await getDocs(query(collection(db, this.COLLECTION), where('clientId', '==', clientId)));
      } else {
        try {
          snap = await getDocs(query(collection(db, this.COLLECTION), orderBy('createdAt', 'desc')));
        } catch (err) {
          snap = await getDocs(collection(db, this.COLLECTION));
        }
        if (snap.empty) {
          snap = await getDocs(collection(db, this.COLLECTION));
        }
      }
      const list: PlaceItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data?.derived?.deleted) {
          list.push({ id: d.id, ...data } as PlaceItem);
        }
      });
      return list.sort((a, b) => {
        const dA = a.createdAt || '';
        const dB = b.createdAt || '';
        return dB.localeCompare(dA);
      });
    } catch (e) {
      console.error('Errore getPlaces:', e);
      return [];
    }
  }

  static async getPlaceById(id: string): Promise<PlaceItem | null> {
    try {
      const ref = doc(db, this.COLLECTION, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data?.derived?.deleted) return null;
      return { id: snap.id, ...data } as PlaceItem;
    } catch (e) {
      console.error('Errore getPlaceById:', e);
      return null;
    }
  }

  /**
   * @deprecated Use getPlaceById instead. Maintained as a defensive alias.
   */
  static async getPlace(id: string): Promise<PlaceItem | null> {
    return this.getPlaceById(id);
  }


  static async createPlace(
    data: Omit<PlaceItem, 'id' | 'code' | 'createdAt' | 'updatedAt'>,
    authorUid: string
  ): Promise<string> {
    const settings = await PlaceSettingsService.getSettings();
    const { code, updatedSettings } = await PlaceSettingsService.generateNextCode(settings);

    let clientName = data.clientName || '';
    if (!clientName && data.clientId) {
      try {
        const clientSnap = await getDoc(doc(db, 'clients', data.clientId));
        if (clientSnap.exists()) {
          const cd = clientSnap.data();
          clientName = cd.name || cd.nome || cd.companyName || cd.original?.name || cd.original?.nome || cd.original?.ragioneSociale || '';
        }
      } catch (e) {
        console.warn('Errore lettura clientName:', e);
      }
    }

    const textSearch = generateSearchTerms(`${code} ${data.name} ${clientName} ${data.notes || ''}`);

    const payload = cleanUndefined({
      code,
      name: data.name,
      clientId: data.clientId,
      clientName,
      status: data.status || settings.defaultStatus || 'attivo',
      contactPerson: data.contactPerson || '',
      phone: data.phone || '',
      notes: data.notes || '',
      address: data.address || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      derived: {
        textSearch
      }
    });

    const docRef = await addDoc(collection(db, this.COLLECTION), payload);
    await PlaceSettingsService.saveSettings(updatedSettings);

    try {
      await CacheLookupService.updateEntityCache('places', docRef.id, `${code} - ${data.name}`);
    } catch (e) {
      console.warn('Errore cache luoghi:', e);
    }

    return docRef.id;
  }

  static async updatePlace(id: string, data: Partial<PlaceItem>): Promise<void> {
    const ref = doc(db, this.COLLECTION, id);
    const existing = await this.getPlaceById(id);
    if (!existing) throw new Error('Luogo/Cantiere non trovato');

    const name = data.name || existing.name;
    const code = data.code || existing.code;

    let clientName = data.clientName || existing.clientName || '';
    if (!clientName && (data.clientId || existing.clientId)) {
      try {
        const cid = data.clientId || existing.clientId;
        const clientSnap = await getDoc(doc(db, 'clients', cid));
        if (clientSnap.exists()) {
          const cd = clientSnap.data();
          clientName = cd.name || cd.nome || `${cd.nome || ''} ${cd.cognome || ''}`.trim() || cd.companyName || cd.ragioneSociale || cd.denominazione || cd.original?.name || cd.original?.nome || cd.original?.ragioneSociale || '';
        }
      } catch (e) {
        console.warn('Errore lettura clientName update:', e);
      }
    }

    const textSearch = generateSearchTerms(`${code} ${name} ${clientName} ${data.notes || existing.notes || ''}`);

    const payload: Record<string, any> = cleanUndefined({
      ...data,
      clientName,
      updatedAt: new Date().toISOString(),
      'derived.textSearch': textSearch
    });

    await updateDoc(ref, payload);

    try {
      await CacheLookupService.updateEntityCache('places', id, `${code} - ${name}`);
    } catch (e) {
      console.warn('Errore aggiornamento cache luoghi:', e);
    }
  }

  static async deletePlace(id: string, uid?: string): Promise<void> {
    const ref = doc(db, this.COLLECTION, id);
    await updateDoc(ref, {
      'derived.deleted': true,
      'edits.deletedAt': new Date().toISOString(),
      'edits.deletedBy': uid || 'system'
    });
    try {
      await CacheLookupService.removeEntityFromCache('places', id);
    } catch (e) {
      console.warn('Errore rimozione cache luogo:', e);
    }
  }

  static async getPlaceContracts(placeId: string): Promise<any[]> {
    try {
      const snap = await getDocs(query(collection(db, 'contracts'), where('placeId', '==', placeId)));
      const list: any[] = [];
      snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
      return list;
    } catch (e) {
      console.warn('Errore getPlaceContracts:', e);
      return [];
    }
  }

  static async getPlaceActivities(placeId: string): Promise<any[]> {
    try {
      const snap = await getDocs(query(collection(db, 'activities'), where('placeId', '==', placeId)));
      const list: any[] = [];
      snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
      return list;
    } catch (e) {
      console.warn('Errore getPlaceActivities:', e);
      return [];
    }
  }

  static async getCommercialInsights(placeId: string): Promise<{ contractsSnap: any; activitiesSnap: any }> {
    try {
      const [contractsSnap, activitiesSnap] = await Promise.all([
        getDocs(query(collection(db, 'contracts'), where('placeId', '==', placeId))),
        getDocs(query(collection(db, 'activities'), where('placeId', '==', placeId)))
      ]);
      return { contractsSnap, activitiesSnap };
    } catch (e) {
      console.warn('Errore getCommercialInsights:', e);
      return { contractsSnap: { empty: true, forEach: () => {} }, activitiesSnap: { empty: true, forEach: () => {} } };
    }
  }

  static async getTeamsInsights(placeId: string): Promise<any> {
    try {
      return await getDocs(query(collection(db, 'activities'), where('placeId', '==', placeId)));
    } catch (e) {
      console.warn('Errore getTeamsInsights:', e);
      return { empty: true, forEach: () => {} };
    }
  }
}
