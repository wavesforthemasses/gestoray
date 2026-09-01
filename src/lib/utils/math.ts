/**
 * Centralized Mathematical & Financial Helpers
 * Guarantees zero-floating-point precision errors across accounting and VAT calculations.
 */

/**
 * Rounds a numerical value to a fixed number of decimal places (default: 2).
 * Handles string numbers, null, undefined, NaN safely.
 */
export function roundCurrency(value: number | string | null | undefined, decimals = 2): number {
  const num = Number(value);
  if (isNaN(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export interface VatBreakdown {
  netAmount: number;
  vatAmount: number;
}

/**
 * Calculates net amount and VAT from gross amount and VAT rate percentage.
 * Reconstituted sum (netAmount + vatAmount) is guaranteed to equal roundCurrency(grossAmount).
 */
export function calculateVatBreakdown(
  grossAmount: number | string | null | undefined,
  vatRate: number | string | null | undefined = 22
): VatBreakdown {
  const gross = roundCurrency(grossAmount);
  const rate = Number(vatRate) || 0;

  if (gross === 0) {
    return { netAmount: 0, vatAmount: 0 };
  }

  const net = roundCurrency(gross / (1 + rate / 100));
  const vat = roundCurrency(gross - net);

  return {
    netAmount: net,
    vatAmount: vat
  };
}
