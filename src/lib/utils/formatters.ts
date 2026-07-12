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
