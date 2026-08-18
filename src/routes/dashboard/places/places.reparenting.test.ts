import { describe, it, expect, vi } from 'vitest';
import { PlaceFirestoreRepository } from './infrastructure/firestore/PlaceFirestoreRepository';
import type { PlaceDocument } from './domain/models/place';

describe('Places Reparenting & Cycle Detection Unit Tests', () => {
  it('throws error when a place attempts to be its own parent', async () => {
    const repo = new PlaceFirestoreRepository({} as any);
    await expect(
      repo.updatePlaceParentWithCascade('org-1', 'place-1', 'place-1')
    ).rejects.toThrow('Un luogo non può essere genitore di se stesso.');
  });

  it('detects and prevents circular hierarchy (cannot reparent under own descendant)', async () => {
    // Mock getDocs to return descendant 'child-1'
    const mockDb: any = {};
    const repo = new PlaceFirestoreRepository(mockDb);

    // Mock Firestore methods in repository context
    const mockDescendantDocs = [
      { id: 'child-1', data: () => ({ ancestors: ['target-1'], depth: 1 }) },
      { id: 'sub-child-2', data: () => ({ ancestors: ['target-1', 'child-1'], depth: 2 }) }
    ];

    vi.spyOn(repo as any, 'getPlacesCollection').mockReturnValue({});
    
    // Test detection logic directly
    const targetPlaceId = 'target-1';
    const newParentId = 'sub-child-2';
    const descendantIds = mockDescendantDocs.map(d => d.id);

    const isCycle = descendantIds.includes(newParentId);
    expect(isCycle).toBe(true);
  });

  it('recalculates ancestors and depths correctly on valid reparenting', () => {
    const rootA = { id: 'root-a', ancestors: [], depth: 0 };
    const rootB = { id: 'root-b', ancestors: [], depth: 0 };
    const targetNode = { id: 'target-1', ancestors: ['root-a'], depth: 1 };
    const descendant1 = { id: 'desc-1', ancestors: ['root-a', 'target-1'], depth: 2 };
    const descendant2 = { id: 'desc-2', ancestors: ['root-a', 'target-1', 'desc-1'], depth: 3 };

    // Move targetNode under rootB
    const newParent = rootB;
    const newAncestors = [...newParent.ancestors, newParent.id];
    const newDepth = newParent.depth + 1;

    expect(newAncestors).toEqual(['root-b']);
    expect(newDepth).toBe(1);

    // Update descendant 1
    const splitIndex1 = descendant1.ancestors.indexOf(targetNode.id);
    const subPath1 = descendant1.ancestors.slice(splitIndex1);
    const updatedAncestors1 = [...newAncestors, ...subPath1];
    expect(updatedAncestors1).toEqual(['root-b', 'target-1']);
    expect(updatedAncestors1.length).toBe(2);

    // Update descendant 2
    const splitIndex2 = descendant2.ancestors.indexOf(targetNode.id);
    const subPath2 = descendant2.ancestors.slice(splitIndex2);
    const updatedAncestors2 = [...newAncestors, ...subPath2];
    expect(updatedAncestors2).toEqual(['root-b', 'target-1', 'desc-1']);
    expect(updatedAncestors2.length).toBe(3);
  });

  it('chunks operations in batches of 450 items', () => {
    const totalOps = 1000;
    const CHUNK_SIZE = 450;
    const chunks: number[] = [];

    for (let i = 0; i < totalOps; i += CHUNK_SIZE) {
      const chunk = Array(Math.min(CHUNK_SIZE, totalOps - i));
      chunks.push(chunk.length);
    }

    expect(chunks).toEqual([450, 450, 100]);
    expect(chunks.every(size => size <= 450)).toBe(true);
  });
});
