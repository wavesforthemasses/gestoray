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
exports.reconcileAnalyticsCron = exports.onInterventionWriteAnalytics = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const REGION = 'europe-west3';
/**
 * Speed Layer: Realtime Event-Driven Aggregation for Interventions
 */
exports.onInterventionWriteAnalytics = (0, firestore_1.onDocumentWritten)({
    document: 'interventions/{docId}',
    region: REGION
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    let diffRevenue = 0;
    let diffHours = 0;
    let diffCount = 0;
    if (before) {
        diffRevenue -= (before.totalAmount || 0);
        diffHours -= (before.actualHoursWorked || before.actualQuantityWorked || 0);
        diffCount -= 1;
    }
    if (after) {
        diffRevenue += (after.totalAmount || 0);
        diffHours += (after.actualHoursWorked || after.actualQuantityWorked || 0);
        diffCount += 1;
    }
    if (diffRevenue === 0 && diffHours === 0 && diffCount === 0)
        return;
    const db = admin.firestore();
    const rawDate = after?.scheduledStartAt || before?.scheduledStartAt || after?.createdAt || before?.createdAt;
    const dateObj = rawDate ? new Date(rawDate) : new Date();
    const yearMonth = `${dateObj.getFullYear()}_${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const incPayload = {
        totalRevenue: admin.firestore.FieldValue.increment(diffRevenue),
        totalHours: admin.firestore.FieldValue.increment(diffHours),
        totalInterventions: admin.firestore.FieldValue.increment(diffCount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const batch = db.batch();
    const generalRef = db.collection('analytics_monthly').doc(yearMonth);
    batch.set(generalRef, incPayload, { merge: true });
    const clientId = after?.clientId || before?.clientId;
    if (clientId) {
        const clientRef = generalRef.collection('clients').doc(clientId);
        batch.set(clientRef, incPayload, { merge: true });
    }
    await batch.commit();
    logger.info(`Updated analytics_monthly/${yearMonth} for intervention write.`);
});
/**
 * Batch Layer: Nightly Reconciliation Cron Job (Lambda Architecture)
 * Runs every night at 03:00 AM to recalculate analytics_monthly for the current month
 */
exports.reconcileAnalyticsCron = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *',
    timeZone: 'Europe/Rome',
    region: REGION
}, async () => {
    logger.info('Starting nightly analytics reconciliation...');
    const db = admin.firestore();
    const now = new Date();
    const yearMonth = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
        const snap = await db.collection('interventions').get();
        let totalRevenue = 0;
        let totalHours = 0;
        let totalInterventions = 0;
        snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const rawDate = data.scheduledStartAt || data.createdAt;
            if (!rawDate)
                return;
            const d = new Date(rawDate);
            const ym = `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym === yearMonth) {
                totalRevenue += (data.totalAmount || 0);
                totalHours += (data.actualHoursWorked || data.actualQuantityWorked || 0);
                totalInterventions += 1;
            }
        });
        await db.collection('analytics_monthly').doc(yearMonth).set({
            totalRevenue,
            totalHours,
            totalInterventions,
            reconciledAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        logger.info(`Nightly reconciliation completed for analytics_monthly/${yearMonth}.`);
    }
    catch (err) {
        logger.error('Error during analytics reconciliation:', err);
    }
});
//# sourceMappingURL=analytics.js.map