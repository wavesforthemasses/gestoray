export type DeadlineCategory =
  | 'vehicle_inspection'
  | 'vehicle_tax'
  | 'vehicle_insurance'
  | 'medical_checkup'
  | 'safety_course'
  | 'contract_expiry'
  | 'certification'
  | 'custom';

export type DeadlineStatus = 'attiva' | 'in_scadenza' | 'scaduta' | 'rinnovata' | 'archiviata';

export type LinkedEntityType = 'vehicle' | 'user' | 'contract' | 'team' | 'place' | 'other';

export interface DeadlineEntry {
  id: string;
  code: string;
  title: string;
  category: DeadlineCategory;

  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
  linkedEntityName?: string;

  expiryDate: string; // YYYY-MM-DD
  reminderDaysBefore: number[]; // e.g. [30, 15, 7, 1]

  status: DeadlineStatus;
  isRecurring?: boolean;
  recurringIntervalMonths?: number;

  notes?: string;

  // Prepared for FCM Push Notification target (user ID or registration token)
  pushNotificationTargetUid?: string;

  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type EntityNamingType = 'scadenzario' | 'allarmi' | 'scadenze' | 'avvisi' | 'custom';

export interface DeadlineSettings {
  entityNaming: EntityNamingType;
  customSingularLabel?: string;
  customPluralLabel?: string;
  prefix: string;
  includeYear: boolean;
  numberPadding: number;
  lastNumber: number;
  lastCounterYear: number;
  defaultStatus: DeadlineStatus;
  defaultReminderDays: number[];
  enablePushNotifications: boolean;
  fcmMessagingSenderId?: string;
}
