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
exports.reconcileAnalyticsCron = exports.onInterventionWriteAnalytics = exports.onActivityCreated = exports.onContractsPaidCreated = exports.onPaymentCreated = exports.onInstallmentWrite = exports.onContractCreated = exports.auditLogger = exports.onClientUpdated = exports.onClientCreated = exports.scheduledReconciliation = exports.getChartAggregations = exports.sendSystemEmail = exports.updateProfileEmail = exports.updateProfile = exports.updateUser = exports.initSuperAdmin = exports.verifyLoginPin = exports.sendLoginPin = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
(0, v2_1.setGlobalOptions)({ region: 'europe-west3' });
if (admin.apps.length === 0) {
    admin.initializeApp();
}
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
Object.defineProperty(exports, "scheduledReconciliation", { enumerable: true, get: function () { return aggregations_1.scheduledReconciliation; } });
var onClientCreated_1 = require("./src/triggers/onClientCreated");
Object.defineProperty(exports, "onClientCreated", { enumerable: true, get: function () { return onClientCreated_1.onClientCreated; } });
Object.defineProperty(exports, "onClientUpdated", { enumerable: true, get: function () { return onClientCreated_1.onClientUpdated; } });
var auditLogger_1 = require("./src/triggers/auditLogger");
Object.defineProperty(exports, "auditLogger", { enumerable: true, get: function () { return auditLogger_1.auditLogger; } });
// --- MODULE FUNCTIONS: contracts BEGIN ---
var onContractCreated_1 = require("./src/triggers/onContractCreated");
Object.defineProperty(exports, "onContractCreated", { enumerable: true, get: function () { return onContractCreated_1.onContractCreated; } });
var onInstallmentWrite_1 = require("./src/triggers/onInstallmentWrite");
Object.defineProperty(exports, "onInstallmentWrite", { enumerable: true, get: function () { return onInstallmentWrite_1.onInstallmentWrite; } });
// --- MODULE FUNCTIONS: contracts END ---
// --- MODULE FUNCTIONS: payments BEGIN ---
var onPaymentCreated_1 = require("./src/triggers/onPaymentCreated");
Object.defineProperty(exports, "onPaymentCreated", { enumerable: true, get: function () { return onPaymentCreated_1.onPaymentCreated; } });
var onContractsPaidCreated_1 = require("./src/triggers/onContractsPaidCreated");
Object.defineProperty(exports, "onContractsPaidCreated", { enumerable: true, get: function () { return onContractsPaidCreated_1.onContractsPaidCreated; } });
// --- MODULE FUNCTIONS: payments END ---
// --- MODULE FUNCTIONS: activities BEGIN ---
var onActivityCreated_1 = require("./src/triggers/onActivityCreated");
Object.defineProperty(exports, "onActivityCreated", { enumerable: true, get: function () { return onActivityCreated_1.onActivityCreated; } });
// --- MODULE FUNCTIONS: activities END ---
// --- MODULE FUNCTIONS: interventi BEGIN ---
var analytics_1 = require("./src/analytics");
Object.defineProperty(exports, "onInterventionWriteAnalytics", { enumerable: true, get: function () { return analytics_1.onInterventionWriteAnalytics; } });
Object.defineProperty(exports, "reconcileAnalyticsCron", { enumerable: true, get: function () { return analytics_1.reconcileAnalyticsCron; } });
// --- MODULE FUNCTIONS: interventi END ---
//# sourceMappingURL=index.js.map