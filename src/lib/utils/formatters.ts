/**
 * Format a number as EUR currency.
 */
export function formatCurrency(value: number): string {
  if (typeof value !== 'number') return '€ 0.00';
  return '€ ' + value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

