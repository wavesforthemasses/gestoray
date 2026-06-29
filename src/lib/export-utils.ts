/**
 * Export utilities for generating CSV and Excel-compatible files, and print styles.
 */

// Helper to escape CSV/TSV values
function escapeValue(val: any, separator: string): string {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/"/g, '""');
  // If value contains separator, newline or quotes, wrap in quotes
  if (str.includes(separator) || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

/**
 * Exports an array of objects to a CSV file.
 * Includes UTF-8 BOM (\uFEFF) for Excel compatibility.
 */
export function exportToCSV(data: any[], columns: Array<{ key: string, header: string }>, filename: string) {
  if (data.length === 0) return;

  const separator = ',';
  const headersRow = columns.map(c => escapeValue(c.header, separator)).join(separator);
  
  const rows = data.map(item => {
    return columns.map(c => {
      let val = item[c.key];
      // Format arrays/objects nicely if present
      if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      return escapeValue(val, separator);
    }).join(separator);
  });

  const csvContent = '\uFEFF' + [headersRow, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports an array of objects to a Tab-Separated Values (TSV) file,
 * which Excel opens natively and flawlessly when named with a .xls extension.
 */
export function exportToExcel(data: any[], columns: Array<{ key: string, header: string }>, filename: string) {
  if (data.length === 0) return;

  const separator = '\t';
  const headersRow = columns.map(c => escapeValue(c.header, separator)).join(separator);
  
  const rows = data.map(item => {
    return columns.map(c => {
      let val = item[c.key];
      if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      return escapeValue(val, separator);
    }).join(separator);
  });

  const excelContent = '\uFEFF' + [headersRow, ...rows].join('\r\n');
  const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers browser native print dialog.
 */
export function triggerPrint() {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
