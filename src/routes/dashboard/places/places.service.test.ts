import { describe, it, expect, vi } from 'vitest';
import { PlacesService } from './places.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    id: 'test-place-id',
    data: () => ({
      code: 'LUG-2026-001',
      clientId: 'test-client-123',
      name: 'Cantiere Via Roma 10',
      status: 'attivo'
    })
  }),
  getDocs: vi.fn().mockResolvedValue({
    forEach: (cb: any) => {
      cb({
        id: 'test-place-id',
        data: () => ({
          code: 'LUG-2026-001',
          clientId: 'test-client-123',
          name: 'Cantiere Via Roma 10',
          status: 'attivo'
        })
      });
    }
  }),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-place-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn()
}));

describe('PlacesService Unit Tests', () => {
  it('should fetch places list correctly', async () => {
    const list = await PlacesService.getPlaces();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].code).toBe('LUG-2026-001');
    expect(list[0].name).toBe('Cantiere Via Roma 10');
  });

  it('should fetch single place by ID', async () => {
    const item = await PlacesService.getPlaceById('test-place-id');
    expect(item).not.toBeNull();
    expect(item?.clientId).toBe('test-client-123');
    expect(item?.status).toBe('attivo');
  });
});
