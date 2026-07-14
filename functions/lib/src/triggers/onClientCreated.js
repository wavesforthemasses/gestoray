"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClientCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
exports.onClientCreated = (0, firestore_1.onDocumentCreated)('clients/{clientId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const data = snapshot.data();
    const orig = data.original || {};
    const generateSearchTerms = (text) => {
        if (!text)
            return [];
        const tokens = text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(t => t.trim().length > 0);
        const result = new Set();
        tokens.forEach(t => {
            let current = '';
            for (const char of t) {
                current += char;
                result.add(current);
            }
        });
        return Array.from(result);
    };
    const strToSearch = `${orig.nome || ''} ${orig.partitaIva || ''} ${orig.codiceFiscale || ''}`.trim();
    const terms = generateSearchTerms(strToSearch);
    await snapshot.ref.update({
        derived: {
            contractsCount: 0,
            approvedContractsCount: 0,
            totalContractValue: 0,
            totalPaid: 0,
            totalRemaining: 0,
            activitiesCount: 0,
            quotesCount: 0,
            nncfDate: null,
            nncfOrderId: null,
            lastActivityDate: null,
            textSearch: terms
        }
    });
});
//# sourceMappingURL=onClientCreated.js.map