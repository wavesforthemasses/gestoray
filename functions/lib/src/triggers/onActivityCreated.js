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
exports.onActivityWritten = exports.runActivityWrite = exports.runActivityCreated = exports.onActivityCreated = void 0;
exports.recalculateClientActivityStats = recalculateClientActivityStats;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const utils_1 = require("../utils");
const REGION = 'europe-west3';
/**
 * Ricalcola simmetricamente e in-memory le statistiche di un cliente relative alle attività.
 * Garantisce il ciclo di vita reversibile: Azione ➔ Reversione = Stato 0 (Principio 7).
 * Utilizza ordinamento e deduzione date in-memory per evitare errori FAILED_PRECONDITION su indici Firestore mancanti.
 */
async function recalculateClientActivityStats(db, clientId, _activityId, _activityData) {
    if (!clientId)
        return;
    try {
        const clientRef = db.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) {
            return;
        }
        // 1. Scansiona le attività collegate (sia root collection che subcollection legacy)
        const [rootActivitiesByClientId, rootActivitiesByTargetId, subActivitiesSnap] = await Promise.all([
            db.collection('activities').where('clientId', '==', clientId).get(),
            db.collection('activities').where('targetId', '==', clientId).get(),
            db.collection('clients').doc(clientId).collection('activities').get()
        ]);
        const uniqueActivityMap = new Map();
        const processDoc = (docSnap) => {
            const data = docSnap.data() || {};
            // Ignora le attività cancellate (soft delete)
            if (data.derived?.deleted || data.deleted)
                return;
            uniqueActivityMap.set(docSnap.id, data);
        };
        rootActivitiesByClientId.forEach(processDoc);
        rootActivitiesByTargetId.forEach(processDoc);
        subActivitiesSnap.forEach(processDoc);
        const activeActivities = Array.from(uniqueActivityMap.values());
        const activitiesCount = activeActivities.length;
        let lastActivityDate = null;
        if (activitiesCount > 0) {
            const validDates = activeActivities
                .map(a => a.edits?.createdAt || a.original?.date || a.scheduledDate || a.date || a.createdAt)
                .filter(Boolean)
                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            if (validDates.length > 0) {
                lastActivityDate = validDates[validDates.length - 1];
            }
        }
        // 2. Aggiornamento atomico dello stato derived del cliente
        await clientRef.update({
            'derived.activitiesCount': activitiesCount,
            'derived.lastActivityDate': lastActivityDate
        });
        logger.info(`[recalculateClientActivityStats] Client ${clientId} synced: count=${activitiesCount}, lastDate=${lastActivityDate}`);
    }
    catch (error) {
        logger.error(`[recalculateClientActivityStats] Error recalculating stats for client ${clientId}:`, error);
        throw error;
    }
}
exports.onActivityCreated = (0, firestore_1.onDocumentWritten)({ region: REGION, document: '{path=**}/activities/{actId}' }, async (event) => {
    const change = event.data;
    if (!change)
        return;
    const beforeData = change.before?.data();
    const afterData = change.after?.data();
    // 1. GUARDIA ANTI-LOOP: Ignora mutazioni limitate a soli campi derived (Principio 10)
    if (beforeData && afterData && (0, utils_1.isDerivedOnlyChange)(beforeData, afterData)) {
        return;
    }
    const activityId = event.params.actId;
    const db = admin.firestore();
    // 2. Rileva tutti i clienti coinvolti (Dual-Client Recalculation per supporto cambio cliente)
    const clientIdsToSync = new Set();
    // Client IDs da path (se subcollection)
    const rawParams = event.params;
    if (rawParams.clientId) {
        clientIdsToSync.add(rawParams.clientId);
    }
    // Client IDs da prima della mutazione
    if (beforeData) {
        if (beforeData.clientId)
            clientIdsToSync.add(beforeData.clientId);
        if (beforeData.targetType === 'client' && beforeData.targetId)
            clientIdsToSync.add(beforeData.targetId);
        if (beforeData.original?.clientId)
            clientIdsToSync.add(beforeData.original.clientId);
    }
    // Client IDs dopo la mutazione
    if (afterData) {
        if (afterData.clientId)
            clientIdsToSync.add(afterData.clientId);
        if (afterData.targetType === 'client' && afterData.targetId)
            clientIdsToSync.add(afterData.targetId);
        if (afterData.original?.clientId)
            clientIdsToSync.add(afterData.original.clientId);
    }
    if (clientIdsToSync.size === 0)
        return;
    try {
        for (const cId of clientIdsToSync) {
            await recalculateClientActivityStats(db, cId);
        }
        logger.info(`Successfully synced activity metrics on write for activity ${activityId}`);
    }
    catch (error) {
        logger.error(`Error in onActivityCreated (onDocumentWritten) for activity ${activityId}:`, error);
        await (0, utils_1.logSyncError)(db, 'onActivityCreated', activityId, `activities/${activityId}`, error.message, error.stack, { clientIds: Array.from(clientIdsToSync) });
    }
});
// Backward-compatible alias
exports.runActivityCreated = recalculateClientActivityStats;
exports.runActivityWrite = recalculateClientActivityStats;
exports.onActivityWritten = exports.onActivityCreated;
//# sourceMappingURL=onActivityCreated.js.map