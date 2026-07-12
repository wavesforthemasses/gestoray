import { uuidv7 } from "uuidv7";

/**
 * Generate a UUIDv7, optionally with a prefix.
 * Example: generateId('client') => 'client_01H...'
 */
export function generateId(prefix?: string): string {
  const id = uuidv7();
  return prefix ? `${prefix}_${id}` : id;
}
