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
exports.runActivityWrite = exports.onActivityCreated = void 0;
exports.runActivityCreated = runActivityCreated;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const utils_1 = require("../utils");
const REGION = 'europe-west3';
async function runActivityCreated(db, clientId, activityId, activityData) {
    const activityDate = activityData.edits?.createdAt || activityData.original?.date || new Date().toISOString();
    const clientRef = db.collection('clients').doc(clientId);
    await db.runTransaction(async (transaction) => {
        const clientSnap = await transaction.get(clientRef);
        if (!clientSnap.exists) {
            logger.error(`Client ${clientId} does not exist`);
            return;
        }
        const clientData = clientSnap.data() || {};
        const currentDerived = clientData.derived || {};
        const lastActDate = currentDerived.lastActivityDate || '';
        const newLastActDate = (!lastActDate || new Date(activityDate) > new Date(lastActDate))
            ? activityDate
            : lastActDate;
        transaction.update(clientRef, {
            'derived.activitiesCount': admin.firestore.FieldValue.increment(1),
            'derived.lastActivityDate': newLastActDate
        });
    });
}
exports.onActivityCreated = (0, firestore_1.onDocumentCreated)({ region: REGION, document: 'clients/{clientId}/activities/{actId}' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const clientId = event.params.clientId;
    const activityId = event.params.actId;
    const db = admin.firestore();
    try {
        await runActivityCreated(db, clientId, activityId, snap.data());
        logger.info(`Successfully updated activity derived fields for client ${clientId}`);
    }
    catch (error) {
        logger.error(`Error in onActivityCreated for client ${clientId}:`, error);
        await (0, utils_1.logSyncError)(db, 'onActivityCreated', activityId, `clients/${clientId}/activities/${activityId}`, error.message, error.stack, { clientId });
    }
});
exports.runActivityWrite = runActivityCreated;
//# sourceMappingURL=onActivityCreated.js.map