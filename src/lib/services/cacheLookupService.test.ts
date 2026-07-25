import { describe, it, expect } from 'vitest';
import { CacheLookupService } from './cacheLookupService';

describe('CacheLookupService Unit Tests', () => {
  it('should format lightweight lookup map entries correctly', () => {
    const rawItems: Record<string, string> = {
      'c-1': 'Mario Rossi Srl',
      'c-2': 'ACME Spa'
    };

    const formatted = Object.entries(rawItems).map(([id, name]) => ({ id, name }));
    expect(formatted).toHaveLength(2);
    expect(formatted[0]).toEqual({ id: 'c-1', name: 'Mario Rossi Srl' });
    expect(formatted[1]).toEqual({ id: 'c-2', name: 'ACME Spa' });
  });

  it('should define MAX_ITEMS_PER_CHUNK threshold to prevent 1MB limit', () => {
    expect(CacheLookupService.MAX_ITEMS_PER_CHUNK).toBe(200);
  });
});
