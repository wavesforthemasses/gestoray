/**
 * Safely parse any value into a finite number, falling back to a default (0).
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.');
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Format any value into a decimal string with fixed precision (default 2), preventing .toFixed crashes.
 */
export function formatNumber(value: unknown, decimals: number = 2, fallback: string = '0.00'): string {
  const num = safeNumber(value, NaN);
  if (isNaN(num)) return fallback;
  return (Number(num) || 0).toFixed(decimals);
}

/**
 * Format a number or numeric string as EUR currency safely.
 */
export function formatCurrency(value: unknown): string {
  const num = safeNumber(value, 0);
  return '€ ' + num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format an ISO date string to a simple Italian date (dd/mm/yyyy).
 */
export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return '';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format an ISO date string to a simple Italian date with time (dd/mm/yyyy HH:mm).
 */
export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export type AddressInput = string | {
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
} | null | undefined;

/**
 * Format a string or structured Address object into a clean, human-readable address line.
 * Avoids '[object Object]' when an object is passed.
 */
export function formatAddress(address: AddressInput): string {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  if (typeof address === 'object') {
    const parts = [
      address.street,
      [address.zip, address.city].filter(Boolean).join(' '),
      address.province ? `(${address.province})` : ''
    ].filter(Boolean);
    return parts.join(', ').trim();
  }
  return '';
}

