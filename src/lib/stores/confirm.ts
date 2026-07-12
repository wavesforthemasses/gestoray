import { writable } from 'svelte/store';

export interface ConfirmState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function createConfirmStore() {
  const { subscribe, set, update } = writable<ConfirmState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  return {
    subscribe,
    prompt: (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        set({
          isOpen: true,
          message,
          onConfirm: () => {
            set({ isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} });
            resolve(true);
          },
          onCancel: () => {
            set({ isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} });
            resolve(false);
          }
        });
      });
    },
    close: () => {
      update(state => {
        state.onCancel();
        return { isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} };
      });
    }
  };
}

export const confirmStore = createConfirmStore();
