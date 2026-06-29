"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onContractUpdated = void 0;
exports.runContractUpdated = runContractUpdated;
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const REGION = 'europe-west3';
async function runContractUpdated(db, contractId) {
    // Deprecated: onContractCreated (onDocumentWritten) now handles all contract updates and synchronizations.
    logger.info(`runContractUpdated called for contract ${contractId} (deprecated no-op)`);
}
exports.onContractUpdated = (0, firestore_1.onDocumentUpdated)({ region: REGION, document: 'contracts/{contractId}' }, async (event) => {
    // Deprecated: handled by the onDocumentWritten trigger in onContractCreated
    logger.info(`onContractUpdated triggered for contract ${event.params.contractId} (deprecated no-op)`);
});
//# sourceMappingURL=onContractUpdated.js.map