/**
 * Import System Core Data Contracts & Interfaces
 */

export type ImportFieldType = 'string' | 'number' | 'date' | 'boolean' | 'currency';

export type ConflictStrategy = 'upsert' | 'skip' | 'create_new';

export type MatchStatus = 'EXACT_MATCH' | 'UNMATCHED' | 'AMBIGUOUS_MATCH';

export interface ImportFieldDef {
  key: string;
  label: string;
  type: ImportFieldType;
  required?: boolean;
  defaultValue?: any;
  validationRegex?: RegExp;
  description?: string;
}

export interface ImportModuleSpec {
  entityType: string;
  label: string;
  collectionName: string;
  prerequisites?: string[]; // E.g., ['clients']
  fields: ImportFieldDef[];
  lookupKeys?: string[]; // E.g., ['identificativo_fiscale', 'piva', 'codice_fiscale', 'email']
  processBatch: (
    rows: Record<string, any>[],
    sessionMap: Record<string, string>,
    conflictStrategy: ConflictStrategy
  ) => Promise<{ succeeded: number; failed: number; errors: { row: number; error: string }[]; createdMap?: Record<string, string> }>;
}

export interface ImportRowState {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: Record<string, any>;
  status: 'valid' | 'invalid' | 'unmatched' | 'ambiguous';
  matchStatus?: MatchStatus;
  matchedEntityId?: string;
  matchedEntityName?: string;
  candidateEntities?: { id: string; name: string }[];
  errors: string[];
}

export interface ImportBatchReport {
  importId: string;
  timestamp: string;
  entityType: string;
  totalRows: number;
  succeeded: number;
  failed: number;
  reconciledCount: number;
  errors: { row: number; data: Record<string, string>; errors: string[] }[];
}

export type ImportSessionMap = Record<string, string>;
