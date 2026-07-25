"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClientUpdated = exports.onClientCreated = void 0;
exports.extractClientSearchTerms = extractClientSearchTerms;
const firestore_1 = require("firebase-functions/v2/firestore");
const search_utils_1 = require("../search-utils");
function extractClientSearchTerms(data) {
    const orig = data.original || data || {};
    const clientName = `${orig.nome || orig.ragioneSociale || orig.companyName || ''} ${orig.cognome || ''}`.trim();
    return (0, search_utils_1.generateSearchTerms)(clientName, orig.partitaIva, orig.codiceFiscale);
}
exports.onClientCreated = (0, firestore_1.onDocumentCreated)('clients/{clientId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const data = snapshot.data();
    const terms = extractClientSearchTerms(data);
    await snapshot.ref.update({
        'derived.textSearch': terms
    });
});
exports.onClientUpdated = (0, firestore_1.onDocumentUpdated)('clients/{clientId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
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
//# sourceMappingURL=onClientCreated.js.map