import { describe, it, expect, vi } from 'vitest';
import { ProjectsService } from './projects.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    id: 'test-project-id',
    data: () => ({
      code: 'PROG-2026-001',
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
        id: 'test-project-id',
        data: () => ({
          code: 'PROG-2026-001',
          clientId: 'test-client-123',
          name: 'Milano Via Dante',
          status: 'aperto',
          progress: 50,
          estimatedAmount: 12400
        })
      });
    }
  }),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-project-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn()
}));

describe('ProjectsService Unit Tests', () => {
  it('should fetch project list correctly', async () => {
    const list = await ProjectsService.getProjects();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].code).toBe('PROG-2026-001');
    expect(list[0].name).toBe('Milano Via Dante');
  });

  it('should fetch single project by ID', async () => {
    const item = await ProjectsService.getProjectById('test-project-id');
    expect(item).not.toBeNull();
    expect(item?.clientId).toBe('test-client-123');
    expect(item?.progress).toBe(50);
  });
});
