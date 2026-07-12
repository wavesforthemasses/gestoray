import { writable } from 'svelte/store';
import { generateId } from '$lib/utils/helpers';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

function createToastStore() {
  const { subscribe, update } = writable<ToastMessage[]>([]);

  function addToast(type: ToastType, message: string, duration = 3000) {
    const id = generateId('toast');
    update((toasts) => [...toasts, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  function removeToast(id: string) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return {
    subscribe,
    success: (msg: string, duration?: number) => addToast('success', msg, duration),
    error: (msg: string, duration?: number) => addToast('error', msg, duration),
    info: (msg: string, duration?: number) => addToast('info', msg, duration),
    remove: removeToast
  };
}

export const toast = createToastStore();
