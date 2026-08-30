import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { generateSearchTerms } from '../search-utils';
import modulesRegistry from '../config/modules.registry.json';

export function extractClientSearchTerms(data: any): string[] {
  const orig = data.original || data || {};
  const clientName = (orig.ragioneSociale || orig.companyName || orig.nome || orig.cognome || '').trim();
  const contactName = orig.cognome ? orig.cognome.trim() : undefined;
  return generateSearchTerms(clientName, contactName, orig.partitaIva, orig.codiceFiscale);
}

export const onClientCreated = onDocumentCreated('clients/{clientId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  const terms = extractClientSearchTerms(data);

  await snapshot.ref.update({
    'derived.textSearch': terms
  });
});

export const onClientUpdated = onDocumentUpdated('clients/{clientId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const afterData = snapshot.after.data();
  const beforeData = snapshot.before.data();

  const clientId = event.params.clientId;
  const db = admin.firestore();

  // 1. Check for GDPR Anonymization transition (isAnonymized: false -> true)
  const afterIsAnon = afterData.original?.isAnonymized || afterData.isAnonymized;
  const beforeIsAnon = beforeData.original?.isAnonymized || beforeData.isAnonymized;

  if (afterIsAnon && !beforeIsAnon) {
    try {
      logger.info(`[GDPR CASCADE] Starting dynamic modular anonymization for client ${clientId}`);
      const batch = db.batch();

      const activeModules = (modulesRegistry as any).modules || [];

      for (const mod of activeModules) {
        if (!mod.anonymization || !mod.anonymization.collectionName) continue;
        const modSpec = mod.anonymization;

        try {
          const isLinkArray = modSpec.isLinkArray || false;
          const linkField = modSpec.linkFieldPath || (isLinkArray ? 'original.linkedClientIds' : 'original.clientId');
          const operator = isLinkArray ? 'array-contains' : '==';

          let snap = await db.collection(modSpec.collectionName).where(linkField, operator, clientId).get();

          // Fallback for legacy flat documents
          if (!isLinkArray && snap.empty) {
            snap = await db.collection(modSpec.collectionName).where('clientId', '==', clientId).get();
          }

          if (!snap.empty) {
            snap.forEach((docSnap) => {
              const updatePayload: Record<string, any> = {};
              for (const f of modSpec.redactFields) {
                updatePayload[f.fieldPath] = f.replacement;
              }
              batch.update(docSnap.ref, updatePayload);
            });
            logger.info(`[GDPR CASCADE] Module ${modSpec.moduleName} (${snap.size} docs) queued for anonymization.`);
          }
        } catch (modErr) {
          logger.warn(`[GDPR CASCADE] Module ${modSpec.moduleName} skipped or not present:`, modErr);
        }
      }

      await batch.commit();
      logger.info(`[GDPR CASCADE SUCCESS] Dynamic modular cascade completed for client ${clientId}`);
    } catch (error) {
      logger.error(`[GDPR CASCADE ERROR] Failed dynamic cascade for client ${clientId}`, error);
    }
  }

  // 2. Update search terms if changed
  const afterTerms = extractClientSearchTerms(afterData);
  const beforeTerms = extractClientSearchTerms(beforeData);

  if (JSON.stringify(afterTerms) !== JSON.stringify(beforeTerms)) {
    await snapshot.after.ref.update({
      'derived.textSearch': afterTerms
    });
  }
});
