import type { LedgerFieldSemantics } from '$lib/services/versioningService';
import type { ActivityItem } from './schema';

export class ActivitiesVersioningBridge {
  static getSemanticsMap(): Record<string, LedgerFieldSemantics> {
    return {
      'status': 'ABSOLUTE',
      'priority': 'ABSOLUTE',
      'category': 'ABSOLUTE',
      'activityTypeId': 'ABSOLUTE',
      'activityTypeName': 'DESCRIPTIVE',
      'title': 'DESCRIPTIVE',
      'description': 'DESCRIPTIVE',
      'assignedEntities': 'ABSOLUTE',
      'assignedUid': 'ABSOLUTE',
      'assignedName': 'DESCRIPTIVE',
      'targetType': 'ABSOLUTE',
      'targetId': 'ABSOLUTE',
      'targetName': 'DESCRIPTIVE',
      'targetSubtext': 'DESCRIPTIVE',
      'scheduledDate': 'ABSOLUTE',
      'scheduledSlot': 'ABSOLUTE',
      'customStartTime': 'ABSOLUTE',
      'customEndTime': 'ABSOLUTE',
      'executionDate': 'ABSOLUTE',
      'dueDate': 'ABSOLUTE',
      'durationMinutes': 'ABSOLUTE', // Ripristino storico esatto in caso di reversal
      'clientId': 'ABSOLUTE',
      'clientName': 'DESCRIPTIVE',
      'placeId': 'ABSOLUTE',
      'placeName': 'DESCRIPTIVE',
      'contactId': 'ABSOLUTE',
      'contactName': 'DESCRIPTIVE',
      'groupId': 'ABSOLUTE',
      'customFields': 'DESCRIPTIVE'
    };
  }

  static getEntityLabel(activity: Partial<ActivityItem>): string {
    const code = activity.activityNumber ? `[${activity.activityNumber}] ` : '';
    const title = activity.title || 'Attività';
    const target = activity.targetName ? ` - ${activity.targetName}` : '';
    return `${code}${title}${target}`.trim();
  }
}
