export interface UserProfile {
  uid: string;
  email: string;
  roles: string[];
  nome?: string;
  cognome?: string;
  qualification?: string;
  supervisorUid?: string;
}

export const authState = $state<{ user: UserProfile | null }>({ user: null });
export const activeRoleState = $state<{ role: string | null }>({ role: null });

export const has = {
  role: (roleName: string): boolean => {
    if (!authState.user || !authState.user.roles) {
      return false;
    }
    return authState.user.roles.includes(roleName);
  }
};
