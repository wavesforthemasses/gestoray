import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { PlaceDocument } from './domain/models/place';
import type { PlaceItem } from './schema';
import { PlaceSettingsService } from './placeSettingsService';
import { PlaceFirestoreRepository } from './infrastructure/firestore/PlaceFirestoreRepository';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { cleanUndefined } from '$lib/utils/helpers';

export class PlacesService {
  private static repo = new PlaceFirestoreRepository();
  private static COLLECTION = 'places';

  static async getPlaces(clientId?: string): Promise<PlaceDocument[]> {
    return this.repo.fetchPlaces('default', { clientId });
  }

  static async getPlaceById(id: string): Promise<PlaceDocument | null> {
    return this.repo.fetchPlaceById('default', id);
  }

  /**
   * @deprecated Use getPlaceById instead. Maintained as defensive alias.
   */
  static async getPlace(id: string): Promise<PlaceDocument | null> {
    return this.getPlaceById(id);
  }

  static async createPlace(
    data: Partial<PlaceDocument> & { address?: any },
    authorUid?: string
  ): Promise<string> {
    const settings = await PlaceSettingsService.getSettings();
    
    let code = data.code;
    let updatedSettings = settings;

    if (!code) {
      const gen = await PlaceSettingsService.generateNextCode(settings);
      code = gen.code;
      updatedSettings = gen.updatedSettings;
    }

    const payload: Partial<PlaceDocument> = {
      ...data,
      code,
      status: (data.status || settings.defaultStatus || 'active') as any,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docId = await this.repo.savePlaceWithUniqueCodeLock('default', payload);
    
    if (updatedSettings !== settings) {
      await PlaceSettingsService.saveSettings(updatedSettings);
    }

    try {
      await CacheLookupService.updateEntityCache('places', docId, `${code} - ${data.name}`);
    } catch (e) {
      console.warn('Errore cache luoghi:', e);
    }

    return docId;
  }

  static async updatePlace(id: string, data: Partial<PlaceDocument>, oldCode?: string): Promise<void> {
    await this.repo.savePlaceWithUniqueCodeLock('default', data, id, oldCode);
    try {
      const name = data.name || 'Luogo';
      const code = data.code || '';
      await CacheLookupService.updateEntityCache('places', id, `${code ? code + ' - ' : ''}${name}`);
    } catch (e) {
      console.warn('Errore aggiornamento cache luoghi:', e);
    }
  }

  static async reparentPlace(targetPlaceId: string, newParentId: string | null): Promise<void> {
    await this.repo.updatePlaceParentWithCascade('default', targetPlaceId, newParentId);
  }

  static async deletePlace(id: string, uid?: string): Promise<void> {
    await this.repo.deletePlaceWithLockRelease('default', id, true, uid);
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
