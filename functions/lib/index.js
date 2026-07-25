"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileAnalyticsCron = exports.onInterventionWriteAnalytics = exports.onClientUpdated = exports.onClientCreated = exports.getChartAggregations = exports.sendSystemEmail = exports.updateProfileEmail = exports.updateProfile = exports.updateUser = exports.initSuperAdmin = exports.verifyLoginPin = exports.sendLoginPin = void 0;
const admin = require("firebase-admin");
const v2_1 = require("firebase-functions/v2");
(0, v2_1.setGlobalOptions)({ region: 'europe-west3' });
// Initialize the Firebase Admin SDK once at startup
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// Export Core functions
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
var aggregations_1 = require("./src/aggregations");
Object.defineProperty(exports, "getChartAggregations", { enumerable: true, get: function () { return aggregations_1.getChartAggregations; } });
// Export Core Firestore triggers
var onClientCreated_1 = require("./src/triggers/onClientCreated");
Object.defineProperty(exports, "onClientCreated", { enumerable: true, get: function () { return onClientCreated_1.onClientCreated; } });
Object.defineProperty(exports, "onClientUpdated", { enumerable: true, get: function () { return onClientCreated_1.onClientUpdated; } });
var analytics_1 = require("./src/analytics");
Object.defineProperty(exports, "onInterventionWriteAnalytics", { enumerable: true, get: function () { return analytics_1.onInterventionWriteAnalytics; } });
Object.defineProperty(exports, "reconcileAnalyticsCron", { enumerable: true, get: function () { return analytics_1.reconcileAnalyticsCron; } });
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
// Module Exports
//# sourceMappingURL=index.js.map