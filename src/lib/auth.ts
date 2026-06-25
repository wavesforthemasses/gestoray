import { writable, derived } from 'svelte/store';

export interface UserProfile {
  uid: string;
  email: string;
  roles: string[];
  nome?: string;
  cognome?: string;
  qualification?: 'junior' | 'senior';
}

export const auth = writable<UserProfile | null>(null);
export const activeRole = writable<string | null>(null);

export const has = derived(auth, ($auth) => {
  return {
    role: (roleName: string): boolean => {
      if (!$auth || !$auth.roles) {
        return false;
      }
      return $auth.roles.includes(roleName);
    }
  };
});
