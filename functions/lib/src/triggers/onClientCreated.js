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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClientUpdated = exports.onClientCreated = void 0;
exports.extractClientSearchTerms = extractClientSearchTerms;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const search_utils_1 = require("../search-utils");
const modules_registry_json_1 = __importDefault(require("../config/modules.registry.json"));
function extractClientSearchTerms(data) {
    const orig = data.original || data || {};
    const clientName = (orig.ragioneSociale || orig.companyName || orig.nome || orig.cognome || '').trim();
    const contactName = orig.cognome ? orig.cognome.trim() : undefined;
    return (0, search_utils_1.generateSearchTerms)(clientName, contactName, orig.partitaIva, orig.codiceFiscale);
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
    const clientId = event.params.clientId;
    const db = admin.firestore();
    // 1. Check for GDPR Anonymization transition (isAnonymized: false -> true)
    const afterIsAnon = afterData.original?.isAnonymized || afterData.isAnonymized;
    const beforeIsAnon = beforeData.original?.isAnonymized || beforeData.isAnonymized;
    if (afterIsAnon && !beforeIsAnon) {
        try {
            logger.info(`[GDPR CASCADE] Starting dynamic modular anonymization for client ${clientId}`);
            const batch = db.batch();
            const activeModules = modules_registry_json_1.default.modules || [];
            for (const mod of activeModules) {
                if (!mod.anonymization || !mod.anonymization.collectionName)
                    continue;
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
                            const updatePayload = {};
                            for (const f of modSpec.redactFields) {
                                updatePayload[f.fieldPath] = f.replacement;
                            }
                            batch.update(docSnap.ref, updatePayload);
                        });
                        logger.info(`[GDPR CASCADE] Module ${modSpec.moduleName} (${snap.size} docs) queued for anonymization.`);
                    }
                }
                catch (modErr) {
                    logger.warn(`[GDPR CASCADE] Module ${modSpec.moduleName} skipped or not present:`, modErr);
                }
            }
            await batch.commit();
            logger.info(`[GDPR CASCADE SUCCESS] Dynamic modular cascade completed for client ${clientId}`);
        }
        catch (error) {
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
//# sourceMappingURL=onClientCreated.js.map