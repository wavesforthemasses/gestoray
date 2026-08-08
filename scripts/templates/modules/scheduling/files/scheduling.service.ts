import { 
  db, 
  doc, 
  runTransaction 
} from '$lib/firebase';
import type { CompositeCalendarItem, ScheduleSlot, ScheduleSettings } from './schema';
import { ScheduleSettingsService } from './scheduleSettingsService';

export class SchedulingService {
  /**
   * Composite Schedule Loader (VIEW ONLY):
   * Merges data from Interventi, Activities, and Deadlines
   * into a single unified list of CompositeCalendarItem.
   * Also returns unassigned work order / activity drafts (backlog).
   * 
   * This module DOES NOT read from its own 'scheduling' collection anymore.
   */
  static async getCompositeSchedule(): Promise<{
    items: CompositeCalendarItem[];
    backlog: CompositeCalendarItem[];
  }> {
    const compositeItems: CompositeCalendarItem[] = [];
    const backlogItems: CompositeCalendarItem[] = [];

    // 1. Dynamic import InterventiService (Work Orders)
    try {
      const servicePath = '../interventi/interventi.service';
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ servicePath);
      const InterventiService = mod?.InterventiService;

      if (InterventiService) {
        const interventions = await InterventiService.getInterventions();

        for (const item of interventions) {
          const itemPhase = item.phase || (item.status as any) || 'pianificato';
          const itemDate = item.scheduledDate || (item.scheduledStartAt ? item.scheduledStartAt.slice(0, 10) : undefined);

          const mapped: CompositeCalendarItem = {
            id: item.id || '',
            source: 'intervention',
            title: item.title,
            date: itemDate || '',
            slot: item.scheduledSlot || 'giornata_intera',
            customStartTime: item.scheduledCustomStart,
            customEndTime: item.scheduledCustomEnd,
            assignedEntities: item.assignedEntities || [],
            clientId: item.clientId,
            clientName: item.clientName,
            placeId: item.locationId,
            placeName: item.locationName,
            status: item.status,
            phase: itemPhase,
            priority: item.priority || 'media',
            notes: item.description,
            interventionNumber: item.interventionNumber,
            originalRef: item
          };

          if (itemDate && itemPhase !== 'annullato') {
            compositeItems.push(mapped);
          } else if (itemPhase === 'bozza' || !itemDate) {
            backlogItems.push(mapped);
          }
        }
      }
    } catch (err) {
      console.info('Modulo interventi non integrato nello scheduling o non installato:', err);
    }

    // 2. Dynamic import ActivitiesService (CRM Tasks / Events)
    try {
      const servicePath = '../activities/activities.service';
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ servicePath);
      const ActivitiesService = mod?.ActivitiesService;

      if (ActivitiesService) {
        const activities = await ActivitiesService.getActivities();

        for (const act of activities) {
          if (act.status === 'annullato') continue;

          const actDate = act.scheduledDate || act.executionDate || act.dueDate;
          
          const mapped: CompositeCalendarItem = {
            id: act.id || '',
            source: 'activity',
            title: act.title,
            date: actDate || '',
            slot: act.scheduledSlot || 'giornata_intera',
            customStartTime: act.customStartTime,
            customEndTime: act.customEndTime,
            assignedEntities: act.assignedEntities || [],
            clientId: act.clientId,
            clientName: act.clientName,
            status: act.status,
            priority: act.priority || 'media',
            notes: act.description,
            originalRef: act
          };

          if (actDate) {
            compositeItems.push(mapped);
          } else if (act.status === 'da_fare') {
            backlogItems.push(mapped);
          }
        }
      }
    } catch (err) {
      console.info('Modulo activities non integrato nello scheduling o non installato:', err);
    }

    // 3. Dynamic import DeadlinesService (Scadenzario)
    try {
      const servicePath = '../deadlines/deadlines.service';
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ servicePath);
      const DeadlinesService = mod?.DeadlinesService;

      if (DeadlinesService) {
        const deadlines = await DeadlinesService.getDeadlines();

        for (const dl of deadlines) {
          if (dl.status === 'archiviata' || dl.status === 'rinnovata') continue;
          if (!dl.expiryDate) continue;

          const dlEntities = [];
          if (dl.linkedEntityType && dl.linkedEntityId && dl.linkedEntityName) {
            dlEntities.push({
              entityType: dl.linkedEntityType,
              entityId: dl.linkedEntityId,
              entityName: dl.linkedEntityName
            });
          }

          const mapped: CompositeCalendarItem = {
            id: dl.id || '',
            source: 'deadline',
            title: `Scadenza: ${dl.title}`,
            date: dl.expiryDate,
            slot: 'giornata_intera',
            assignedEntities: dlEntities as any,
            status: dl.status,
            priority: 'alta',
            notes: dl.notes,
            originalRef: dl
          };

          compositeItems.push(mapped);
        }
      }
    } catch (err) {
      console.info('Modulo deadlines non integrato nello scheduling o non installato:', err);
    }

    return {
      items: compositeItems,
      backlog: backlogItems
    };
  }

  static async scheduleWorkOrder(
    interventionId: string,
    date: string,
    slot: ScheduleSlot = 'giornata_intera',
    assignedEntities?: any[]
  ): Promise<void> {
    const servicePath = '../interventi/interventi.service';
    // @ts-ignore
    const mod = await import(/* @vite-ignore */ servicePath);
    const InterventiService = mod?.InterventiService;

    if (!InterventiService) throw new Error('Modulo interventi non installato');

    const existing = await InterventiService.getInterventionById(interventionId);
    if (!existing) throw new Error('Intervento non trovato');

    await InterventiService.promotePhase(interventionId, 'pianificato', {
      scheduledDate: date,
      scheduledSlot: slot,
      scheduledStartAt: `${date}T08:00:00.000Z`,
      scheduledEndAt: `${date}T17:00:00.000Z`,
      ...(assignedEntities ? { assignedEntities } : {})
    });
  }

  static async scheduleActivity(
    activityId: string,
    date: string,
    slot: ScheduleSlot = 'giornata_intera',
    assignedEntities?: any[]
  ): Promise<void> {
    const servicePath = '../activities/activities.service';
    // @ts-ignore
    const mod = await import(/* @vite-ignore */ servicePath);
    const ActivitiesService = mod?.ActivitiesService;

    if (!ActivitiesService) throw new Error('Modulo activities non installato');

    const existing = await ActivitiesService.getActivityById(activityId);
    if (!existing) throw new Error('Attività non trovata');

    const updates: any = {
      scheduledDate: date,
      scheduledSlot: slot,
      status: existing.status === 'da_fare' ? 'in_corso' : existing.status
    };

    if (assignedEntities && assignedEntities.length > 0) {
      updates.assignedEntities = assignedEntities;
    }

    await ActivitiesService.updateActivity(activityId, updates);
  }
}

