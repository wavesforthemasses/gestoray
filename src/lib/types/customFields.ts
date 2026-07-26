export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  key: string;            // Property name in Firestore document under customFields.<key>
  label: string;          // Human-readable label
  type: CustomFieldType;
  required?: boolean;
  defaultValue?: any;
  options?: CustomFieldOption[]; // For select type
  placeholder?: string;
  module: string;
  active: boolean;
  order?: number;
}

export type CustomFieldValues = Record<string, any>;
