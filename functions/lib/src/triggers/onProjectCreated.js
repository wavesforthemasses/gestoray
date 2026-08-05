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
exports.onProjectCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const REGION = 'europe-west3';
exports.onProjectCreated = (0, firestore_1.onDocumentWritten)({ region: REGION, document: 'projects/{projectId}' }, async (event) => {
    const db = admin.firestore();
    const afterData = event.data?.after?.data();
    const beforeData = event.data?.before?.data();
    const clientId = afterData?.original?.clientId || afterData?.clientId || beforeData?.original?.clientId || beforeData?.clientId;
    if (!clientId)
        return;
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
    }
    catch (e) {
        logger.error(`Error updating client stats on project write:`, e);
    }
});
//# sourceMappingURL=onProjectCreated.js.map