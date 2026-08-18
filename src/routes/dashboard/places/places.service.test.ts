import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlacesService } from './places.service';
import { PlaceFirestoreRepository } from './infrastructure/firestore/PlaceFirestoreRepository';

describe('PlacesService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch places list correctly via repository delegation', async () => {
    const mockList = [
      {
        id: 'test-place-id',
        orgId: 'default',
        code: 'LUG-2026-001',
        clientId: 'test-client-123',
        name: 'Cantiere Via Roma 10',
        types: ['site'],
        status: 'active',
        parentId: null,
        ancestors: [],
        depth: 0,
        address: { street: 'Via Roma 10', city: 'Milano', country: 'IT', formattedAddress: 'Via Roma 10, Milano', normalizedKey: 'it||milano|via roma 10' },
        geocodingStatus: 'pending',
        summary: { label: 'Cantiere Via Roma 10', shortAddress: 'Milano' },
        contacts: [],
        tags: [],
        metadata: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
    ];

    vi.spyOn(PlaceFirestoreRepository.prototype, 'fetchPlaces').mockResolvedValue(mockList as any);

    const list = await PlacesService.getPlaces();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].code).toBe('LUG-2026-001');
    expect(list[0].name).toBe('Cantiere Via Roma 10');
  });

  it('should fetch single place by ID via repository delegation', async () => {
    const mockItem = {
      id: 'test-place-id',
      orgId: 'default',
      code: 'LUG-2026-001',
      clientId: 'test-client-123',
      name: 'Cantiere Via Roma 10',
      types: ['site'],
      status: 'active',
      parentId: null,
      ancestors: [],
      depth: 0,
      address: { street: 'Via Roma 10', city: 'Milano', country: 'IT', formattedAddress: 'Via Roma 10, Milano', normalizedKey: 'it||milano|via roma 10' },
      geocodingStatus: 'pending',
      summary: { label: 'Cantiere Via Roma 10', shortAddress: 'Milano' },
      contacts: [],
      tags: [],
      metadata: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    vi.spyOn(PlaceFirestoreRepository.prototype, 'fetchPlaceById').mockResolvedValue(mockItem as any);

    const item = await PlacesService.getPlaceById('test-place-id');
    expect(item).not.toBeNull();
    expect(item?.clientId).toBe('test-client-123');
    expect(item?.status).toBe('active');
  });

  it('delegates reparentPlace and deletePlace to repository', async () => {
    const reparentSpy = vi.spyOn(PlaceFirestoreRepository.prototype, 'updatePlaceParentWithCascade').mockResolvedValue(undefined);
    const deleteSpy = vi.spyOn(PlaceFirestoreRepository.prototype, 'deletePlaceWithLockRelease').mockResolvedValue(undefined);

    await PlacesService.reparentPlace('target-1', 'parent-2');
    expect(reparentSpy).toHaveBeenCalledWith('default', 'target-1', 'parent-2');

    await PlacesService.deletePlace('place-1', 'admin-uid');
    expect(deleteSpy).toHaveBeenCalledWith('default', 'place-1', true, 'admin-uid');
  });
});
