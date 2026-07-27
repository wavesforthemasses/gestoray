import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// List of collections that we want to track automatically
const AUDITED_COLLECTIONS = ['users', 'clients', 'contacts', 'products', 'activities'];

// Memory cache to avoid excessive reads of settings/project on every update
let cachedSettings: { enableHistoryLogs: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds

export const auditLogger = onDocumentUpdated('{collectionId}/{docId}', async (event) => {
  const collectionId = event.params.collectionId;
  const docId = event.params.docId;

  // Only track specific collections
  if (!AUDITED_COLLECTIONS.includes(collectionId)) {
    return;
  }

  const snapshotBefore = event.data?.before;
  const snapshotAfter = event.data?.after;

  if (!snapshotBefore || !snapshotAfter) {
    return;
  }

  const beforeData = snapshotBefore.data();
  const afterData = snapshotAfter.data();

  // Check if logging is enabled at project level (with memory cache)
  try {
    const now = Date.now();
    if (!cachedSettings || (now - cachedSettings.timestamp > CACHE_TTL_MS)) {
      const settingsDoc = await admin.firestore().collection('settings').doc('project').get();
      if (settingsDoc.exists) {
        cachedSettings = {
          enableHistoryLogs: settingsDoc.data()?.enableHistoryLogs !== false,
          timestamp: now
        };
      } else {
        cachedSettings = { enableHistoryLogs: true, timestamp: now };
      }
    }

    if (cachedSettings && cachedSettings.enableHistoryLogs === false) {
      return; // Logging is explicitly disabled
    }
  } catch (error) {
    logger.warn('Failed to read settings/project for auditLogger, proceeding with defaults', error);
  }

  // We are interested in changes in the "original" object for our standard CRM entities
  const beforeOriginal = beforeData.original || beforeData || {};
  const afterOriginal = afterData.original || afterData || {};

  const changes: Record<string, { old: any; new: any }> = {};

  // Find updated or added fields
  for (const key of Object.keys(afterOriginal)) {
    const oldVal = beforeOriginal[key];
    const newVal = afterOriginal[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { 
        old: oldVal === undefined ? null : oldVal, 
        new: newVal === undefined ? null : newVal 
      };
    }
  }

  // Find removed fields
  for (const key of Object.keys(beforeOriginal)) {
    if (!(key in afterOriginal)) {
      changes[key] = { 
        old: beforeOriginal[key] === undefined ? null : beforeOriginal[key], 
        new: null 
      };
    }
  }

  // If there are no changes in the `original` profile, we don't log anything.
  // This prevents logging when only `derived` or `edits` metadata changes.
  if (Object.keys(changes).length === 0) {
    return;
  }

  const modifiedBy = afterData.edits?.modifiedBy || 'system';

  try {
    await admin.firestore().collection(collectionId).doc(docId).collection('history').add({
      action: 'UPDATE',
      performedBy: modifiedBy,
      timestamp: new Date().toISOString(),
      changes: changes
    });
    logger.info(`[AUDIT] Logged update for ${collectionId}/${docId} by ${modifiedBy}`);
  } catch (error) {
    logger.error(`[AUDIT ERROR] Failed to log update for ${collectionId}/${docId}`, error);
  }
});
