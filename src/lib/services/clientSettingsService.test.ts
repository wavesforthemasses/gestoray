import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientSettingsService, DEFAULT_CLIENT_FIELDS_SETTINGS } from './clientSettingsService';

vi.mock('$lib/firebase', () => ({
  db: {},
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn()
}));

import { getDoc, setDoc } from '$lib/firebase';

describe('ClientSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default settings if document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => ({})
    } as any);

    const settings = await ClientSettingsService.getSettings();
    expect(settings).toEqual(DEFAULT_CLIENT_FIELDS_SETTINGS);
  });

  it('should return custom settings merged with defaults if doc exists', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        affidabilitaCredito: { visible: false }
      })
    } as any);

    const settings = await ClientSettingsService.getSettings();
    expect(settings.affidabilitaCredito.visible).toBe(false);
    expect(settings.datiAnagrafici.defaultStatoCertificazione).toBe('in_attesa');
  });




  it('should save settings calling setDoc', async () => {
    await ClientSettingsService.saveSettings(DEFAULT_CLIENT_FIELDS_SETTINGS);
    expect(setDoc).toHaveBeenCalledOnce();
  });
});
