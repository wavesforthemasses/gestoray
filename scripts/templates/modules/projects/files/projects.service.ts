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

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  const cleaned: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      cleaned[key] = null;
    } else if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      cleaned[key] = cleanUndefined(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

export class ProjectsService {
  private static COLLECTION = 'projects';

  static async getProjects(clientId?: string): Promise<ProjectItem[]> {
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
      }
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

    let clientName = data.clientName || '';
    if (!clientName && data.clientId) {
      try {
        const clientSnap = await getDoc(doc(db, 'clients', data.clientId));
        if (clientSnap.exists()) {
          const cd = clientSnap.data();
          clientName = cd.name || cd.companyName || cd.original?.name || cd.original?.ragioneSociale || '';
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
    });

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

    let clientName = data.clientName || existing.clientName || '';
    if (!clientName && (data.clientId || existing.clientId)) {
      try {
        const cid = data.clientId || existing.clientId;
        const clientSnap = await getDoc(doc(db, 'clients', cid));
        if (clientSnap.exists()) {
          const cd = clientSnap.data();
          clientName = cd.name || cd.companyName || cd.original?.name || cd.original?.ragioneSociale || '';
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
