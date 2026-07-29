"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const utils_1 = require("../utils");
// List of collections that we want to track automatically
const AUDITED_COLLECTIONS = ['users', 'clients', 'contacts', 'products', 'activities'];
exports.auditLogger = (0, firestore_1.onDocumentUpdated)('{collectionId}/{docId}', async (event) => {
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
    // Check if logging is enabled at project level (with shared RAM cache)
    try {
        const projectSettings = await (0, utils_1.getProjectSettingsCached)(admin.firestore());
        if (projectSettings?.enableHistoryLogs === false) {
            return; // Logging is explicitly disabled
        }
    }
    catch (error) {
        logger.warn('Failed to read settings/project for auditLogger, proceeding with defaults', error);
    }
    // We are interested in changes in the "original" object for our standard CRM entities
    const beforeOriginal = beforeData.original || beforeData || {};
    const afterOriginal = afterData.original || afterData || {};
    const changes = {};
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
    }
    catch (error) {
        logger.error(`[AUDIT ERROR] Failed to log update for ${collectionId}/${docId}`, error);
    }
});
//# sourceMappingURL=auditLogger.js.map