import * as admin from 'firebase-admin';
import { AggregateField } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const getChartAggregations = onCall({ region: 'europe-west3', cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Devi essere loggato.');
  }

  const { entity, periods, filters } = request.data;
  
  if (!entity || !periods || !Array.isArray(periods)) {
    throw new HttpsError('invalid-argument', 'Parametri mancanti.');
  }

  const db = admin.firestore();
  const results = [];

  try {
    for (const period of periods) {
      try {
        if (entity === 'activities') {
          let q: admin.firestore.Query = db.collectionGroup('activities');
          if (filters?.type && filters.type !== 'all') {
            q = q.where('original.type', '==', filters.type);
          }
          if (filters?.loggedBy) {
            q = q.where('original.loggedBy', '==', filters.loggedBy);
          }
          q = q.where('edits.createdAt', '>=', period.start).where('edits.createdAt', '<=', period.end);
          const snapshot = await q.count().get();
          results.push(snapshot.data().count || 0);

        } else if (entity === 'vss') {
          let q: admin.firestore.Query = db.collection('contracts');
          if (filters?.vendorUid) {
            q = q.where('original.vendorUid', '==', filters.vendorUid);
          }
          q = q.where('edits.createdAt', '>=', period.start).where('edits.createdAt', '<=', period.end);
          // @ts-ignore
          const snapshot = await q.aggregate({ total: AggregateField.sum('original.totalPrice') }).get();
          let total = snapshot.data().total || 0;

          if (filters?.vendorUid) {
            let q2 = db.collection('contracts')
              .where('original.secondVendorUid', '==', filters.vendorUid)
              .where('edits.createdAt', '>=', period.start)
              .where('edits.createdAt', '<=', period.end);
            // @ts-ignore
            const snap2 = await q2.aggregate({ total: AggregateField.sum('original.totalPrice') }).get();
            total += snap2.data().total || 0;
          }
          results.push(total);

        } else if (entity === 'gi' || entity === 'payments') {
          let payQuery: admin.firestore.Query = db.collection('payments');
          payQuery = payQuery.where('original.date', '>=', period.start).where('original.date', '<=', period.end);
          
          if (filters?.vendorUid) {
             const pSnap = await db.collection('contracts').where('original.vendorUid', '==', filters.vendorUid).get();
             const sSnap = await db.collection('contracts').where('original.secondVendorUid', '==', filters.vendorUid).get();
             const myContractIds = new Set<string>();
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
          } else {
             // @ts-ignore
             const snapshot = await payQuery.aggregate({ total: AggregateField.sum('original.amount') }).get();
             results.push(snapshot.data().total || 0);
          }

        } else if (entity === 'nuove_anagrafiche') {
          let q: admin.firestore.Query = db.collection('clients');
          if (filters?.createdBy) {
            q = q.where('original.createdBy', '==', filters.createdBy);
          }
          q = q.where('edits.createdAt', '>=', period.start).where('edits.createdAt', '<=', period.end);
          const snapshot = await q.count().get();
          results.push(snapshot.data().count || 0);

        } else if (entity === 'nncf') {
          let q: admin.firestore.Query = db.collection('clients');
          if (filters?.createdBy) {
            q = q.where('original.createdBy', '==', filters.createdBy);
          }
          q = q.where('derived.nncfDate', '>=', period.start).where('derived.nncfDate', '<=', period.end);
          const snapshot = await q.count().get();
          results.push(snapshot.data().count || 0);

        } else if (entity === 'provvigioni_maturate') {
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
                const myBreakdown = version.breakdown?.find((b: any) => b.uid === filters.vendorUid);
                if (myBreakdown) totalComm += (myBreakdown.commission || 0);
              } else {
                totalComm += (version.totalCommissions || 0);
              }
            }
          }
          results.push(totalComm);
          
        } else {
          results.push(0);
        }
      } catch (subErr) {
        console.warn(`Safe fallback for entity ${entity}:`, subErr);
        results.push(0);
      }
    }

    return { data: results };
  } catch (error) {
    console.error('Aggregation error:', error);
    throw new HttpsError('internal', 'Errore nel calcolo delle aggregazioni.');
  }
});

/**
 * scheduledReconciliation (Nightly Cron Job)
 * Self-healing reconciliation engine that runs at 03:00 AM.
 * Instead of scanning full database history, it ONLY recalculates months flagged in `system_dirty_periods`.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';

export const scheduledReconciliation = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Europe/Rome', region: 'europe-west3' },
  async () => {
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
        const salesSnap = await db.collection('contracts')
          .where('edits.createdAt', '>=', startDate)
          .where('edits.createdAt', '<=', endDate)
          .get();

        let monthlyTotalSales = 0;
        let monthlyApprovedSales = 0;
        salesSnap.forEach(sDoc => {
          const cData = sDoc.data()?.original || {};
          monthlyTotalSales += (cData.totalPrice || 0);
          if (cData.status === 'approved') {
            monthlyApprovedSales += (cData.totalPrice || 0);
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
    } catch (error) {
      logger.error('[NIGHTLY RECONCILIATION ERROR] Failed during scheduled reconciliation:', error);
    }
  }
);
