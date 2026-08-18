import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BridgesSettingsService, ALL_BRIDGES_SPECS, bridgesConfigStore } from './bridgesSettingsService';
import { get } from 'svelte/store';

vi.mock('$lib/firebase', () => {
  let store: any = {};
  return {
    db: {},
    doc: vi.fn((_db, coll, id) => `${coll}/${id}`),
    getDoc: vi.fn(async (path) => {
      if (store[path]) {
        return {
          exists: () => true,
          data: () => store[path]
        };
      }
      return {
        exists: () => false,
        data: () => undefined
      };
    }),
    setDoc: vi.fn(async (path, data, options) => {
      if (options?.merge && store[path]) {
        store[path] = { ...store[path], ...data };
      } else {
        store[path] = data;
      }
    })
  };
});

describe('BridgesSettingsService', () => {
  beforeEach(() => {
    bridgesConfigStore.set({});
  });

  it('should return default enabled statuses for all bridges', async () => {
    const statuses = await BridgesSettingsService.getBridgeStatuses();
    expect(statuses['activities-clients']).toBe(true);
    expect(statuses['activities-contacts']).toBe(true);
    expect(ALL_BRIDGES_SPECS.length).toBeGreaterThan(5);
  });

  it('should toggle a bridge status and persist it', async () => {
    await BridgesSettingsService.setBridgeStatus('activities-clients', false);
    const statuses = await BridgesSettingsService.getBridgeStatuses();
    expect(statuses['activities-clients']).toBe(false);

    expect(BridgesSettingsService.isBridgeEnabled('activities-clients', statuses)).toBe(false);
    expect(BridgesSettingsService.isBridgeEnabled('activities-contacts', statuses)).toBe(true);
  });
});
