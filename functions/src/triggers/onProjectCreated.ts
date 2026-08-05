import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const REGION = 'europe-west3';

export const onProjectCreated = onDocumentWritten(
  { region: REGION, document: 'projects/{projectId}' },
  async (event) => {
    const db = admin.firestore();
    const afterData = event.data?.after?.data();
    const beforeData = event.data?.before?.data();

    const clientId = afterData?.original?.clientId || afterData?.clientId || beforeData?.original?.clientId || beforeData?.clientId;
    if (!clientId) return;

    try {
      // Recalculate client's total and active projects count
      const projectsSnap = await db.collection('projects').where('clientId', '==', clientId).get();
      let totalCount = 0;
      let activeCount = 0;

      projectsSnap.forEach(d => {
        totalCount += 1;
        const data = d.data();
        const status = data.status || data.original?.status;
        if (status === 'aperto' || status === 'fase_contrattuale') {
          activeCount += 1;
        }
      });

      await db.collection('clients').doc(clientId).update({
        'derived.projectsCount': totalCount,
        'derived.activeProjectsCount': activeCount
      });
    } catch (e) {
      logger.error(`Error updating client stats on project write:`, e);
    }
  }
);
