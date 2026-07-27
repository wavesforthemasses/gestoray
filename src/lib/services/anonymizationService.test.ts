import { describe, it, expect } from 'vitest';
import { AnonymizationService, type FieldAnonymizationSpec } from './anonymizationService';

describe('AnonymizationService', () => {

  describe('anonymizeValue', () => {
    it('REDACT should return fixed string', () => {
      expect(AnonymizationService.anonymizeValue('Mario', 'REDACT')).toBe('ANONIMIZZATO');
      expect(AnonymizationService.anonymizeValue('Mario', 'REDACT', 'N/A')).toBe('N/A');
    });

    it('INITIALS should return initials of string', () => {
      expect(AnonymizationService.anonymizeValue('Mario Rossi', 'INITIALS')).toBe('M. R.');
      expect(AnonymizationService.anonymizeValue('mario', 'INITIALS')).toBe('M.');
      expect(AnonymizationService.anonymizeValue('   Giovanni   Paolo  ', 'INITIALS')).toBe('G. P.');
      expect(AnonymizationService.anonymizeValue(123, 'INITIALS')).toBe(123); // Non-strings shouldn't crash
    });

    it('HASH_EMAIL should generate an anon email', () => {
      const email = AnonymizationService.anonymizeValue('test@test.com', 'HASH_EMAIL', undefined, 'uid123');
      expect(email).toBe('anon_uid123@anonymized.local');
    });

    it('MASK_PHONE should mask phone string', () => {
      expect(AnonymizationService.anonymizeValue('+39 347 1234567', 'MASK_PHONE')).toBe('+39 *** 67');
      expect(AnonymizationService.anonymizeValue('123', 'MASK_PHONE')).toBe('***');
    });

    it('CLEAR should return empty equivalents', () => {
      expect(AnonymizationService.anonymizeValue('some text', 'CLEAR')).toBe('');
      expect(AnonymizationService.anonymizeValue(null, 'CLEAR')).toBe('');
      expect(AnonymizationService.anonymizeValue([1,2,3], 'CLEAR')).toEqual([]);
      expect(AnonymizationService.anonymizeValue(true, 'CLEAR')).toBe(false);
      expect(AnonymizationService.anonymizeValue(123, 'CLEAR')).toBe(0);
    });

    it('PRESERVE should return original value', () => {
      expect(AnonymizationService.anonymizeValue('keep me', 'PRESERVE')).toBe('keep me');
      expect(AnonymizationService.anonymizeValue(true, 'PRESERVE')).toBe(true);
    });
  });

  describe('applyAnonymization', () => {
    it('should correctly transform nested fields in a document', () => {
      const original = {
        id: 'doc1',
        original: {
          firstName: 'Luigi',
          lastName: 'Verdi',
          email: 'luigi@verdi.com',
          phone: '333 1234567',
          role: 'user',
          notes: 'He likes pizza',
          doNotContact: true
        }
      };

      const specs: FieldAnonymizationSpec[] = [
        { fieldPath: 'original.firstName', strategy: 'INITIALS' },
        { fieldPath: 'original.lastName', strategy: 'INITIALS' },
        { fieldPath: 'original.email', strategy: 'HASH_EMAIL' },
        { fieldPath: 'original.phone', strategy: 'MASK_PHONE' },
        { fieldPath: 'original.notes', strategy: 'CLEAR' },
        { fieldPath: 'original.doNotContact', strategy: 'PRESERVE' },
      ];

      const result = AnonymizationService.applyAnonymization(original, specs, 'doc1');

      expect(result.id).toBe('doc1'); // untouched
      expect(result.original.firstName).toBe('L.');
      expect(result.original.lastName).toBe('V.');
      expect(result.original.email).toBe('anon_doc1@anonymized.local');
      expect(result.original.phone).toBe('333 *** 67');
      expect(result.original.notes).toBe('');
      expect(result.original.role).toBe('user'); // untouched
      expect(result.original.doNotContact).toBe(true); // preserved
    });
  });

});
