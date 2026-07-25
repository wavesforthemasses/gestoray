import { writable } from 'svelte/store';

export const isOnlineStore = writable<boolean>(true);

export function initNetworkStateListener() {
  if (typeof window === 'undefined') return;

  isOnlineStore.set(navigator.onLine);

  window.addEventListener('online', () => {
    isOnlineStore.set(true);
  });

  window.addEventListener('offline', () => {
    isOnlineStore.set(false);
  });
}
