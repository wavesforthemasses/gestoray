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
import type { ProjectItem } from './schema';
import { ProjectSettingsService } from './projectSettingsService';
import { generateSearchTerms } from '$lib/search-utils';
import { CacheLookupService } from '$lib/services/cacheLookupService';

export class ProjectsService {
  private static COLLECTION = 'projects';

  static async getProjects(clientId?: string): Promise<ProjectItem[]> {
    try {
      let q;
      if (clientId) {
        q = query(collection(db, this.COLLECTION), where('clientId', '==', clientId));
      } else {
        q = query(collection(db, this.COLLECTION), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      const list: ProjectItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as ProjectItem);
      });
      return list;
    } catch (e) {
      console.error('Errore getProjects:', e);
      return [];
    }
  }

  static async getProjectById(id: string): Promise<ProjectItem | null> {
    try {
      const ref = doc(db, this.COLLECTION, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ProjectItem;
    } catch (e) {
      console.error('Errore getProjectById:', e);
      return null;
    }
  }

  static async createProject(
    data: Omit<ProjectItem, 'id' | 'code' | 'createdAt' | 'updatedAt'>,
    authorUid: string
  ): Promise<string> {
    const settings = await ProjectSettingsService.getSettings();
    const { code, updatedSettings } = await ProjectSettingsService.generateNextCode(settings);

    const clientSnap = await getDoc(doc(db, 'clients', data.clientId));
    const clientName = clientSnap.exists() ? (clientSnap.data()?.name || clientSnap.data()?.original?.name || '') : '';

    const textSearch = generateSearchTerms(`${code} ${data.name} ${clientName} ${data.notes || ''}`);

    const payload = {
      code,
      name: data.name,
      clientId: data.clientId,
      clientName,
      status: data.status || settings.defaultStatus || 'fase_contrattuale',
      progress: data.progress || 0,
      estimatedAmount: data.estimatedAmount || 0,
      notes: data.notes || '',
      address: data.address || null,
      startDate: data.startDate || new Date().toISOString().slice(0, 10),
      endDate: data.endDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      derived: {
        textSearch
      }
    };

    const docRef = await addDoc(collection(db, this.COLLECTION), payload);
    await ProjectSettingsService.saveSettings(updatedSettings);

    try {
      await CacheLookupService.updateEntityCache('projects', docRef.id, `${code} - ${data.name}`);
    } catch (e) {
      console.warn('Errore cache progetti:', e);
    }

    return docRef.id;
  }

  static async updateProject(id: string, data: Partial<ProjectItem>): Promise<void> {
    const ref = doc(db, this.COLLECTION, id);
    const existing = await this.getProjectById(id);
    if (!existing) throw new Error('Progetto non trovato');

    const name = data.name || existing.name;
    const code = data.code || existing.code;
    const clientName = data.clientName || existing.clientName || '';
    const textSearch = generateSearchTerms(`${code} ${name} ${clientName} ${data.notes || existing.notes || ''}`);

    const payload: Record<string, any> = {
      ...data,
      updatedAt: new Date().toISOString(),
      'derived.textSearch': textSearch
    };

    await updateDoc(ref, payload);

    try {
      await CacheLookupService.updateEntityCache('projects', id, `${code} - ${name}`);
    } catch (e) {
      console.warn('Errore aggiornamento cache progetti:', e);
    }
  }

  static async deleteProject(id: string): Promise<void> {
    const ref = doc(db, this.COLLECTION, id);
    await deleteDoc(ref);
  }
}
