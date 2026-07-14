"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSystemEmail = void 0;
exports.sendEmailViaResend = sendEmailViaResend;
const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
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