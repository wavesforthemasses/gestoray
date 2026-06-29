import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK once at startup
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export modularized functions
export { sendLoginPin, verifyLoginPin } from './src/auth';
export { initSuperAdmin, updateUser } from './src/admin';
export { updateProfile, updateProfileEmail } from './src/profile';
export { sendSystemEmail } from './src/email';

// Export new Firestore triggers
export { onContractCreated } from './src/triggers/onContractCreated';
export { onContractsPaidCreated } from './src/triggers/onContractsPaidCreated';
export { onContractUpdated } from './src/triggers/onContractUpdated';
export { onActivityCreated } from './src/triggers/onActivityCreated';
export { onInstallmentWrite } from './src/triggers/onInstallmentWrite';
export { onPaymentCreated } from './src/triggers/onPaymentCreated';
export { retryFailedSyncs } from './src/triggers/retryFailedSyncs';
