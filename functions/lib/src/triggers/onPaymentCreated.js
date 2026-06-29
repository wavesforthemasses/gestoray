"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPaymentCreated = void 0;
exports.runPaymentCreated = runPaymentCreated;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const utils_1 = require("../utils");
const REGION = 'europe-west3';
async function runPaymentCreated(db, paymentId, paymentData) {
    const amount = paymentData.original?.amount || 0;
    const paymentRef = db.collection('payments').doc(paymentId);
    await paymentRef.update({
        'derived.distributedAmount': 0,
        'derived.remainingToDistribute': amount
    });
}
exports.onPaymentCreated = (0, firestore_1.onDocumentCreated)({ region: REGION, document: 'payments/{paymentId}' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const paymentId = event.params.paymentId;
    const db = admin.firestore();
    try {
        await runPaymentCreated(db, paymentId, snap.data());
        logger.info(`Successfully initialized derived fields for payment ${paymentId}`);
    }
    catch (error) {
        logger.error(`Error in onPaymentCreated for payment ${paymentId}:`, error);
        await (0, utils_1.logSyncError)(db, 'onPaymentCreated', paymentId, `payments/${paymentId}`, error.message, error.stack);
    }
});
//# sourceMappingURL=onPaymentCreated.js.map