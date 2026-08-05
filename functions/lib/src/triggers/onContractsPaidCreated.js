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
exports.onContractsPaidCreated = void 0;
exports.runContractsPaidCreated = runContractsPaidCreated;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const utils_1 = require("../utils");
const REGION = 'europe-west3';
async function runContractsPaidCreated(db, paymentId, contractId) {
    // 1. Query all contractsPaid documents for this contract to get totalPaid
    const contractsPaidSnap = await db
        .collectionGroup('contractsPaid')
        .where('original.contractId', '==', contractId)
        .get();
    let totalPaid = 0;
    let paymentsCount = 0;
    const productPaidAmount = {};
    contractsPaidSnap.forEach((doc) => {
        const data = doc.data()?.original || {};
        const amt = data.amount || 0;
        totalPaid += amt;
        paymentsCount += 1;
        const allocs = data.productAllocations || [];
        allocs.forEach((pa) => {
            const pid = pa.productId;
            const pamnt = pa.amount || 0;
            if (pid) {
                productPaidAmount[pid] = (productPaidAmount[pid] || 0) + pamnt;
            }
        });
    });
    // 2. Fetch contract doc
    const contractRef = db.collection('contracts').doc(contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
        logger.error(`Contract ${contractId} does not exist`);
        return;
    }
    const cData = contractSnap.data() || {};
    const cOriginal = cData.original || {};
    const clientId = cOriginal.clientId;
    // 3. Get all allocations under this payment
    const allocationsSnap = await db
        .collection('payments')
        .doc(paymentId)
        .collection('contractsPaid')
        .get();
    // 4. Get all contracts for this client to recalculate totalPaid/totalRemaining
    let clientContractsSnap = null;
    if (clientId) {
        clientContractsSnap = await db
            .collection('contracts')
            .where('original.clientId', '==', clientId)
            .get();
    }
    const paymentRef = db.collection('payments').doc(paymentId);
    await db.runTransaction(async (transaction) => {
        const txContractSnap = await transaction.get(contractRef);
        if (!txContractSnap.exists) {
            logger.error(`Contract ${contractId} does not exist inside transaction`);
            return;
        }
        const txPaymentSnap = await transaction.get(paymentRef);
        const paymentExists = txPaymentSnap.exists;
        const txCData = txContractSnap.data() || {};
        const txCOriginal = txCData.original || {};
        const totalPrice = txCOriginal.totalPrice || 0;
        const oldStatus = txCOriginal.status || 'pending';
        const totalRemaining = Math.max(0, totalPrice - totalPaid);
        // Update contract derived and status if needed
        const updateData = {
            'derived.totalPaid': totalPaid,
            'derived.totalRemaining': totalRemaining,
            'derived.paymentsCount': paymentsCount,
            'derived.productPaidAmount': productPaidAmount
        };
        if (totalPaid >= totalPrice && oldStatus === 'pending') {
            updateData['original.status'] = 'approved';
            updateData['original.approvedAt'] = new Date().toISOString();
            updateData['original.approvedBy'] = 'system';
            updateData['original.approvedEmail'] = 'system';
        }
        transaction.update(contractRef, updateData);
        // Update payment distributed amounts if it exists
        if (paymentExists) {
            const payData = txPaymentSnap.data() || {};
            const payOriginalAmount = payData.original?.amount || 0;
            let distAmount = 0;
            allocationsSnap.forEach((alloc) => {
                distAmount += alloc.data()?.original?.amount || 0;
            });
            transaction.update(paymentRef, {
                'derived.distributedAmount': distAmount,
                'derived.remainingToDistribute': Math.max(0, payOriginalAmount - distAmount)
            });
        }
        // Update client aggregate fields
        if (clientId && clientContractsSnap) {
            const clientRef = db.collection('clients').doc(clientId);
            let clientTotalPaid = 0;
            let clientTotalRemaining = 0;
            clientContractsSnap.forEach((cDoc) => {
                const cId = cDoc.id;
                const data = cDoc.data() || {};
                const deriv = data.derived || {};
                let cPaid = deriv.totalPaid || 0;
                let cRemaining = deriv.totalRemaining || 0;
                // Incorporate current update values
                if (cId === contractId) {
                    cPaid = totalPaid;
                    cRemaining = totalRemaining;
                }
                clientTotalPaid += cPaid;
                clientTotalRemaining += cRemaining;
            });
            transaction.update(clientRef, {
                'derived.totalPaid': clientTotalPaid,
                'derived.totalRemaining': clientTotalRemaining
            });
        }
    });
}
exports.onContractsPaidCreated = (0, firestore_1.onDocumentWritten)({ region: REGION, document: 'payments/{paymentId}/contractsPaid/{contractId}' }, async (event) => {
    const contractId = event.params.contractId;
    const paymentId = event.params.paymentId;
    const db = admin.firestore();
    const beforeData = event.data?.before?.data();
    // Reset installment to pending if it was associated and is now being deleted
    if (event.data?.before?.exists && !event.data?.after?.exists) {
        const instId = beforeData?.original?.installmentId;
        if (instId) {
            try {
                await db.collection('contracts').doc(contractId)
                    .collection('installments').doc(instId).update({
                    'original.status': 'pending',
                    'original.paidAmount': admin.firestore.FieldValue.delete(),
                    'original.paidAt': admin.firestore.FieldValue.delete()
                });
                logger.info(`Successfully reset installment ${instId} to pending`);
            }
            catch (err) {
                logger.error(`Failed to reset installment ${instId}:`, err);
            }
        }
    }
    try {
        await runContractsPaidCreated(db, paymentId, contractId);
        logger.info(`Successfully processed written allocation under payment ${paymentId} for contract ${contractId}`);
    }
    catch (error) {
        logger.error(`Error in onContractsPaidCreated (onDocumentWritten):`, error);
        await (0, utils_1.logSyncError)(db, 'onContractsPaidCreated', contractId, `payments/${paymentId}/contractsPaid/${contractId}`, error.message, error.stack, { paymentId, contractId });
    }
});
//# sourceMappingURL=onContractsPaidCreated.js.map