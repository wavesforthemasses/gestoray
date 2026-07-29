"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDerivedOnlyChange = isDerivedOnlyChange;
exports.logSyncError = logSyncError;
exports.getProjectSettingsCached = getProjectSettingsCached;
exports.markPeriodDirty = markPeriodDirty;
exports.dateToInt = dateToInt;
/**
 * Helper: isDerivedOnlyChange
 * Checks if the update only affects the 'derived' namespace.
 * If yes, returns true (so the function can skip processing and avoid infinite loops).
 */
function isDerivedOnlyChange(before, after) {
    if (!before || !after)
        return false;
    const beforeOriginal = JSON.stringify(before.original || {});
    const afterOriginal = JSON.stringify(after.original || {});
    const beforeEdits = JSON.stringify(before.edits || {});
    const afterEdits = JSON.stringify(after.edits || {});
    return beforeOriginal === afterOriginal && beforeEdits === afterEdits;
}
/**
 * Helper: logSyncError
 * Logs database synchronization errors to the 'sync_errors' collection.
 */
async function logSyncError(db, triggerName, documentId, documentPath, errorMessage, stack, metadata) {
    const errorId = 'err_' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    try {
        await db.collection('sync_errors').doc(errorId).set({
            original: {
                triggerName,
                documentId,
                documentPath,
                errorMessage,
                stack: stack || '',
                status: 'pending',
                attempts: 1,
                lastAttemptAt: now,
                metadata: metadata || null
            },
            edits: {
                createdAt: now
            }
        });
    }
    catch (err) {
        console.error('Failed to log sync error to firestore:', err);
    }
}
// Memory cache to avoid excessive reads of settings/project across warm functions
let cachedSettings = null;
const CACHE_TTL_MS = 60000; // 60 seconds
/**
 * Shared RAM Cached Project Settings Read
 */
async function getProjectSettingsCached(db) {
    const now = Date.now();
    if (cachedSettings && (now - cachedSettings.timestamp < CACHE_TTL_MS)) {
        return cachedSettings.data;
    }
    try {
        const snap = await db.collection('settings').doc('project').get();
        const data = snap.exists ? snap.data() || {} : {};
        cachedSettings = { data, timestamp: now };
        return data;
    }
    catch (err) {
        return cachedSettings ? cachedSettings.data : {};
    }
}
/**
 * Helper: markPeriodDirty
 * Flags yearMonth (YYYY-MM) in system_dirty_periods for auto reconciliation.
 */
async function markPeriodDirty(db, yearMonth) {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth))
        return;
    try {
        await db.collection('system_dirty_periods').doc(yearMonth).set({
            yearMonth,
            flaggedAt: new Date().toISOString()
        }, { merge: true });
    }
    catch (err) {
        console.warn(`Failed to mark period ${yearMonth} dirty:`, err);
    }
}
/**
 * Converts ISO date string (YYYY-MM-DD) to integer YYYYMMDD for ultra-fast Firestore range queries.
 * Example: "2026-07-28" -> 20260728
 */
function dateToInt(dateStr) {
    if (!dateStr)
        return null;
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match)
        return null;
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return y * 10000 + m * 100 + d;
}
//# sourceMappingURL=utils.js.map