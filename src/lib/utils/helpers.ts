import { uuidv7 } from "uuidv7";

/**
 * Generate a UUIDv7, optionally with a prefix.
 * Example: generateId('client') => 'client_01H...'
 */
export function generateId(prefix?: string): string {
  const id = uuidv7();
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Recursively removes all keys with undefined values from an object or array.
 * Preserves null, Timestamp, FieldValue, Dates, and primitives.
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as unknown as T;
  }
  // Preserve Firestore Timestamp, FieldValue or other special non-plain objects
  if ('toMillis' in (obj as any) || (obj as any)._methodName || (obj as any).constructor?.name === 'FieldValue') {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = cleanUndefined(value);
    }
  }
  return result as T;
}
