import { db, collection, addDoc, serverTimestamp } from '$lib/firebase';
import type {
  ImportModuleSpec,
  ImportFieldDef,
  ImportRowState,
  ConflictStrategy,
  ImportBatchReport,
  ImportSessionMap,
  MatchStatus
} from '$lib/types/importTypes';
import { CsvParser } from './csvParser';
import { EntityResolutionService } from './entityResolutionService';
import { uuidv7 } from 'uuidv7';

export class ImportEngineService {
  /**
   * Automatically maps CSV headers to module fields based on string similarity.
   */
  static autoMapHeaders(
    csvHeaders: string[],
    moduleFields: ImportFieldDef[]
  ): Record<string, string> {
    const mapping: Record<string, string> = {}; // fieldKey -> csvHeader or generatorKey

    for (const field of moduleFields) {
      const cleanFieldKey = EntityResolutionService.cleanKey(field.key);
      const cleanFieldLabel = EntityResolutionService.cleanKey(field.label);

      let matchedHeader = '';
      for (const header of csvHeaders) {
        const cleanHeader = EntityResolutionService.cleanKey(header);
        if (cleanHeader === cleanFieldKey || cleanHeader === cleanFieldLabel) {
          matchedHeader = header;
          break;
        }
      }

      if (matchedHeader) {
        mapping[field.key] = matchedHeader;
      }
    }

    return mapping;
  }

