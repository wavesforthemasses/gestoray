import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

const REGION = 'europe-west3';

export const onCantiereCreated = onDocumentCreated(
  { region: REGION, document: 'cantieri/{cantiereId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const clientId = data.clientId || data.original?.clientId;
    if (!clientId) return;

    const db = admin.firestore();

    try {
      // Recalculate client's total and active cantieri count
      const cantieriSnap = await db.collection('cantieri').where('clientId', '==', clientId).get();
      let totalCount = 0;
      let activeCount = 0;

      cantieriSnap.forEach(d => {
        totalCount += 1;
        const st = d.data().status || d.data().original?.status;
        if (st === 'aperto' || st === 'fase_contrattuale') {
          activeCount += 1;
        }
      });

      await db.collection('clients').doc(clientId).set({
        derived: {
          cantieriCount: totalCount,
          activeCantieriCount: activeCount
        }
      }, { merge: true });

    } catch (err) {
      console.error(`Error in onCantiereCreated trigger for ${event.params.cantiereId}:`, err);
    }
  }
);
