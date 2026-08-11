import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'europe-west3' });

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { sendLoginPin, verifyLoginPin } from './src/auth';
export { initSuperAdmin, updateUser } from './src/admin';
export { updateProfile, updateProfileEmail } from './src/profile';
export { sendSystemEmail } from './src/email';
export { getChartAggregations } from './src/aggregations';
export { onClientCreated, onClientUpdated } from './src/triggers/onClientCreated';

// --- MODULE FUNCTIONS: contracts BEGIN ---
export { onContractCreated } from './src/triggers/onContractCreated';
export { onInstallmentWrite } from './src/triggers/onInstallmentWrite';
// --- MODULE FUNCTIONS: contracts END ---
