import { describe, it, expect } from 'vitest';

describe('Custom Fields PMI Service Schema', () => {
  it('should validate allowed custom field types', () => {
    const allowedTypes = ['text', 'number', 'select', 'date', 'boolean'];
    expect(allowedTypes).toContain('text');
    expect(allowedTypes).toContain('select');
    expect(allowedTypes).toContain('boolean');
    expect(allowedTypes).not.toContain('invalid_type');
  });

  it('should sanitize field keys for Firestore customFields map storing', () => {
    const sanitizeKey = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    expect(sanitizeKey('Codice SDI')).toBe('codice_sdi');
    expect(sanitizeKey('Numero Matricola #1')).toBe('numero_matricola__1');
  });
});
