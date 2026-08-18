import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { TodoItem } from '../todo/todo.service';
import type { ActivityItem } from './schema';

export async function fetchTodoItems(role: string, myUid: string): Promise<TodoItem[]> {
  try {
    const q = query(
      collection(db, 'activities'),
      where('status', 'in', ['da_fare', 'in_corso'])
    );

    const snap = await getDocs(q);
    const items: TodoItem[] = [];

    const isSupervisor = ['superadmin', 'amministrazione', 'direzione'].includes(role);

    snap.forEach((docSnap) => {
      const data = docSnap.data() as ActivityItem;
      if (data.derived?.deleted) return;

      // Access Filter: assigned to user, or user is in assignedEntities, or supervisor role
      const isAssignedDirectly = data.assignedUid === myUid;
      const isAssignedInEntities = Array.isArray(data.assignedEntities) && 
        data.assignedEntities.some(e => e.type === 'user' && e.id === myUid);

      if (!isSupervisor && !isAssignedDirectly && !isAssignedInEntities) {
        return;
      }

      // Map Priority to Todo Urgency
      let urgency: 'high' | 'medium' | 'low' = 'medium';
      if (data.priority === 'urgente' || data.priority === 'alta') {
        urgency = 'high';
      } else if (data.priority === 'bassa') {
        urgency = 'low';
      }

      const targetInfo = data.targetName ? ` [${data.targetName}]` : '';
      const typeLabel = data.activityTypeName ? `[${data.activityTypeName}] ` : '';

      items.push({
        id: `act_${docSnap.id}`,
        type: 'activity_task',
        urgency,
        title: `${typeLabel}${data.title}${targetInfo}`.trim(),
        description: data.description || `Attività in stato '${data.status}' da completare.`,
        dueDate: data.dueDate || data.scheduledDate || data.executionDate || data.edits?.createdAt || data.createdAt,
        link: `/dashboard/activities/${docSnap.id}`,
        meta: {
          activityId: docSnap.id,
          targetType: data.targetType,
          targetId: data.targetId,
          priority: data.priority,
          status: data.status
        }
      });
    });

    return items;
  } catch (e) {
    console.warn('[ActivitiesTodoBridge] Errore lettura attività per todo:', e);
    return [];
  }
}
