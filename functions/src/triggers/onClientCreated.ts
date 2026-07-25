import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { generateSearchTerms } from '../search-utils';

export function extractClientSearchTerms(data: any): string[] {
  const orig = data.original || data || {};
  const clientName = `${orig.nome || orig.ragioneSociale || orig.companyName || ''} ${orig.cognome || ''}`.trim();
  return generateSearchTerms(clientName, orig.partitaIva, orig.codiceFiscale);
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

  const afterTerms = extractClientSearchTerms(afterData);
  const beforeTerms = extractClientSearchTerms(beforeData);

  if (JSON.stringify(afterTerms) !== JSON.stringify(beforeTerms)) {
    await snapshot.after.ref.update({
      'derived.textSearch': afterTerms
    });
  }
});
