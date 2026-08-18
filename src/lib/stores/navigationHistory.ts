import { writable, derived } from 'svelte/store';
import { goto } from '$app/navigation';
import type { AfterNavigate } from '@sveltejs/kit';

const MAX_STACK_SIZE = 50;

/**
 * Internal stack of visited relative URLs within the application.
 */
export const navigationStackStore = writable<string[]>([]);

/**
 * Boolean store indicating if backwards navigation is possible.
 */
export const canGoBackStore = derived(navigationStackStore, ($stack) => {
  if ($stack.length > 1) return true;
  // If we have at least 1 item and it's not the root /dashboard, allow back
  if ($stack.length === 1 && $stack[0] !== '/dashboard' && $stack[0] !== '/dashboard/') {
    return true;
  }
  return false;
});

let isNavigatingInternally = false;

/**
 * Records navigation events to maintain an accurate history stack.
 */
export function recordNavigation(nav: AfterNavigate) {
  if (!nav.to?.url) return;

  const targetPath = nav.to.url.pathname + nav.to.url.search + nav.to.url.hash;

  // Don't record non-dashboard routes (e.g. login)
  if (!targetPath.startsWith('/dashboard')) {
    navigationStackStore.set([]);
    return;
  }

  navigationStackStore.update((stack) => {
    if (nav.type === 'popstate') {
      // Browser back/forward button was used
      const idx = stack.lastIndexOf(targetPath);
      if (idx !== -1) {
        return stack.slice(0, idx + 1);
      }
      return [...stack.slice(0, -1), targetPath];
    }

    // Ignore duplicate pushes to the same exact URL
    if (stack.length > 0 && stack[stack.length - 1] === targetPath) {
      return stack;
    }

    const nextStack = [...stack, targetPath];
    if (nextStack.length > MAX_STACK_SIZE) {
      nextStack.shift();
    }
    return nextStack;
  });
}

/**
 * Global back navigation executor.
 * Pops the current page and navigates to the previous visited page.
 */
export async function executeGlobalBack(): Promise<void> {
  if (isNavigatingInternally) return;

  let targetUrl: string | null = null;

  navigationStackStore.update((stack) => {
    if (stack.length > 1) {
      // Remove current page
      stack.pop();
      // Target is now the previous top
      targetUrl = stack[stack.length - 1];
      return [...stack];
    }
    if (stack.length === 1 && stack[0] !== '/dashboard' && stack[0] !== '/dashboard/') {
      stack.pop();
      targetUrl = '/dashboard';
      return ['/dashboard'];
    }
    return stack;
  });

  if (targetUrl) {
    isNavigatingInternally = true;
    try {
      await goto(targetUrl);
    } finally {
      isNavigatingInternally = false;
    }
  } else if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
  } else {
    await goto('/dashboard');
  }
}
