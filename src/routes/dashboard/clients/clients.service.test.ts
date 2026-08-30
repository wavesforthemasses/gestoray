import { describe, it, expect } from 'vitest';
import { generateSearchTerms } from '$lib/search-utils';
import { ClientsVersioningBridge, CLIENT_FIELD_LABELS } from './clients.versioning.bridge';
import { CLIENTS_ANONYMIZATION_SPEC, AnonymizationService } from '$lib/services/anonymizationService';
import { computeDiff } from '$lib/services/versioningService';
import type { ClientItem } from './schema';

describe('Clients Service & Anagrafica Logic', () => {
  describe('Search Index Generation', () => {
    it('should generate multi-word search index terms for client full names (nome + cognome)', () => {
      const fullClientName = 'Mario Rossi2';
      const terms = generateSearchTerms(fullClientName);

      // Word 0 ("mario rossi2")
      expect(terms).toContain('ma');
      expect(terms).toContain('mario');
      expect(terms).toContain('mario r');
      expect(terms).toContain('mario rossi2');

      // Word 1 ("rossi2")
      expect(terms).toContain('ro');
      expect(terms).toContain('rossi2');
    });

    it('should generate multi-word search index terms for ragione sociale and fiscal id', () => {
      const terms = generateSearchTerms('Azienda Rossi Srl', 'IT12345678901');

      expect(terms).toContain('azienda');
      expect(terms).toContain('azienda r');
      expect(terms).toContain('azienda rossi');
      expect(terms).toContain('azienda rossi srl');

      expect(terms).toContain('rossi');
      expect(terms).toContain('rossi srl');

      expect(terms).toContain('it12345678901');
    });
  });

  describe('Versioning Bridge & Semantics', () => {
    it('should return human readable labels for client fields', () => {
      expect(ClientsVersioningBridge.getFieldLabel('original.nome')).toBe('Nome / Ragione Sociale');
      expect(ClientsVersioningBridge.getFieldLabel('original.partitaIva')).toBe('Partita IVA');
      expect(ClientsVersioningBridge.getFieldLabel('original.maxCredit')).toBe('Fido Massimo Accordato');
      expect(ClientsVersioningBridge.getFieldLabel('original.residualCredit')).toBe('Fido Residuo Disponibile');
    });

    it('should compute diff correctly with client semantics map', () => {
      const before = {
        original: {
          nome: 'Acme Corp',
          maxCredit: 10000,
          residualCredit: 10000,
          status: 'prospect'
        }
      };

      const after = {
        original: {
          nome: 'Acme Corporation S.r.l.',
          maxCredit: 25000,
          residualCredit: 25000,
          status: 'customer'
        }
      };

      const diff = computeDiff(before, after, {
        semanticsMap: ClientsVersioningBridge.getSemanticsMap()
      });

      expect(diff.keysChanged).toContain('original.nome');
      expect(diff.keysChanged).toContain('original.maxCredit');
      expect(diff.keysChanged).toContain('original.residualCredit');
      expect(diff.keysChanged).toContain('original.status');

      expect(diff.mutations['original.maxCredit'].semantics).toBe('ABSOLUTE');
      expect(diff.mutations['original.residualCredit'].semantics).toBe('ADDITIVE');
      expect(diff.mutations['original.status'].semantics).toBe('DESCRIPTIVE');
    });

    it('should produce descriptive entity label from client data', () => {
      const clientData: Partial<ClientItem> = {
        id: 'client-123',
        original: {
          nome: 'TechNova',
          cognome: 'Solutions'
        }
      };

      expect(ClientsVersioningBridge.getEntityLabel(clientData)).toBe('TechNova');
    });

    it('should fallback gracefully when client data has only undefined or partial fields', () => {
      const clientData: Partial<ClientItem> = {
        id: 'client-999',
        original: {
          nome: undefined as any,
          cognome: undefined as any
        }
      };

      expect(ClientsVersioningBridge.getEntityLabel(clientData)).toBe('client-999');
    });
  });

  describe('GDPR Anonymization Specs', () => {
    it('should properly redact and clear all sensitive personal and fiscal client data', () => {
      const rawClient = {
        original: {
          nome: 'Acme S.r.l.',
          cognome: 'Rossi',
          email: 'info@acme.it',
          emailContatto: 'contatto@acme.it',
          phone: '+39 02 1234567',
          mainPhone: '+39 02 7654321',
          telReferente: '+39 333 1122334',
          referenteTecnico: 'Mario Bianchi',
          partitaIva: 'IT12345678901',
          codiceFiscale: 'RSSMRA80A01H501Z',
          fiscalId: 'IT12345678901',
          pec: 'acme@pec.it',
          iban: 'IT60X0542811101000000123456',
          address: 'Via Roma 10',
          city: 'Milano',
          province: 'MI',
          postalCode: '20100',
          billingAddress: 'Via Roma 10',
          shippingAddress: 'Via Milano 20',
          internalAdminNotes: 'Cliente con sconto 10%',
          quoteAutoNotes: 'Note automatiche preventivo',
          notes: ['Nota 1', 'Nota 2']
        }
      };

      const anonymized: Record<string, any> = { original: { ...rawClient.original } };

      for (const spec of CLIENTS_ANONYMIZATION_SPEC) {
        const fieldKey = spec.fieldPath.replace('original.', '') as keyof typeof rawClient.original;
        const origVal = rawClient.original[fieldKey];
        anonymized.original[fieldKey] = AnonymizationService.anonymizeValue(
          origVal,
          spec.strategy,
          spec.customReplacement,
          'client-123'
        );
      }

      // Ragione Sociale / Nome redacted
      expect(anonymized.original.nome).toBe('Cliente Anonimizzato');

      // Cognome & Fiscal identifiers cleared
      expect(anonymized.original.cognome).toBe('');
      expect(anonymized.original.partitaIva).toBe('');
      expect(anonymized.original.codiceFiscale).toBe('');
      expect(anonymized.original.fiscalId).toBe('');
      expect(anonymized.original.pec).toBe('');
      expect(anonymized.original.iban).toBe('');

      // Emails hashed
      expect(anonymized.original.email).toMatch(/^anon_/);
      expect(anonymized.original.emailContatto).toMatch(/^anon_/);

      // Phones cleared
      expect(anonymized.original.phone).toBe('');
      expect(anonymized.original.mainPhone).toBe('');
      expect(anonymized.original.telReferente).toBe('');
      expect(anonymized.original.referenteTecnico).toBe('');

      // Addresses and notes cleared
      expect(anonymized.original.address).toBe('');
      expect(anonymized.original.city).toBe('');
      expect(anonymized.original.billingAddress).toBe('');
      expect(anonymized.original.shippingAddress).toBe('');
      expect(anonymized.original.internalAdminNotes).toBe('');
      expect(anonymized.original.quoteAutoNotes).toBe('');
      expect(anonymized.original.notes).toEqual([]);
    });
  });
});
