import { describe, it, expect, vi } from 'vitest';
import { NavigationService } from './navigationService';

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

import { goto } from '$app/navigation';

describe('NavigationService', () => {
  describe('getReturnUrl', () => {
    it('should return returnUrl when present in searchParams', () => {
      const params = new URLSearchParams('returnUrl=%2Fdashboard%2Fplaces%2F123');
      expect(NavigationService.getReturnUrl(params, '/dashboard/activities')).toBe('/dashboard/places/123');
    });

    it('should return placeId url when placeId is present and no returnUrl', () => {
      const params = new URLSearchParams('placeId=P123');
      expect(NavigationService.getReturnUrl(params, '/dashboard/activities')).toBe('/dashboard/places/P123');
    });

    it('should return clientId url when clientId is present and no placeId/returnUrl', () => {
      const params = new URLSearchParams('clientId=C456');
      expect(NavigationService.getReturnUrl(params, '/dashboard/activities')).toBe('/dashboard/clients/C456');
    });

    it('should return defaultTargetUrl when no context params present', () => {
      const params = new URLSearchParams('');
      expect(NavigationService.getReturnUrl(params, '/dashboard/activities')).toBe('/dashboard/activities');
    });
  });

  describe('getBackLabel', () => {
    it('should return contextual label for placeId', () => {
      const params = new URLSearchParams('placeId=P123');
      expect(NavigationService.getBackLabel(params, 'Torna')).toBe('Torna al Cantiere');
    });

    it('should return contextual label for clientId', () => {
      const params = new URLSearchParams('clientId=C456');
      expect(NavigationService.getBackLabel(params, 'Torna')).toBe('Torna al Cliente');
    });

    it('should return contextual label for returnUrl', () => {
      const params = new URLSearchParams('returnUrl=%2Fdashboard');
      expect(NavigationService.getBackLabel(params, 'Torna')).toBe('Torna Indietro');
    });

    it('should return fallback label when no context params', () => {
      const params = new URLSearchParams('');
      expect(NavigationService.getBackLabel(params, 'Torna alla lista')).toBe('Torna alla lista');
    });
  });

  describe('cancelAndReturn and navigateBack', () => {
    it('should call goto with resolved return URL', async () => {
      const params = new URLSearchParams('placeId=P123');
      await NavigationService.cancelAndReturn(params, '/dashboard/activities');
      expect(goto).toHaveBeenCalledWith('/dashboard/places/P123');

      await NavigationService.navigateBack(params, '/dashboard/activities');
      expect(goto).toHaveBeenCalledWith('/dashboard/places/P123');
    });
  });

  describe('buildAddUrl and preserveParams', () => {
    it('should inject returnUrl and context parameters into add url', () => {
      const url = NavigationService.buildAddUrl('/dashboard/activities/add', { placeId: 'P123' }, '/dashboard/places/P123');
      expect(url).toContain('placeId=P123');
      expect(url).toContain('returnUrl=%2Fdashboard%2Fplaces%2FP123');
    });

    it('should preserve context parameters on target paths', () => {
      const params = new URLSearchParams('placeId=P123&other=ignored');
      const url = NavigationService.preserveParams('/dashboard/activities/act1/edit', params);
      expect(url).toBe('/dashboard/activities/act1/edit?placeId=P123');
    });
  });

  describe('Global History Navigation', () => {
    it('should record navigation and execute global back', async () => {
      const { recordNavigation, executeGlobalBack, navigationStackStore } = await import('$lib/stores/navigationHistory');
      
      // Initial page
      recordNavigation({
        to: { url: new URL('http://localhost:5173/dashboard') },
        from: null,
        type: 'goto',
        willUnload: false
      } as any);

      // Navigate to places
      recordNavigation({
        to: { url: new URL('http://localhost:5173/dashboard/places') },
        from: null,
        type: 'link',
        willUnload: false
      } as any);

      // Navigate to place detail
      recordNavigation({
        to: { url: new URL('http://localhost:5173/dashboard/places/P123') },
        from: null,
        type: 'link',
        willUnload: false
      } as any);

      let stack: string[] = [];
      navigationStackStore.subscribe(s => stack = s)();
      expect(stack).toEqual(['/dashboard', '/dashboard/places', '/dashboard/places/P123']);

      // Execute global back
      await executeGlobalBack();
      expect(goto).toHaveBeenCalledWith('/dashboard/places');
    });
  });
});
