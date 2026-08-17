import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VersioningService,
  computeDiff,
  deepEqual,
  OptimisticConcurrencyError,
  ReversalConflictError,
  AlreadyReversedError
} from './versioningService';

const { mockDocStore } = vi.hoisted(() => {
  return {
    mockDocStore: new Map<string, any>()
  };
});

vi.mock('$lib/firebase', () => ({
  db: {},
  doc: (_db: any, col: string, id: string) => ({ id, path: `${col}/${id}` }),
  collection: (_db: any, col: string) => ({ id: col }),
  runTransaction: async (_db: any, updateFunction: any) => {
    // Simula transazione con lettura e scrittura atomica
    const tx = {
      get: async (ref: any) => {
        const data = mockDocStore.get(ref.path);
        return {
          exists: () => !!data,
          data: () => data ? JSON.parse(JSON.stringify(data)) : undefined
        };
      },
      set: (ref: any, data: any, opts?: any) => {
        if (opts?.merge) {
          const prev = mockDocStore.get(ref.path) || {};
          mockDocStore.set(ref.path, { ...prev, ...data });
        } else {
          mockDocStore.set(ref.path, data);
        }
      }
    };
    return await updateFunction(tx);
  },
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  deleteField: () => '__DELETE_FIELD__'
}));

describe('VersioningService - Chaos & Concurrency Validation', () => {

  beforeEach(() => {
    mockDocStore.clear();
  });

  it('handles concurrent writers: first succeeds, concurrent stale writers get OCC error', async () => {
    const entityRef = { id: 'client-concurrency-1', path: 'clients/client-concurrency-1' } as any;

    // Inizializza entità a versione 1
    mockDocStore.set(entityRef.path, {
      name: 'Initial Name',
      edits: { aggregateVersion: 1 }
    });

    // Simula 3 worker che hanno letto contemporaneamente baseVersion = 1
    const worker1 = () => VersioningService.executeDualWriteTransaction(
      {} as any,
      entityRef,
      { name: 'Worker 1 Name' },
      {
        tenantId: 'tenant-1',
        module: 'clients',
        entityType: 'client',
        entityId: 'client-concurrency-1',
        entityLabel: 'Client Concurrency',
        eventType: 'FIELD_MUTATION',
        keysChanged: ['name'],
        mutations: { name: { old: 'Initial Name', new: 'Worker 1 Name', semantics: 'DESCRIPTIVE' } },
        performedBy: 'user-w1'
      },
      1 // baseVersion attesa = 1
    );

    const worker2 = () => VersioningService.executeDualWriteTransaction(
      {} as any,
      entityRef,
      { name: 'Worker 2 Name' },
      {
        tenantId: 'tenant-1',
        module: 'clients',
        entityType: 'client',
        entityId: 'client-concurrency-1',
        entityLabel: 'Client Concurrency',
        eventType: 'FIELD_MUTATION',
        keysChanged: ['name'],
        mutations: { name: { old: 'Initial Name', new: 'Worker 2 Name', semantics: 'DESCRIPTIVE' } },
        performedBy: 'user-w2'
      },
      1 // baseVersion attesa = 1 (stale se worker 1 ha già scritto)
    );

    // Esegui Worker 1
    const res1 = await worker1();
    expect(res1.aggregateVersion).toBe(2);
    expect(mockDocStore.get(entityRef.path).name).toBe('Worker 1 Name');
    expect(mockDocStore.get(entityRef.path).edits.aggregateVersion).toBe(2);

    // Worker 2 tenta con la baseVersion 1 non più valida -> Deve fallire con OCC Error
    await expect(worker2()).rejects.toThrow(OptimisticConcurrencyError);

    // Worker 2 fa retry leggendo la nuova versione 2 -> Ha successo e porta a versione 3
    const res2Retry = await VersioningService.executeDualWriteTransaction(
      {} as any,
      entityRef,
      { name: 'Worker 2 Retried Name' },
      {
        tenantId: 'tenant-1',
        module: 'clients',
        entityType: 'client',
        entityId: 'client-concurrency-1',
        entityLabel: 'Client Concurrency',
        eventType: 'FIELD_MUTATION',
        keysChanged: ['name'],
        mutations: { name: { old: 'Worker 1 Name', new: 'Worker 2 Retried Name', semantics: 'DESCRIPTIVE' } },
        performedBy: 'user-w2'
      },
      2 // retry con baseVersion aggiornata
    );

    expect(res2Retry.aggregateVersion).toBe(3);
    expect(mockDocStore.get(entityRef.path).name).toBe('Worker 2 Retried Name');
    expect(mockDocStore.get(entityRef.path).edits.aggregateVersion).toBe(3);
  });

  it('guarantees sequential strict monotonicity across 50 simulated operations', async () => {
    const entityRef = { id: 'product-sequence', path: 'products/product-sequence' } as any;

    mockDocStore.set(entityRef.path, {
      stock: 0,
      edits: { aggregateVersion: 0 }
    });

    let currentVer = 0;

    for (let i = 1; i <= 50; i++) {
      const res = await VersioningService.executeDualWriteTransaction(
        {} as any,
        entityRef,
        { stock: i * 10 },
        {
          tenantId: 'tenant-1',
          module: 'products',
          entityType: 'product',
          entityId: 'product-sequence',
          entityLabel: 'Product Sequence',
          eventType: 'NUMERICAL_DELTA',
          keysChanged: ['stock'],
          mutations: {
            stock: { old: (i - 1) * 10, new: i * 10, semantics: 'ADDITIVE', delta: 10 }
          },
          performedBy: `user-${i}`
        },
        currentVer
      );

      expect(res.aggregateVersion).toBe(i);
      currentVer = res.aggregateVersion;
    }

    const finalEntity = mockDocStore.get(entityRef.path);
    expect(finalEntity.stock).toBe(500);
    expect(finalEntity.edits.aggregateVersion).toBe(50);
  });
});
