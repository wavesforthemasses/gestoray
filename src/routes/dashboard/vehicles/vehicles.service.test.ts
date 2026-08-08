import { describe, it, expect, vi } from 'vitest';
import { VehiclesService } from './vehicles.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-vehicle-id' }),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn()
}));

describe('VehiclesService', () => {
  it('dovrebbe recuperare la lista dei mezzi', async () => {
    const list = await VehiclesService.getVehicles();
    expect(Array.isArray(list)).toBe(true);
  });
});
