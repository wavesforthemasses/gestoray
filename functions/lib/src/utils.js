"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDerivedOnlyChange = isDerivedOnlyChange;
exports.logSyncError = logSyncError;
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
//# sourceMappingURL=utils.js.map