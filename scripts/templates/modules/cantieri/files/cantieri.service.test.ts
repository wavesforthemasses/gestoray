import { describe, it, expect, vi } from 'vitest';
import { CantieriService } from './cantieri.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    id: 'test-cantiere-id',
    data: () => ({
      code: 'CANTIERE-2026-001',
      clientId: 'test-client-123',
      name: 'Milano Via Dante',
      status: 'aperto',
      progress: 50,
      estimatedAmount: 12400
    })
  }),
  getDocs: vi.fn().mockResolvedValue({
    forEach: (cb: any) => {
      cb({
        id: 'test-cantiere-id',
        data: () => ({
          code: 'CANTIERE-2026-001',
          clientId: 'test-client-123',
          name: 'Milano Via Dante',
          status: 'aperto',
          progress: 50,
          estimatedAmount: 12400
        })
      });
    }
  }),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-cantiere-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn()
}));

describe('CantieriService Unit Tests', () => {
  it('should fetch cantiere list correctly', async () => {
    const list = await CantieriService.getCantieri();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].code).toBe('CANTIERE-2026-001');
    expect(list[0].name).toBe('Milano Via Dante');
  });

  it('should fetch single cantiere by ID', async () => {
    const item = await CantieriService.getCantiereById('test-cantiere-id');
    expect(item).not.toBeNull();
    expect(item?.clientId).toBe('test-client-123');
    expect(item?.progress).toBe(50);
  });
});
