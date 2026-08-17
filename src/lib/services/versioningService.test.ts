import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deepEqual,
  computeDiff,
  getNestedValue,
  setNestedValue,
  getDateInt,
  LEDGER_MISSING,
  isLedgerMissing,
  LedgerValidationError,
  OptimisticConcurrencyError,
  ReversalConflictError,
  AlreadyReversedError,
  VersioningService
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
    const tx = {
      get: async (ref: any) => {
        const data = mockDocStore.get(ref.path);
        return {
          exists: () => !!data,
          data: () => data
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

describe('VersioningService - Core Math & Diff Engine Tests', () => {

  describe('deepEqual', () => {
    it('compares scalar primitives accurately', () => {
      expect(deepEqual('hello', 'hello')).toBe(true);
      expect(deepEqual('hello', 'world')).toBe(false);
      expect(deepEqual(42, 42)).toBe(true);
      expect(deepEqual(42, 43)).toBe(false);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('compares LEDGER_MISSING sentinel correctly', () => {
      expect(deepEqual(LEDGER_MISSING, LEDGER_MISSING)).toBe(true);
      expect(deepEqual(LEDGER_MISSING, null)).toBe(false);
      expect(deepEqual(LEDGER_MISSING, undefined)).toBe(false);
      expect(deepEqual(LEDGER_MISSING, '')).toBe(false);
      expect(isLedgerMissing(LEDGER_MISSING)).toBe(true);
      expect(isLedgerMissing(null)).toBe(false);
    });

    it('compares nested objects and arrays recursively', () => {
      const a = { name: 'Acme', address: { street: 'Via Roma', city: 'Milano' }, tags: ['vip', 'tech'] };
      const b = { name: 'Acme', address: { street: 'Via Roma', city: 'Milano' }, tags: ['vip', 'tech'] };
      const c = { name: 'Acme', address: { street: 'Via Dante', city: 'Milano' }, tags: ['vip', 'tech'] };
      const d = { name: 'Acme', address: { street: 'Via Roma', city: 'Milano' }, tags: ['vip'] };

      expect(deepEqual(a, b)).toBe(true);
      expect(deepEqual(a, c)).toBe(false);
      expect(deepEqual(a, d)).toBe(false);
    });

    it('compares Firestore Timestamp objects by milliseconds', () => {
      const ts1 = { toMillis: () => 1700000000000 };
      const ts2 = { toMillis: () => 1700000000000 };
      const ts3 = { toMillis: () => 1700000000999 };

      expect(deepEqual(ts1, ts2)).toBe(true);
      expect(deepEqual(ts1, ts3)).toBe(false);
    });
  });

  describe('getNestedValue & setNestedValue', () => {
    it('gets and sets nested dot-notation properties', () => {
      const data: any = { customer: { contact: { email: 'test@example.com' } } };
      expect(getNestedValue(data, 'customer.contact.email')).toBe('test@example.com');
      expect(getNestedValue(data, 'customer.contact.phone')).toBeUndefined();

      setNestedValue(data, 'customer.contact.phone', '+390123456');
      expect(data.customer.contact.phone).toBe('+390123456');

      setNestedValue(data, 'customer.contact.email', LEDGER_MISSING);
      expect(data.customer.contact.email).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(data.customer.contact, 'email')).toBe(false);
    });
  });

  describe('computeDiff', () => {
    it('computes changes on flat and nested fields excluding technical keys', () => {
      const before = {
        name: 'Acme Srl',
        vat: '12345678901',
        contact: { email: 'old@acme.com', city: 'Milano' },
        updatedAt: '2026-01-01',
        edits: { aggregateVersion: 2 }
      };

      const after = {
        name: 'Acme Corp Spa',
        vat: '12345678901',
        contact: { email: 'new@acme.com', city: 'Milano' },
        notes: 'Cliente premium',
        updatedAt: '2026-02-01',
        edits: { aggregateVersion: 3 }
      };

      const diff = computeDiff(before, after);

      expect(diff.keysChanged).toContain('name');
      expect(diff.keysChanged).toContain('contact.email');
      expect(diff.keysChanged).toContain('notes');
      expect(diff.keysChanged).not.toContain('vat');
      expect(diff.keysChanged).not.toContain('updatedAt');
      expect(diff.keysChanged).not.toContain('edits');

      expect(diff.mutations['name']).toEqual({
        old: 'Acme Srl',
        new: 'Acme Corp Spa',
        semantics: 'DESCRIPTIVE'
      });

      expect(diff.mutations['contact.email']).toEqual({
        old: 'old@acme.com',
        new: 'new@acme.com',
        semantics: 'DESCRIPTIVE'
      });

      expect(diff.mutations['notes']).toEqual({
        old: LEDGER_MISSING,
        new: 'Cliente premium',
        semantics: 'DESCRIPTIVE'
      });
    });

    it('handles ADDITIVE fields calculating exact numeric delta and enforcing validation', () => {
      const before = { stock: 100, price: 50 };
      const after = { stock: 135, price: 55 };

      const diff = computeDiff(before, after, {
        semanticsMap: { stock: 'ADDITIVE', price: 'ABSOLUTE' }
      });

      expect(diff.mutations['stock']).toEqual({
        old: 100,
        new: 135,
        semantics: 'ADDITIVE',
        delta: 35
      });

      expect(diff.mutations['price']).toEqual({
        old: 50,
        new: 55,
        semantics: 'ABSOLUTE'
      });
    });

    it('throws LedgerValidationError if ADDITIVE semantics is declared for non-number fields', () => {
      const before = { stock: 'one-hundred' };
      const after = { stock: 150 };

      expect(() => {
        computeDiff(before, after, {
          semanticsMap: { stock: 'ADDITIVE' }
        });
      }).toThrow(LedgerValidationError);
    });
  });

  describe('getDateInt', () => {
    it('formats dates to integer YYYYMMDD', () => {
      const d = new Date(2026, 7, 17); // Aug 17, 2026
      const dateInt = getDateInt(d);
      expect(dateInt).toBe(20260817);
    });
  });
});

describe('VersioningService - Dual-Write & Reversal Transaction Flow', () => {
  beforeEach(() => {
    mockDocStore.clear();
  });

  it('enforces OCC gate throwing OptimisticConcurrencyError on baseVersion mismatch', async () => {
    const entityRef = { id: 'client-1', path: 'clients/client-1' } as any;
    
    mockDocStore.set(entityRef.path, {
      name: 'Client 1',
      edits: { aggregateVersion: 4 }
    });

    await expect(
      VersioningService.executeDualWriteTransaction(
        {} as any,
        entityRef,
        { name: 'Updated Name' },
        {
          tenantId: 'tenant-default',
          module: 'clients',
          entityType: 'client',
          entityId: 'client-1',
          entityLabel: 'Client 1',
          eventType: 'FIELD_MUTATION',
          keysChanged: ['name'],
          mutations: { name: { old: 'Client 1', new: 'Updated Name', semantics: 'DESCRIPTIVE' } },
          performedBy: 'user-123'
        },
        3 // Expected baseVersion 3 != Current 4
      )
    ).rejects.toThrow(OptimisticConcurrencyError);
  });

  it('successfully increments aggregateVersion sequentially on dual-write', async () => {
    const entityRef = { id: 'client-1', path: 'clients/client-1' } as any;
    
    mockDocStore.set(entityRef.path, {
      name: 'Client 1',
      edits: { aggregateVersion: 1 }
    });

    const res = await VersioningService.executeDualWriteTransaction(
      {} as any,
      entityRef,
      { name: 'Client 1 Renamed' },
      {
        tenantId: 'tenant-default',
        module: 'clients',
        entityType: 'client',
        entityId: 'client-1',
        entityLabel: 'Client 1',
        eventType: 'FIELD_MUTATION',
        keysChanged: ['name'],
        mutations: { name: { old: 'Client 1', new: 'Client 1 Renamed', semantics: 'DESCRIPTIVE' } },
        performedBy: 'user-123'
      },
      1
    );

    expect(res.aggregateVersion).toBe(2);
    expect(res.ledgerId).toBeDefined();

    const updatedEntity = mockDocStore.get(entityRef.path);
    expect(updatedEntity.name).toBe('Client 1 Renamed');
    expect(updatedEntity.edits.aggregateVersion).toBe(2);
  });

  it('executes safe compensating reversal when value is compatible', async () => {
    const entityRef = { id: 'client-1', path: 'clients/client-1' } as any;
    const targetEntryId = 'ledger-10';

    mockDocStore.set(entityRef.path, {
      name: 'New Name',
      edits: { aggregateVersion: 2 }
    });

    mockDocStore.set(`system_ledger/${targetEntryId}`, {
      id: targetEntryId,
      tenantId: 'tenant-default',
      module: 'clients',
      entityType: 'client',
      entityId: 'client-1',
      entityLabel: 'Client 1',
      eventType: 'FIELD_MUTATION',
      baseVersion: 1,
      aggregateVersion: 2,
      keysChanged: ['name'],
      mutations: {
        name: { old: 'Old Name', new: 'New Name', semantics: 'DESCRIPTIVE' }
      }
    });

    const result = await VersioningService.revertLedgerEntry({} as any, {
      entryId: targetEntryId,
      entityRef,
      performedBy: 'superadmin-1',
      tenantId: 'tenant-default'
    });

    expect(result.mode).toBe('SAFE_COMPENSATING');
    expect(result.aggregateVersion).toBe(3);

    const updatedEntity = mockDocStore.get(entityRef.path);
    expect(updatedEntity.name).toBe('Old Name');
    expect(updatedEntity.edits.aggregateVersion).toBe(3);

    const marker = mockDocStore.get(`system_ledger_reversals/${targetEntryId}`);
    expect(marker).toBeDefined();
    expect(marker.reversedBy).toBe('superadmin-1');
  });

  it('prevents double-reversal by throwing AlreadyReversedError', async () => {
    const entityRef = { id: 'client-1', path: 'clients/client-1' } as any;
    const targetEntryId = 'ledger-10';

    mockDocStore.set(`system_ledger/${targetEntryId}`, {
      id: targetEntryId,
      tenantId: 'tenant-default'
    });
    mockDocStore.set(`system_ledger_reversals/${targetEntryId}`, {
      targetEntryId,
      reversedBy: 'superadmin-1'
    });

    await expect(
      VersioningService.revertLedgerEntry({} as any, {
        entryId: targetEntryId,
        entityRef,
        performedBy: 'superadmin-1',
        tenantId: 'tenant-default'
      })
    ).rejects.toThrow(AlreadyReversedError);
  });

  it('detects downstream mutation conflict and requires isForced', async () => {
    const entityRef = { id: 'client-1', path: 'clients/client-1' } as any;
    const targetEntryId = 'ledger-10';

    // Current name is 'Third Name' which does not match targetEntry.mutations.name.new ('Second Name')
    mockDocStore.set(entityRef.path, {
      name: 'Third Name',
      edits: { aggregateVersion: 3 }
    });

    mockDocStore.set(`system_ledger/${targetEntryId}`, {
      id: targetEntryId,
      tenantId: 'tenant-default',
      module: 'clients',
      entityType: 'client',
      entityId: 'client-1',
      entityLabel: 'Client 1',
      eventType: 'FIELD_MUTATION',
      baseVersion: 1,
      aggregateVersion: 2,
      keysChanged: ['name'],
      mutations: {
        name: { old: 'First Name', new: 'Second Name', semantics: 'DESCRIPTIVE' }
      }
    });

    // Without isForced -> throws ReversalConflictError
    await expect(
      VersioningService.revertLedgerEntry({} as any, {
        entryId: targetEntryId,
        entityRef,
        performedBy: 'superadmin-1',
        tenantId: 'tenant-default'
      })
    ).rejects.toThrow(ReversalConflictError);

    // With isForced: true -> succeeds with mode FORCED_COMPENSATING
    const result = await VersioningService.revertLedgerEntry({} as any, {
      entryId: targetEntryId,
      entityRef,
      performedBy: 'superadmin-1',
      tenantId: 'tenant-default',
      isForced: true
    });

    expect(result.mode).toBe('FORCED_COMPENSATING');
    const updatedEntity = mockDocStore.get(entityRef.path);
    expect(updatedEntity.name).toBe('First Name');
  });

  it('performs exact ADDITIVE delta reversal regardless of downstream changes', async () => {
    const entityRef = { id: 'product-1', path: 'products/product-1' } as any;
    const targetEntryId = 'ledger-stock-1';

    // V10: stock 100 -> 150 (delta +50)
    // Later mutations made current stock 170
    mockDocStore.set(entityRef.path, {
      stock: 170,
      edits: { aggregateVersion: 5 }
    });

    mockDocStore.set(`system_ledger/${targetEntryId}`, {
      id: targetEntryId,
      tenantId: 'tenant-default',
      module: 'products',
      entityType: 'product',
      entityId: 'product-1',
      entityLabel: 'Product 1',
      eventType: 'NUMERICAL_DELTA',
      baseVersion: 1,
      aggregateVersion: 2,
      keysChanged: ['stock'],
      mutations: {
        stock: { old: 100, new: 150, semantics: 'ADDITIVE', delta: 50 }
      }
    });

    const result = await VersioningService.revertLedgerEntry({} as any, {
      entryId: targetEntryId,
      entityRef,
      performedBy: 'superadmin-1',
      tenantId: 'tenant-default'
    });

    expect(result.mode).toBe('SAFE_COMPENSATING');
    const updatedEntity = mockDocStore.get(entityRef.path);
    // 170 + (-50) = 120
    expect(updatedEntity.stock).toBe(120);
  });
});
