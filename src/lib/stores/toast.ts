import { writable } from 'svelte/store';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export const toastsStore = writable<ToastMessage[]>([]);

export const toast = {
  success(message: string, duration = 4000) {
    this.add('success', message, duration);
  },
  error(message: string, duration = 5000) {
    this.add('error', message, duration);
  },
  info(message: string, duration = 4000) {
    this.add('info', message, duration);
  },
  warning(message: string, duration = 4500) {
    this.add('warning', message, duration);
  },
  add(type: ToastMessage['type'], message: string, duration = 4000) {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    toastsStore.update(toasts => [...toasts, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  },
  remove(id: string) {
    toastsStore.update(toasts => toasts.filter(t => t.id !== id));
  }
};