  /**
   * Parses Italian & international currency / numeric strings reliably.
   * Examples: "€350,00" -> 350, "1.250,50" -> 1250.50, "270.00 €" -> 270
   */
  static parseNumberValue(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;

    let str = String(val).replace(/[^0-9.,-]/g, '').trim();
    if (!str) return 0;

    // Handle Italian format (1.250,50 -> 1250.50)
    if (str.includes(',') && str.includes('.')) {
      if (str.indexOf('.') < str.indexOf(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parses Italian (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY) and ISO date strings.
   */
  static parseDateValue(val: any): string | null {
    if (!val) return null;
    const str = String(val).trim();
    if (!str) return null;

    // Match DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const dateObj = new Date(Date.UTC(year, month, day));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString();
      }
    }

    // Match YYYY-MM-DD, YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const dateObj = new Date(Date.UTC(year, month, day));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString();
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }

    return null;
  }

  /**
   * Pre-Flight Validation Mode: Evaluates data types, required fields, auto-generators, and entity references.
   */
  static validateRows(
    rows: Record<string, string>[],
    spec: ImportModuleSpec,
    columnMapping: Record<string, string>,
    sessionMap: ImportSessionMap = {}
  ): ImportRowState[] {
    const rowStates: ImportRowState[] = [];

    rows.forEach((rawData, idx) => {
      const mappedData: Record<string, any> = {};
      const errors: string[] = [];

      for (const field of spec.fields) {
        const csvHeaderOrGenKey = columnMapping[field.key];

        // 1. AUTO-GENERATION HANDLERS
        if (csvHeaderOrGenKey === '__auto_uuid') {
          mappedData[field.key] = uuidv7();
          continue;
        } else if (csvHeaderOrGenKey === '__auto_seq') {
          mappedData[field.key] = idx + 1;
          continue;
        } else if (csvHeaderOrGenKey && csvHeaderOrGenKey.startsWith('__custom_gen_')) {
          const genKey = csvHeaderOrGenKey.replace('__custom_gen_', '');
          const customGen = field.autoGenerators?.find((g) => g.key === genKey);
          if (customGen) {
            mappedData[field.key] = customGen.generate(idx, rawData);
            continue;
          }
        }

        // 2. STANDARD CSV COLUMN VALUE PROCESSING
        const rawValue = csvHeaderOrGenKey ? rawData[csvHeaderOrGenKey] : '';

        if (!rawValue && field.required) {
          errors.push(`Campo obbligatorio "${field.label}" mancante`);
          continue;
        }

        if (!rawValue && field.defaultValue !== undefined) {
          mappedData[field.key] = field.defaultValue;
          continue;
        }

        if (!rawValue) {
          mappedData[field.key] = null;
          continue;
        }

        // Value parsing & validation by type
        try {
          switch (field.type) {
            case 'number':
            case 'currency': {
              const num = this.parseNumberValue(rawValue);
              mappedData[field.key] = num;
              break;
            }
            case 'boolean': {
              const lower = String(rawValue).toLowerCase().trim();
              mappedData[field.key] = ['true', '1', 'si', 'sì', 'yes'].includes(lower);
              break;
            }
            case 'date': {
              const parsedIso = this.parseDateValue(rawValue);
              if (!parsedIso) {
                errors.push(`"${field.label}" deve essere una data valida (${rawValue})`);
              } else {
                mappedData[field.key] = parsedIso;
              }
              break;
            }
            case 'string':
            default: {
              if (field.validationRegex && !field.validationRegex.test(rawValue)) {
                errors.push(`"${field.label}" formato non valido (${rawValue})`);
              } else {
                mappedData[field.key] = String(rawValue).trim();
              }
              break;
            }
          }
        } catch (err: any) {
          errors.push(`Errore nel campo "${field.label}": ${err.message}`);
        }
      }


      // Perform Entity Reference resolution if lookupKeys defined
      let matchStatus: MatchStatus | undefined = undefined;
      let matchedEntityId = undefined;
      let matchedEntityName = undefined;
      let candidateEntities: { id: string; name: string }[] = [];

      if (spec.lookupKeys && spec.lookupKeys.length > 0) {
        for (const lookupKey of spec.lookupKeys) {
          const val = mappedData[lookupKey] || rawData[lookupKey];
          if (val) {
            const res = EntityResolutionService.resolveEntity(spec.entityType, val);
            matchStatus = res.status;
            if (res.status === 'EXACT_MATCH') {
              matchedEntityId = res.matchedId;
              matchedEntityName = res.matchedName;
              break;
            } else if (res.status === 'AMBIGUOUS_MATCH') {
              candidateEntities = res.candidates;
            }
          }
        }
      }

      let status: ImportRowState['status'] = 'valid';
      if (errors.length > 0) {
        status = 'invalid';
      } else if (matchStatus === 'AMBIGUOUS_MATCH') {
        status = 'ambiguous';
      } else {
        // UNMATCHED or EXACT_MATCH with no errors means valid record ready to create/update!
        status = 'valid';
      }

      rowStates.push({
        rowIndex: idx + 1,
        rawData,
        mappedData,
        status,
        matchStatus: matchStatus || 'UNMATCHED',
        matchedEntityId,
        matchedEntityName,
        candidateEntities,
        errors
      });
    });

    return rowStates;
  }

  /**
   * Executes chunked batch import (200 ops per chunk) via module processBatch adapter.
   */
  static async executeImport(
    rowStates: ImportRowState[],
    spec: ImportModuleSpec,
    conflictStrategy: ConflictStrategy,
    sessionMap: ImportSessionMap = {}
  ): Promise<ImportBatchReport> {
    const validRows = rowStates
      .filter((r) => r.status === 'valid' || r.status === 'unmatched')
      .map((r) => r.mappedData);

    const CHUNK_SIZE = 200;
    let totalSucceeded = 0;
    let totalFailed = 0;
    const errorsList: { row: number; data: Record<string, string>; errors: string[] }[] = [];

    // Process valid rows in safe 200-item chunks
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      try {
        const res = await spec.processBatch(chunk, sessionMap, conflictStrategy);
        totalSucceeded += res.succeeded;
        totalFailed += res.failed;

        if (res.createdMap) {
          Object.assign(sessionMap, res.createdMap);
        }

        if (res.errors && res.errors.length > 0) {
          res.errors.forEach((err) => {
            const originalRow = rowStates[i + err.row] || { rowIndex: i + err.row + 1, rawData: {} };
            errorsList.push({
              row: originalRow.rowIndex,
              data: originalRow.rawData,
              errors: [err.error]
            });
          });
        }
      } catch (err: any) {
        totalFailed += chunk.length;
        chunk.forEach((_, cIdx) => {
          const originalRow = rowStates[i + cIdx];
          errorsList.push({
            row: originalRow ? originalRow.rowIndex : i + cIdx + 1,
            data: originalRow ? originalRow.rawData : {},
            errors: [err.message || 'Errore durante la scrittura del batch']
          });
        });
      }
    }

    // Add invalid rows to report
    rowStates
      .filter((r) => r.status === 'invalid')
      .forEach((r) => {
        totalFailed++;
        errorsList.push({
          row: r.rowIndex,
          data: r.rawData,
          errors: r.errors
        });
      });

    const report: ImportBatchReport = {
      importId: `imp_${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: spec.entityType,
      totalRows: rowStates.length,
      succeeded: totalSucceeded,
      failed: totalFailed,
      reconciledCount: rowStates.filter((r) => r.matchedEntityId).length,
      errors: errorsList
    };

    // Log to system_import_logs collection asynchronously
    try {
      await addDoc(collection(db, 'system_import_logs'), {
        ...report,
        createdAt: serverTimestamp()
      });
    } catch (logErr) {
      console.warn('[ImportEngineService] Could not log import summary to Firestore:', logErr);
    }

    return report;
  }

  /**
   * Generates a downloadable CSV string for invalid/failed rows.
   */
  static generateErrorCsv(report: ImportBatchReport): string {
    if (!report.errors || report.errors.length === 0) return '';

    const firstRowData = report.errors[0].data || {};
    const dataHeaders = Object.keys(firstRowData);
    const headers = ['Row_Index', 'Error_Messages', ...dataHeaders];

    let csvContent = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

    report.errors.forEach((item) => {
      const rowValues = [
        String(item.row),
        item.errors.join('; '),
        ...dataHeaders.map((h) => item.data[h] || '')
      ];

      const escapedValues = rowValues.map((v) => `"${String(v).replace(/"/g, '""')}"`);
      csvContent += escapedValues.join(',') + '\n';
    });

    return csvContent;
  }
}
