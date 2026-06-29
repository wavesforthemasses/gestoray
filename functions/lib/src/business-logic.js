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
        const list = p.listPrice || 0;
        const min = p.minPrice || 0;
        const sold = p.priceSold || 0;
        const qty = p.quantity || 0;
        const itemTotal = sold * qty;
        let ratio = 1;
        if (list > min) {
            ratio = (sold - min) / (list - min);
            if (ratio < 0)
                ratio = 0;
            if (ratio > 1)
                ratio = 1;
        }
        let commPct = 0;
        if (qualification === 'senior') {
            commPct = 5.0 + ratio * 5.0; // 5.0% to 10.0%
        }
        else {
            commPct = 2.5 + ratio * 5.0; // 2.5% to 7.5%
        }
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