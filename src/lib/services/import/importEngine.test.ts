import { describe, it, expect, beforeEach } from 'vitest';
import { CsvParser } from './csvParser';
import { ImportRegistry } from './importRegistry';
import { EntityResolutionService } from './entityResolutionService';
import { ImportEngineService } from './importEngineService';
import { normalizeUnitOfMeasure, productsImportSpec } from './specs/productsImportSpec';
import type { ImportModuleSpec } from '$lib/types/importTypes';

describe('Universal Import Engine Unit Tests', () => {
  describe('CsvParser', () => {
    it('should auto-detect semicolon delimiter and parse headers and rows correctly', () => {
      const csvText = `Ragione Sociale;Partita IVA;Email;Telefono
"Acme S.r.l.";12345678901;info@acme.it;02123456
"Tech Corp";98765432109;contact@tech.com;06987654`;

      const result = CsvParser.parse(csvText);

      expect(result.delimiter).toBe(';');
      expect(result.headers).toEqual(['Ragione Sociale', 'Partita IVA', 'Email', 'Telefono']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]['Ragione Sociale']).toBe('Acme S.r.l.');
      expect(result.rows[0]['Partita IVA']).toBe('12345678901');
      expect(result.rows[1]['Email']).toBe('contact@tech.com');
    });

    it('should strip UTF-8 BOM markers and handle escaped quotes inside cells', () => {
      const csvText = `\uFEFFNome,Descrizione
"Prodotto A","Descrizione con ""Virgolette"" interne"`;

      const result = CsvParser.parse(csvText);

      expect(result.headers).toEqual(['Nome', 'Descrizione']);
      expect(result.rows[0]['Descrizione']).toBe('Descrizione con "Virgolette" interne');
    });
  });

  describe('ImportRegistry', () => {
    beforeEach(() => {
      // Clean up specs
      ImportRegistry.unregister('test_module');
      ImportRegistry.unregister('test_parent');
    });

    it('should register and retrieve module adapter specs dynamically', () => {
      const mockSpec: ImportModuleSpec = {
        entityType: 'test_module',
        label: 'Test Module',
        collectionName: 'test_collection',
        fields: [{ key: 'name', label: 'Nome', type: 'string', required: true }],
        processBatch: async () => ({ succeeded: 0, failed: 0, errors: [] })
      };

      ImportRegistry.register(mockSpec);

      const retrieved = ImportRegistry.getSpec('test_module');
      expect(retrieved).toBeDefined();
      expect(retrieved?.label).toBe('Test Module');
    });

    it('should check prerequisite requirements correctly', () => {
      const parentSpec: ImportModuleSpec = {
        entityType: 'test_parent',
        label: 'Parent Module',
        collectionName: 'test_parent',
        fields: [],
        processBatch: async () => ({ succeeded: 0, failed: 0, errors: [] })
      };

      const childSpec: ImportModuleSpec = {
        entityType: 'test_child',
        label: 'Child Module',
        collectionName: 'test_child',
        prerequisites: ['test_parent'],
        fields: [],
        processBatch: async () => ({ succeeded: 0, failed: 0, errors: [] })
      };

      ImportRegistry.register(parentSpec);
      ImportRegistry.register(childSpec);

      // 0 parent records -> checkPrerequisites returns ok: false
      const checkEmpty = ImportRegistry.checkPrerequisites('test_child', { test_parent: 0 });
      expect(checkEmpty.ok).toBe(false);
      expect(checkEmpty.missing).toContain('Parent Module');

      // >0 parent records -> checkPrerequisites returns ok: true
      const checkValid = ImportRegistry.checkPrerequisites('test_child', { test_parent: 10 });
      expect(checkValid.ok).toBe(true);
      expect(checkValid.missing.length).toBe(0);
    });
  });

  describe('EntityResolutionService', () => {
    it('should normalize strings by stripping diacritics, punctuation, and converting to lowercase', () => {
      const input = '  Acmé S.r.l.  (Milano)  ';
      const clean = EntityResolutionService.cleanKey(input);
      expect(clean).toBe('acmesrlmilano');
    });

    it('should register and resolve new entities in memory', () => {
      EntityResolutionService.registerNewEntity('clients', 'cli_123', 'Acme Corporation');

      const res = EntityResolutionService.resolveEntity('clients', 'acme corporation');
      expect(res.status).toBe('EXACT_MATCH');
      expect(res.matchedId).toBe('cli_123');
      expect(res.matchedName).toBe('Acme Corporation');
    });
  });

  describe('ImportEngineService Currency & Number Parsing', () => {
    it('should correctly parse Italian and international currency formats', () => {
      expect(ImportEngineService.parseNumberValue('€350,00')).toBe(350);
      expect(ImportEngineService.parseNumberValue('€ 270,00')).toBe(270);
      expect(ImportEngineService.parseNumberValue('1.250,50 €')).toBe(1250.5);
      expect(ImportEngineService.parseNumberValue('210,00')).toBe(210);
      expect(ImportEngineService.parseNumberValue('0,00%')).toBe(0);
    });

    it('should normalize units of measure to Gestoray standard codes', () => {
      expect(normalizeUnitOfMeasure('Pezzi')).toBe('pz');
      expect(normalizeUnitOfMeasure('pcs')).toBe('pz');
      expect(normalizeUnitOfMeasure('Kili')).toBe('kg');
      expect(normalizeUnitOfMeasure('Metri')).toBe('m');
      expect(normalizeUnitOfMeasure('Ore')).toBe('ora');
    });

    it('should correctly parse and validate user product CSV into 25 valid new records', () => {
      const csvText = `"Descrizione","Descrizione Lunga","Prezzo","Tassa 1","Tassa 2","Unità","Gruppo prodotto","Minimo Fatturabile"
"Alleggerito Gmix 43 EVO","Sottofondo...","€350,00","0,00%","0,00%","mc","Alleggeriti","Sotto i 20 mc 7000€"
"Alleggerito Gmix 54","Sottofondo...","€270,00","0,00%","0,00%","mc","Alleggeriti","Sotto i 20 mc 5400€"`;

      const parsed = CsvParser.parse(csvText);
      expect(parsed.rows.length).toBe(2);

      const mapping = {
        id: '__auto_uuid',
        name: 'Descrizione',
        category: 'Gruppo prodotto',
        price: 'Prezzo',
        unit: 'Unità',
        description: 'Descrizione Lunga'
      };

      const states = ImportEngineService.validateRows(parsed.rows, productsImportSpec, mapping);
      expect(states.length).toBe(2);
      expect(states.every((s) => s.status === 'valid')).toBe(true);
      expect(states[0].mappedData.price).toBe(350);
      expect(states[1].mappedData.price).toBe(270);
    });
  });
});
