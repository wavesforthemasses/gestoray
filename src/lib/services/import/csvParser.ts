/**
 * High-Performance Robust CSV / TSV Parser
 * Handles escaped quotes, multiline values, BOM stripping, and delimiter auto-detection.
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  totalLines: number;
}

export class CsvParser {
  /**
   * Auto-detects the delimiter (comma, semicolon, tab, pipe) by inspecting the first line.
   */
  static detectDelimiter(text: string): string {
    const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
    const delimiters = [',', ';', '\t', '|'];
    let bestDelimiter = ',';
    let maxCount = -1;

    for (const delim of delimiters) {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < firstLine.length; i++) {
        const char = firstLine[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delim && !inQuotes) count++;
      }
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delim;
      }
    }
    return bestDelimiter;
  }

  /**
   * Parses raw CSV/TSV text into headers and array of row objects.
   */
  static parse(rawText: string, customDelimiter?: string): ParsedCsvResult {
    // Strip UTF-8 BOM
    let text = rawText.replace(/^\uFEFF/, '').trim();
    if (!text) {
      return { headers: [], rows: [], delimiter: ',', totalLines: 0 };
    }

    const delimiter = customDelimiter || this.detectDelimiter(text);
    const parsedMatrix: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote ("")
          currentCell += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n in \r\n
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          parsedMatrix.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    // Push trailing cell & row if non-empty
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        parsedMatrix.push(currentRow);
      }
    }

    if (parsedMatrix.length === 0) {
      return { headers: [], rows: [], delimiter, totalLines: 0 };
    }

    // Extract headers (first row) and sanitize header strings
    const rawHeaders = parsedMatrix[0];
    const headers = rawHeaders.map((h, idx) => h.trim() || `Column_${idx + 1}`);

    const rows: Record<string, string>[] = [];
    for (let r = 1; r < parsedMatrix.length; r++) {
      const rowValues = parsedMatrix[r];
      const rowObj: Record<string, string> = {};
      let hasData = false;

      headers.forEach((header, colIdx) => {
        const val = rowValues[colIdx] !== undefined ? rowValues[colIdx] : '';
        rowObj[header] = val;
        if (val) hasData = true;
      });

      if (hasData) {
        rows.push(rowObj);
      }
    }

    return {
      headers,
      rows,
      delimiter,
      totalLines: rows.length
    };
  }
}
