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
exports.onActivityCreated = void 0;
exports.runActivityWrite = runActivityWrite;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const utils_1 = require("../utils");
const REGION = 'europe-west3';
async function runActivityWrite(db, clientId) {
    const clientRef = db.collection('clients').doc(clientId);
    const activitiesSnap = await clientRef.collection('activities').get();
    let activitiesCount = 0;
    let lastActivityDate = null;
    activitiesSnap.forEach((docSnap) => {
        const act = docSnap.data() || {};
        const actDate = act.edits?.createdAt || act.original?.date || act.original?.createdAt || '';
        activitiesCount++;
        if (actDate) {
            if (!lastActivityDate || new Date(actDate) > new Date(lastActivityDate)) {
                lastActivityDate = actDate;
            }
        }
    });
    const lastActivityDateInt = (0, utils_1.dateToInt)(lastActivityDate);
    // Avoid unnecessary writes if metrics haven't changed to prevent trigger cascades
    const clientSnap = await clientRef.get();
    const currentDerived = clientSnap.data()?.derived || {};
    if (currentDerived.activitiesCount === activitiesCount &&
        currentDerived.lastActivityDate === lastActivityDate &&
        currentDerived.lastActivityDateInt === lastActivityDateInt) {
        return;
    }
    await clientRef.update({
        'derived.activitiesCount': activitiesCount,
        'derived.lastActivityDate': lastActivityDate,
        'derived.lastActivityDateInt': lastActivityDateInt
    });
}
exports.onActivityCreated = (0, firestore_1.onDocumentWritten)({ region: REGION, document: 'clients/{clientId}/activities/{actId}' }, async (event) => {
    const change = event.data;
    if (!change)
        return;
    const clientId = event.params.clientId;
    const activityId = event.params.actId;
    const db = admin.firestore();
    try {
        await runActivityWrite(db, clientId);
        logger.info(`Successfully synced activity metrics for client ${clientId}`);
    }
    catch (error) {
        logger.error(`Error in onActivityCreated for client ${clientId}:`, error);
        await (0, utils_1.logSyncError)(db, 'onActivityCreated', activityId, `clients/${clientId}/activities/${activityId}`, error.message, error.stack, { clientId });
    }
});
//# sourceMappingURL=onActivityCreated.js.map