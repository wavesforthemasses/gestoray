export type InputMode = 'none' | 'text' | 'match';

export interface ConfirmState {
  isOpen: boolean;
  message: string;
  inputMode: InputMode;
  defaultValue: string;
  expectedText: string;
  onConfirm: (val?: string) => void;
  onCancel: () => void;
}

const initialState: ConfirmState = {
  isOpen: false,
  message: '',
  inputMode: 'none',
  defaultValue: '',
  expectedText: '',
  onConfirm: () => {},
  onCancel: () => {}
};

function createConfirmStore() {
  let state = $state<ConfirmState>({ ...initialState });

  return {
    get isOpen() { return state.isOpen; },
    get message() { return state.message; },
    get inputMode() { return state.inputMode; },
    get defaultValue() { return state.defaultValue; },
    get expectedText() { return state.expectedText; },
    get onConfirm() { return state.onConfirm; },
    get onCancel() { return state.onCancel; },
    
    prompt: (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        state.isOpen = true;
        state.message = message;
        state.inputMode = 'none';
        state.defaultValue = '';
        state.expectedText = '';
        state.onConfirm = () => {
          Object.assign(state, initialState);
          resolve(true);
        };
        state.onCancel = () => {
          Object.assign(state, initialState);
          resolve(false);
        };
      });
    },
    requireMatch: (message: string, expectedText: string): Promise<boolean> => {
      return new Promise((resolve) => {
        state.isOpen = true;
        state.message = message;
        state.inputMode = 'match';
        state.defaultValue = '';
        state.expectedText = expectedText;
        state.onConfirm = () => {
          Object.assign(state, initialState);
          resolve(true);
        };
        state.onCancel = () => {
          Object.assign(state, initialState);
          resolve(false);
        };
      });
    },
    askInput: (message: string, defaultValue: string = ''): Promise<string | null> => {
      return new Promise((resolve) => {
        state.isOpen = true;
        state.message = message;
        state.inputMode = 'text';
        state.defaultValue = defaultValue;
        state.expectedText = '';
        state.onConfirm = (val?: string) => {
          Object.assign(state, initialState);
          resolve(val ?? '');
        };
        state.onCancel = () => {
          Object.assign(state, initialState);
          resolve(null);
        };
      });
    },
    close: () => {
      state.onCancel();
      Object.assign(state, initialState);
    }
  };
}

export const confirmStore = createConfirmStore();
