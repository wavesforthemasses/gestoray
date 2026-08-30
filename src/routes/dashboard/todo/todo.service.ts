import { db, doc, updateDoc, setDoc, collection, getDocs, collectionGroup, query, where, or } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib';
import { formatCurrency } from '$lib/utils/formatters';

export interface TodoDataPayload {
  clientsList: any[];
}

export interface TodoItem {
  id: string;
  type: string;
  urgency: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  dueDate?: string;
  link?: string;
  meta?: any;
}

// Dynamically import all todo.bridges from modules
const dynamicBridges = import.meta.glob('../*/todo.bridge.ts', { eager: true });

export class TodoService {
  static async fetchTodoData(activeRole: string | null, myUid: string | undefined): Promise<TodoDataPayload> {
    const payload: TodoDataPayload = {
      clientsList: []
    };

    if (!activeRole || !myUid) return payload;
    const isComm = activeRole === 'commerciale';

    // 1. Core: Clients (Prospect or proposal_sent)
    let qClients = query(collection(db, 'clients'), where('original.status', 'in', ['prospect', 'proposal_sent']));
    if (isComm) {
      qClients = query(qClients, where('original.createdBy', '==', myUid));
    }
    
    try {
      const snap = await getDocs(qClients);
      snap.forEach((doc: any) => payload.clientsList.push({ id: doc.id, ...doc.data()?.original, derived: doc.data()?.derived, edits: doc.data()?.edits }));
    } catch (e) {
      console.error(e);
    }

    return payload;
  }

  static async buildTodoItems(
    clientsList: any[], 
    activeRole: string | null, 
    myUid: string | undefined,
    activeModuleIds: string[]
  ): Promise<TodoItem[]> {
    const role = activeRole;
    if (!role || !myUid) return [];

    let items: TodoItem[] = [];

    // Core Items
    clientsList.forEach(cl => {
      const isProspect = cl.status === 'prospect';
      if (isProspect) {
        items.push({
          id: `prospect_${cl.id}`,
          type: 'prospect_followup',
          urgency: 'medium',
          title: `Primo Contatto Lead: ${cl.nome || cl.cognome || 'Cliente'}`.trim(),
          description: `Lead registrato ma non ancora contattato. Effettua una telefonata conoscitiva.`,
          dueDate: cl.edits?.createdAt || cl.createdAt,
          meta: { clientId: cl.id, component: 'prospect' }
        });
      }

      const hasQuotes = cl.status === 'proposal_sent';
      if (hasQuotes) {
        items.push({
          id: `quote_${cl.id}`,
          type: 'quote_followup',
          urgency: 'medium',
          title: `Follow-up Preventivo: ${cl.nome || cl.cognome || 'Cliente'}`.trim(),
          description: `Proposta inviata al cliente. Ricontatta il referente per negoziare la firma del contratto.`,
          dueDate: cl.edits?.createdAt || cl.createdAt,
          meta: { clientId: cl.id, component: 'quote' }
        });
      }
    });

    // Dynamic Module Items
    for (const [path, moduleImport] of Object.entries(dynamicBridges)) {
      const moduleId = path.split('/')[4];
      if (activeModuleIds.includes(moduleId) && moduleImport) {
        const mod = moduleImport as any;
        let fn: any = null;
        if (typeof mod.fetchTodoItems === 'function') {
          fn = mod.fetchTodoItems;
        } else {
          for (const val of Object.values(mod)) {
            if (val && typeof (val as any).fetchTodoItems === 'function') {
              fn = (val as any).fetchTodoItems;
              break;
            }
          }
        }

        if (fn) {
          try {
            const moduleItems = await fn(role, myUid);
            if (Array.isArray(moduleItems)) {
              items = items.concat(moduleItems);
            }
          } catch (err) {
            console.error(`Error fetching todo items for module ${moduleId}:`, err);
          }
        }
      }
    }

    const urgencyWeight = { high: 3, medium: 2, low: 1 };
    return items.sort((a, b) => {
      const uDiff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (uDiff !== 0) return uDiff;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });
  }
}
