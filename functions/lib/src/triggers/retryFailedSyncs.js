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
exports.retryFailedSyncs = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const business_logic_1 = require("../business-logic");
const REGION = 'europe-west3';
exports.retryFailedSyncs = (0, https_1.onCall)({ region: REGION }, async (request) => {
    // 1. Authorization checks
    const auth = request.auth;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'L\'utente deve essere autenticato.');
    }
    const db = admin.firestore();
    try {
        const userSnap = await db.collection('users').doc(auth.uid).get();
        if (!userSnap.exists) {
            throw new https_1.HttpsError('permission-denied', 'Utente non trovato nel database.');
        }
        const roles = userSnap.data()?.original?.roles || [];
        const hasAccess = roles.includes('superadmin') || roles.includes('amministrazione') || roles.includes('direzione');
        if (!hasAccess) {
            throw new https_1.HttpsError('permission-denied', 'Permessi insufficienti.');
        }
        // 2. Fetch pending errors
        const errorsSnap = await db
            .collection('sync_errors')
            .where('original.status', 'in', ['pending', 'failed'])
            .get();
        let resolvedCount = 0;
        let failedCount = 0;
        for (const errDoc of errorsSnap.docs) {
            const errorId = errDoc.id;
            const errData = errDoc.data()?.original || {};
            const triggerName = errData.triggerName || '';
            const documentId = errData.documentId || '';
            const metadata = errData.metadata || {};
            const currentAttempts = errData.attempts || 1;
            try {
                logger.info(`Retrying sync for error ${errorId} (trigger: ${triggerName}, docId: ${documentId})`);
                // Dynamic module trigger handler routing
                if (triggerName === 'onContractCreated') {
                    let syncClientAndVendorStatsFn;
                    try {
                        const mod = await Promise.resolve().then(() => __importStar(require('./onContractCreated')));
                        syncClientAndVendorStatsFn = mod.syncClientAndVendorStats;
                    }
                    catch (e) {
                        logger.warn(`Trigger handler onContractCreated not installed or available.`);
                    }
                    const docSnap = await db.collection('contracts').doc(documentId).get();
                    if (docSnap.exists) {
                        const data = docSnap.data() || {};
                        const original = data.original || {};
                        const vendorUid = original.vendorUid;
                        const secondVendorUid = original.secondVendorUid;
                        const clientId = original.clientId;
                        if (vendorUid) {
                            const vendorSnap = await db.collection('users').doc(vendorUid).get();
                            const qualificationId = vendorSnap.data()?.original?.qualification;
                            let qualification = null;
                            if (qualificationId) {
                                const qualSnap = await db.collection('qualifications').doc(qualificationId).get();
                                if (qualSnap.exists) {
                                    qualification = qualSnap.data();
                                }
                            }
                            const products = original.products || [];
                            const secondVendorShare = original.secondVendorShare || 0;
                            const commission = (0, business_logic_1.calculateCommission)(products, qualification, secondVendorShare);
                            await db.collection('contracts').doc(documentId).update({
                                'derived.commissionTotal': commission.total,
                                'derived.commissionPrimary': commission.primary,
                                'derived.commissionSecondary': commission.secondary
                            });
                        }
                        if (clientId && syncClientAndVendorStatsFn) {
                            const vendors = [];
                            if (vendorUid)
                                vendors.push(vendorUid);
                            if (secondVendorUid)
                                vendors.push(secondVendorUid);
                            await syncClientAndVendorStatsFn(db, clientId, vendors);
                        }
                    }
                    else {
                        logger.warn(`Contract ${documentId} no longer exists, resolving error anyway.`);
                    }
                }
                else if (triggerName === 'onContractsPaidCreated') {
                    const { paymentId, contractId } = metadata;
                    if (paymentId && contractId) {
                        try {
                            const mod = await Promise.resolve().then(() => __importStar(require('./onContractsPaidCreated')));
                            if (typeof mod.runContractsPaidCreated === 'function') {
                                await mod.runContractsPaidCreated(db, paymentId, contractId);
                            }
                        }
                        catch (e) {
                            logger.warn(`Trigger handler onContractsPaidCreated not available.`);
                        }
                    }
                    else {
                        throw new Error('Missing paymentId or contractId in metadata');
                    }
                }
                else if (triggerName === 'onContractUpdated') {
                    try {
                        const mod = await Promise.resolve().then(() => __importStar(require('./onContractUpdated')));
                        if (typeof mod.runContractUpdated === 'function') {
                            await mod.runContractUpdated(db, documentId);
                        }
                    }
                    catch (e) {
                        logger.warn(`Trigger handler onContractUpdated not available.`);
                    }
                }
                else if (triggerName === 'onActivityCreated') {
                    const { clientId, activityId } = metadata;
                    if (clientId && activityId) {
                        const docSnap = await db
                            .collection('clients')
                            .doc(clientId)
                            .collection('activities')
                            .doc(activityId)
                            .get();
                        if (docSnap.exists) {
                            try {
                                const mod = await Promise.resolve().then(() => __importStar(require('./onActivityCreated')));
                                const runFn = mod.runActivityWrite || mod.runActivityCreated;
                                if (typeof runFn === 'function') {
                                    await runFn(db, clientId, activityId, docSnap.data());
                                }
                            }
                            catch (e) {
                                logger.warn(`Trigger handler onActivityCreated not available.`);
                            }
                        }
                        else {
                            logger.warn(`Activity ${activityId} no longer exists, resolving error anyway.`);
                        }
                    }
                    else {
                        throw new Error('Missing clientId or activityId in metadata');
                    }
                }
                else if (triggerName === 'onInstallmentWrite') {
                    const { contractId } = metadata;
                    if (contractId) {
                        try {
                            const mod = await Promise.resolve().then(() => __importStar(require('./onInstallmentWrite')));
                            if (typeof mod.runInstallmentWrite === 'function') {
                                await mod.runInstallmentWrite(db, contractId);
                            }
                        }
                        catch (e) {
                            logger.warn(`Trigger handler onInstallmentWrite not available.`);
                        }
                    }
                    else {
                        throw new Error('Missing contractId in metadata');
                    }
                }
                else if (triggerName === 'onPaymentCreated') {
                    const docSnap = await db.collection('payments').doc(documentId).get();
                    if (docSnap.exists) {
                        try {
                            const mod = await Promise.resolve().then(() => __importStar(require('./onPaymentCreated')));
                            if (typeof mod.runPaymentCreated === 'function') {
                                await mod.runPaymentCreated(db, documentId, docSnap.data());
                            }
                        }
                        catch (e) {
                            logger.warn(`Trigger handler onPaymentCreated not available.`);
                        }
                    }
                    else {
                        logger.warn(`Payment ${documentId} no longer exists, resolving error anyway.`);
                    }
                }
                else {
                    throw new Error(`Unknown triggerName: ${triggerName}`);
                }
                // If execution succeeded, mark as resolved
                await db.collection('sync_errors').doc(errorId).update({
                    'original.status': 'resolved',
                    'original.attempts': currentAttempts + 1,
                    'original.resolvedAt': new Date().toISOString(),
                    'edits.modifiedAt': new Date().toISOString(),
                    'edits.modifiedBy': auth.uid
                });
                resolvedCount++;
            }
            catch (execErr) {
                logger.error(`Retry attempt failed for error ${errorId}:`, execErr);
                const nextAttempts = currentAttempts + 1;
                const status = nextAttempts >= 5 ? 'failed' : 'pending';
                await db.collection('sync_errors').doc(errorId).update({
                    'original.attempts': nextAttempts,
                    'original.status': status,
                    'original.errorMessage': execErr.message || 'Unknown error',
                    'original.stack': execErr.stack || '',
                    'original.lastAttemptAt': new Date().toISOString(),
                    'edits.modifiedAt': new Date().toISOString()
                });
                failedCount++;
            }
        }
        return {
            status: 'success',
            processed: errorsSnap.size,
            resolvedCount,
            failedCount
        };
    }
    catch (e) {
        logger.error('Error in retryFailedSyncs:', e);
        throw new https_1.HttpsError('internal', e.message || 'Errore interno durante il retry.');
    }
});
//# sourceMappingURL=retryFailedSyncs.js.map