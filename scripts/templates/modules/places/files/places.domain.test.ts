import { describe, it, expect } from 'vitest';
import {
  buildNormalizedKey,
  calculateGeohash,
  get9CellGeohashNeighbors,
  haversineDistanceMeters,
  normalizeLegacyPlace,
  buildHierarchyTree
} from './domain/services/placeUtils';
import { validatePlaceForm } from './domain/validation/place.schema';
import type { PlaceDocument } from './domain/models/place';

describe('Places Domain Services & Utilities Unit Tests', () => {
  it('buildNormalizedKey formats lowercase trimmed country|cap|city|street', () => {
    const key = buildNormalizedKey({
      street: '  Via Roma 12 ',
      city: ' Milano ',
      postalCode: '20121',
      country: 'IT'
    });
    expect(key).toBe('it|20121|milano|via roma 12');
  });

  it('calculateGeohash produces expected 8-char base32 geohash for Milan coordinates', () => {
    const hash = calculateGeohash(45.4642, 9.1900, 8);
    expect(hash).toHaveLength(8);
    expect(hash.startsWith('u0nd')).toBe(true);
  });

  it('get9CellGeohashNeighbors returns 9 unique geohash cells including center', () => {
    const center = calculateGeohash(45.4642, 9.1900, 6);
    const neighbors = get9CellGeohashNeighbors(center);
    expect(neighbors).toHaveLength(9);
    expect(neighbors).toContain(center);
  });

  it('haversineDistanceMeters calculates accurate distance between two GPS coordinates', () => {
    // Duomo di Milano (45.4642, 9.1900) to Castello Sforzesco (45.4705, 9.1793) ~ 1000m
    const distance = haversineDistanceMeters(45.4642, 9.1900, 45.4705, 9.1793);
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1200);
  });

  it('normalizeLegacyPlace seamlessly converts old schema documents', () => {
    const legacy = {
      id: 'legacy-1',
      nome: 'Cantiere Le Palme',
      codice: 'CNT-01',
      status: 'attivo',
      indirizzo: 'Via Garibaldi 5',
      citta: 'Torino',
      cap: '10121',
      lat: 45.0703,
      lng: 7.6869,
      contactPerson: 'Mario Rossi',
      phone: '3331234567',
      clientId: 'client-abc'
    };

    const doc = normalizeLegacyPlace(legacy);
    expect(doc.id).toBe('legacy-1');
    expect(doc.name).toBe('Cantiere Le Palme');
    expect(doc.code).toBe('CNT-01');
    expect(doc.status).toBe('active'); // migrated from 'attivo'
    expect(doc.types).toEqual(['site']);
    expect(doc.address.city).toBe('Torino');
    expect(doc.address.street).toBe('Via Garibaldi 5');
    expect(doc.geo?.location).toBeDefined();
    expect(doc.contacts).toHaveLength(1);
    expect(doc.contacts[0].name).toBe('Mario Rossi');
    expect(doc.clientId).toBe('client-abc');
  });

  it('buildHierarchyTree builds recursive tree structure correctly', () => {
    const rootA: PlaceDocument = {
      id: 'root-a',
      orgId: 'default',
      name: 'Sede Principale',
      types: ['headquarters'],
      status: 'active',
      parentId: null,
      ancestors: [],
      depth: 0,
      address: { street: '', city: 'Milano', country: 'IT', formattedAddress: '', normalizedKey: '' },
      geocodingStatus: 'pending',
      summary: { label: 'Sede Principale', shortAddress: 'Milano' },
      contacts: [],
      tags: [],
      metadata: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    const child1: PlaceDocument = {
      ...rootA,
      id: 'child-1',
      name: 'Magazzino A',
      types: ['warehouse'],
      parentId: 'root-a',
      ancestors: ['root-a'],
      depth: 1
    };

    const subChild: PlaceDocument = {
      ...rootA,
      id: 'sub-1',
      name: 'Corsia 3',
      types: ['custom'],
      parentId: 'child-1',
      ancestors: ['root-a', 'child-1'],
      depth: 2
    };

    const tree = buildHierarchyTree([rootA, child1, subChild]);
    expect(tree).toHaveLength(1);
    expect(tree[0].place.id).toBe('root-a');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].place.id).toBe('child-1');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].place.id).toBe('sub-1');
  });

  it('validatePlaceForm validates minimum name length and valid types', () => {
    const invalidRes = validatePlaceForm({ name: 'A', types: [] });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.errors.some(e => e.field === 'name')).toBe(true);
    expect(invalidRes.errors.some(e => e.field === 'types')).toBe(true);

    const validRes = validatePlaceForm({
      name: 'Cantiere Centro',
      types: ['site', 'warehouse']
    });
    expect(validRes.valid).toBe(true);
  });
});
