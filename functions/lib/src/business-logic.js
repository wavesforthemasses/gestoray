"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCommission = calculateCommission;
/**
 * Centralized business logic for contract commissions.
 * Calculates total commission, primary vendor share, and secondary co-seller share.
 */
function calculateCommission(products, qualification, secondVendorShare) {
    let total = 0;
    (products || []).forEach((p) => {
        const sold = p.priceSold || 0;
        const qty = p.quantity || 0;
        const itemTotal = sold * qty;
        const commPct = qualification ? qualification.percentage : 0;
        total += itemTotal * (commPct / 100);
    });
    const share = secondVendorShare || 0;
    const secondary = (total * share) / 100;
    const primary = total - secondary;
    return {
        total: parseFloat(total.toFixed(2)),
        primary: parseFloat(primary.toFixed(2)),
        secondary: parseFloat(secondary.toFixed(2))
    };
}
//# sourceMappingURL=business-logic.js.map