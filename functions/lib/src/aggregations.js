"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChartAggregations = void 0;
const admin = require("firebase-admin");
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
                results.push(snapshot.data().count);
            }
            else if (entity === 'vss') {
                let q = db.collection('contracts');
                if (filters?.vendorUid) {
                    q = q.where('original.vendorUid', '==', filters.vendorUid);
                }
                q = q.where('edits.createdAt', '>=', period.start).where('edits.createdAt', '<=', period.end);
                // @ts-ignore
                const snapshot = await q.aggregate({ total: firestore_1.AggregateField.sum('original.totalPrice') }).get();
                let total = snapshot.data().total || 0;
                if (filters?.vendorUid) {
                    // Add secondVendor contracts
                    let q2 = db.collection('contracts')
                        .where('original.secondVendorUid', '==', filters.vendorUid)
                        .where('edits.createdAt', '>=', period.start)
                        .where('edits.createdAt', '<=', period.end);
                    // @ts-ignore
                    const snap2 = await q2.aggregate({ total: firestore_1.AggregateField.sum('original.totalPrice') }).get();
                    total += snap2.data().total || 0;
                }
                results.push(total);
            }
            else if (entity === 'gi' || entity === 'payments') {
                let payQuery = db.collection('payments');
                payQuery = payQuery.where('original.date', '>=', period.start).where('original.date', '<=', period.end);
                if (filters?.vendorUid) {
                    // For commercials, we need to fetch their contracts, then their payments. 
                    // Aggregate queries don't support "in" across subcollections easily.
                    // Since Cloud Functions are server-side, fetching the payments directly is very fast.
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
                results.push(snapshot.data().count);
            }
            else if (entity === 'nncf') {
                let q = db.collection('clients');
                if (filters?.createdBy) {
                    q = q.where('original.createdBy', '==', filters.createdBy);
                }
                q = q.where('derived.nncfDate', '>=', period.start).where('derived.nncfDate', '<=', period.end);
                const snapshot = await q.count().get();
                results.push(snapshot.data().count);
            }
            else if (entity === 'provvigioni_maturate') {
                // Find finalized versions in this period
                // Usually period is monthly.
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
        return { data: results };
    }
    catch (error) {
        console.error('Aggregation error:', error);
        throw new https_1.HttpsError('internal', 'Errore nel calcolo delle aggregazioni.');
    }
});
//# sourceMappingURL=aggregations.js.map