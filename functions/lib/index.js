"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryFailedSyncs = exports.onPaymentCreated = exports.onInstallmentWrite = exports.onActivityCreated = exports.onContractUpdated = exports.onContractsPaidCreated = exports.onContractCreated = exports.sendSystemEmail = exports.updateProfileEmail = exports.updateProfile = exports.updateUser = exports.initSuperAdmin = exports.verifyLoginPin = exports.sendLoginPin = void 0;
const admin = require("firebase-admin");
// Initialize the Firebase Admin SDK once at startup
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// Export modularized functions
var auth_1 = require("./src/auth");
Object.defineProperty(exports, "sendLoginPin", { enumerable: true, get: function () { return auth_1.sendLoginPin; } });
Object.defineProperty(exports, "verifyLoginPin", { enumerable: true, get: function () { return auth_1.verifyLoginPin; } });
var admin_1 = require("./src/admin");
Object.defineProperty(exports, "initSuperAdmin", { enumerable: true, get: function () { return admin_1.initSuperAdmin; } });
Object.defineProperty(exports, "updateUser", { enumerable: true, get: function () { return admin_1.updateUser; } });
var profile_1 = require("./src/profile");
Object.defineProperty(exports, "updateProfile", { enumerable: true, get: function () { return profile_1.updateProfile; } });
Object.defineProperty(exports, "updateProfileEmail", { enumerable: true, get: function () { return profile_1.updateProfileEmail; } });
var email_1 = require("./src/email");
Object.defineProperty(exports, "sendSystemEmail", { enumerable: true, get: function () { return email_1.sendSystemEmail; } });
// Export new Firestore triggers
var onContractCreated_1 = require("./src/triggers/onContractCreated");
Object.defineProperty(exports, "onContractCreated", { enumerable: true, get: function () { return onContractCreated_1.onContractCreated; } });
var onContractsPaidCreated_1 = require("./src/triggers/onContractsPaidCreated");
Object.defineProperty(exports, "onContractsPaidCreated", { enumerable: true, get: function () { return onContractsPaidCreated_1.onContractsPaidCreated; } });
var onContractUpdated_1 = require("./src/triggers/onContractUpdated");
Object.defineProperty(exports, "onContractUpdated", { enumerable: true, get: function () { return onContractUpdated_1.onContractUpdated; } });
var onActivityCreated_1 = require("./src/triggers/onActivityCreated");
Object.defineProperty(exports, "onActivityCreated", { enumerable: true, get: function () { return onActivityCreated_1.onActivityCreated; } });
var onInstallmentWrite_1 = require("./src/triggers/onInstallmentWrite");
Object.defineProperty(exports, "onInstallmentWrite", { enumerable: true, get: function () { return onInstallmentWrite_1.onInstallmentWrite; } });
var onPaymentCreated_1 = require("./src/triggers/onPaymentCreated");
Object.defineProperty(exports, "onPaymentCreated", { enumerable: true, get: function () { return onPaymentCreated_1.onPaymentCreated; } });
var retryFailedSyncs_1 = require("./src/triggers/retryFailedSyncs");
Object.defineProperty(exports, "retryFailedSyncs", { enumerable: true, get: function () { return retryFailedSyncs_1.retryFailedSyncs; } });
//# sourceMappingURL=index.js.map