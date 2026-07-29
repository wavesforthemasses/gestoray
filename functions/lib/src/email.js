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
exports.sendSystemEmail = void 0;
exports.sendEmailViaResend = sendEmailViaResend;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
/**
 * Funzione generica per inviare email tramite le API di Resend (fetch puro, senza SDK)
 */
async function sendEmailViaResend(to, subject, html, fromName, fromEmail) {
    let finalFromName = fromName;
    let finalFromEmail = fromEmail;
    let dbApiKey = '';
    if (!fromName || !fromEmail) {
        try {
            const snap = await admin.firestore().doc('settings/project').get();
            if (snap.exists) {
                const data = snap.data();
                if (!finalFromName)
                    finalFromName = data?.projectName || 'CRM';
                if (!finalFromEmail)
                    finalFromEmail = data?.projectEmail || 'no-reply@crm.com';
                dbApiKey = data?.resendApiKey || '';
            }
        }
        catch (e) {
            console.error('Error fetching project settings for email', e);
        }
    }
    finalFromName = finalFromName || 'CRM';
    finalFromEmail = finalFromEmail || 'no-reply@crm.com';
    const apiKey = dbApiKey || config_1.config.RESEND_API_KEY;
    if (!apiKey || apiKey === 're_YOUR_KEY_HERE') {
        const toStr = Array.isArray(to) ? to.join(',') : to;
        console.log(`[sendEmailViaResend] Chiave vuota. Skip invio email a: ${toStr} | Oggetto: "${subject}"`);
        return true; // Simula il successo
    }
    const toArray = Array.isArray(to) ? to : [to];
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `${finalFromName} <${finalFromEmail}>`,
                to: toArray,
                subject: subject,
                html: html,
            }),
        });
        if (!res.ok) {
            console.error(`[sendEmailViaResend] Resend error per ${toArray.join(',')}: ${await res.text()}`);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error(`[sendEmailViaResend] Eccezione:`, error);
        return false;
    }
}
// Esempio di Callable Function per invio mail generico (protetto)
exports.sendSystemEmail = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
    }
    const { to, subject, html } = request.data;
    if (!to || !subject || !html) {
        throw new functions.https.HttpsError('invalid-argument', 'Parametri mancanti');
    }
    const success = await sendEmailViaResend(to, subject, html);
    return { success };
});
//# sourceMappingURL=email.js.map