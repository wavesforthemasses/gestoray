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
exports.onPaymentCreated = void 0;
exports.runPaymentCreated = runPaymentCreated;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
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