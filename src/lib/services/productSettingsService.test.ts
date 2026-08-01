import { describe, it, expect, vi } from 'vitest';
import { ProductSettingsService, DEFAULT_PRODUCT_FIELDS_SETTINGS } from './productSettingsService';

vi.mock('$lib/firebase', () => ({
  db: {},
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined)
}));

describe('ProductSettingsService Unit Tests', () => {
  it('returns default product field settings when document does not exist', async () => {
    const settings = await ProductSettingsService.getSettings();
    expect(settings.sku.visible).toBe(true);
    expect(settings.sku.required).toBe(false);
    expect(settings.stockQty.visible).toBe(true);
    expect(settings.minimoFatturabile.visible).toBe(true);
  });
});
