"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onActivityCreated = void 0;
exports.runActivityCreated = runActivityCreated;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
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
//# sourceMappingURL=onActivityCreated.js.map