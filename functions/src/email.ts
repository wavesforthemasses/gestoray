import * as functions from 'firebase-functions/v2';
import { config } from './config';

/**
 * Funzione generica per inviare email tramite le API di Resend (fetch puro, senza SDK)
 */
export async function sendEmailViaResend(
  to: string | string[],
  subject: string,
  html: string,
  fromName: string = 'Gestoray',
  fromEmail: string = 'no-reply@gestoray.com'
): Promise<boolean> {
  const apiKey = config.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_YOUR_KEY_HERE') {
    const toStr = Array.isArray(to) ? to.join(',') : to;
    console.log(`[sendEmailViaResend] Chiave vuota. Simulazione invio email a: ${toStr} | Oggetto: "${subject}"`);
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
        from: `${fromName} <${fromEmail}>`,
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
  } catch (error) {
    console.error(`[sendEmailViaResend] Eccezione:`, error);
    return false;
  }
}

// Esempio di Callable Function per invio mail generico (protetto)
export const sendSystemEmail = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Utente non autenticato');
  }
  
  const { to, subject, html } = request.data as any;
  if (!to || !subject || !html) {
    throw new functions.https.HttpsError('invalid-argument', 'Parametri mancanti');
  }

  const success = await sendEmailViaResend(to, subject, html);
  return { success };
});
