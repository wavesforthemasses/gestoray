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
exports.scheduledReconciliation = exports.getChartAggregations = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
exports.getChartAggregations = (0, https_1.onCall)({ region: 'europe-west3', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Devi essere loggato.');
    }
    const { entity, periods, filters } = request.data;
    if (!entity || !periods || !Array.isArray(periods)) {
        throw new https_1.HttpsError('invalid-argument', 'Parametri mancanti.');
    }
    const db = admin.firestore();
    const results = [];
    try {
        for (const period of periods) {
            try {
                if (entity === 'activities') {
                    let q = db.collectionGroup('activities');
                    if (filters?.type && filters.type !== 'all') {
                        q = q.where('original.type', '==', filters.type);
                    }
                    if (filters?.loggedBy) {
                        q = q.where('original.loggedBy', '==', filters.loggedBy);
                    }
                    q = q.where('edits.createdAt', '>=', period.start).where('edits.createdAt', '<=', period.end);
                    const snapshot = await q.count().get();
                    results.push(snapshot.data().count || 0);
                }
                else if (entity === 'vss') {
                    const contractsSnap = await db.collection('contracts').get();
                    let total = 0;
                    contractsSnap.forEach(doc => {
                        const data = doc.data();
                        const created = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
                        if (created && created >= period.start && created <= period.end) {
                            const vendorMatch = !filters?.vendorUid || data.agentId === filters.vendorUid || data.original?.vendorUid === filters.vendorUid || data.original?.secondVendorUid === filters.vendorUid;
                            if (vendorMatch) {
                                total += (data.totalAmount ?? data.original?.totalPrice ?? 0);
                            }
                        }
                    });
                    results.push(total);
                }
                else if (entity === 'gi' || entity === 'payments') {
                    let payQuery = db.collection('payments');
                    payQuery = payQuery.where('original.date', '>=', period.start).where('original.date', '<=', period.end);
                    if (filters?.vendorUid) {
                        const pSnap = await db.collection('contracts').where('original.vendorUid', '==', filters.vendorUid).get();
                        const sSnap = await db.collection('contracts').where('original.secondVendorUid', '==', filters.vendorUid).get();
                        const myContractIds = new Set();
                        pSnap.forEach(d => myContractIds.add(d.id));
                        sSnap.forEach(d => myContractIds.add(d.id));
                        let totalGi = 0;
                        const idsArray = Array.from(myContractIds);
                        for (let i = 0; i < idsArray.length; i += 30) {
                            const chunk = idsArray.slice(i, i + 30);
                            const chunkSnap = await db.collectionGroup('contractsPaid')
                                .where('original.contractId', 'in', chunk)
                                .where('original.date', '>=', period.start)
                                .where('original.date', '<=', period.end)
                                .get();
                            chunkSnap.forEach(d => { totalGi += (d.data().original?.amount || 0); });
                        }
                        results.push(totalGi);
                    }
                    else {
                        // @ts-ignore
                        const snapshot = await payQuery.aggregate({ total: firestore_1.AggregateField.sum('original.amount') }).get();
                        results.push(snapshot.data().total || 0);
                    }
                }
                else if (entity === 'nuove_anagrafiche') {
                    let q = db.collection('clients');
                    if (filters?.createdBy) {
                        q = q.where('original.createdBy', '==', filters.createdBy);
                    }
                    q = q.where('edits.createdAt', '>=', period.start).where('edits.createdAt', '<=', period.end);
                    const snapshot = await q.count().get();
                    results.push(snapshot.data().count || 0);
                }
                else if (entity === 'nncf') {
                    let q = db.collection('clients');
                    if (filters?.createdBy) {
                        q = q.where('original.createdBy', '==', filters.createdBy);
                    }
                    q = q.where('derived.nncfDate', '>=', period.start).where('derived.nncfDate', '<=', period.end);
                    const snapshot = await q.count().get();
                    results.push(snapshot.data().count || 0);
                }
                else if (entity === 'provvigioni_maturate') {
                    let totalComm = 0;
                    const closingsSnap = await db.collection('commissions_closings')
                        .where('latestStatus', '==', 'finalized')
                        .where('periodEnd', '>=', period.start)
                        .where('periodEnd', '<=', period.end)
                        .get();
                    for (const cDoc of closingsSnap.docs) {
                        const vSnap = await db.collection('commissions_closings').doc(cDoc.id).collection('versions')
                            .where('status', '==', 'finalized').get();
                        if (!vSnap.empty) {
                            const version = vSnap.docs[0].data();
                            if (filters?.vendorUid) {
                                const myBreakdown = version.breakdown?.find((b) => b.uid === filters.vendorUid);
                                if (myBreakdown)
                                    totalComm += (myBreakdown.commission || 0);
                            }
                            else {
                                totalComm += (version.totalCommissions || 0);
                            }
                        }
                    }
                    results.push(totalComm);
                }
                else {
                    results.push(0);
                }
            }
            catch (subErr) {
                console.warn(`Safe fallback for entity ${entity}:`, subErr);
                results.push(0);
            }
        }
        return { data: results };
    }
    catch (error) {
        console.error('Aggregation error:', error);
        throw new https_1.HttpsError('internal', 'Errore nel calcolo delle aggregazioni.');
    }
});
/**
 * scheduledReconciliation (Nightly Cron Job)
 * Self-healing reconciliation engine that runs at 03:00 AM.
 * Instead of scanning full database history, it ONLY recalculates months flagged in `system_dirty_periods`.
 */
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
exports.scheduledReconciliation = (0, scheduler_1.onSchedule)({ schedule: '0 3 * * *', timeZone: 'Europe/Rome', region: 'europe-west3' }, async () => {
    const db = admin.firestore();
    logger.info('[NIGHTLY RECONCILIATION] Starting smart dirty-period reconciliation check...');
    try {
        const dirtySnap = await db.collection('system_dirty_periods').get();
        if (dirtySnap.empty) {
            logger.info('[NIGHTLY RECONCILIATION] Zero dirty periods flagged. System 100% synchronized.');
            return;
        }
        logger.info(`[NIGHTLY RECONCILIATION] Found ${dirtySnap.size} dirty period(s) to reconcile.`);
        for (const dDoc of dirtySnap.docs) {
            const data = dDoc.data();
            const yearMonth = data.yearMonth || dDoc.id;
            logger.info(`[RECONCILING PERIOD] Recalculating monthly materialized analytics for ${yearMonth}...`);
            // Compute start and end ISO dates for the target yearMonth (YYYY-MM)
            const [yearStr, monthStr] = yearMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
            // 1. Recalculate monthly sales
            const salesSnap = await db.collection('contracts').get();
            let monthlyTotalSales = 0;
            let monthlyApprovedSales = 0;
            salesSnap.forEach(sDoc => {
                const data = sDoc.data() || {};
                const created = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
                if (created && created >= startDate && created <= endDate) {
                    const val = data.totalAmount ?? data.original?.totalPrice ?? 0;
                    const status = data.status ?? data.original?.status ?? 'bozza';
                    monthlyTotalSales += val;
                    if (status === 'attivo' || status === 'accettato' || status === 'approved') {
                        monthlyApprovedSales += val;
                    }
                }
            });
            // 2. Update materialized view
            await db.collection('analytics_monthly').doc(yearMonth).set({
                totalSales: monthlyTotalSales,
                approvedSales: monthlyApprovedSales,
                reconciledAt: new Date().toISOString(),
                status: 'synced'
            }, { merge: true });
            // 3. Clear dirty flag
            await dDoc.ref.delete();
            logger.info(`[RECONCILED SUCCESS] Period ${yearMonth} successfully reconciled and dirty flag cleared.`);
        }
    }
    catch (error) {
        logger.error('[NIGHTLY RECONCILIATION ERROR] Failed during scheduled reconciliation:', error);
    }
});
//# sourceMappingURL=aggregations.js.map