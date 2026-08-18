import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { UsersService, type UserData } from '../../routes/dashboard/users/users.service';

export const UsersActivitiesBridge: ModuleActivitiesBridgeSpec<UserData> = {
  moduleId: 'users',
  targetType: 'user',
  targetLabel: 'Utente Interno / Dipendente',
  targetIcon: 'Users',

  async searchTargets(searchVal: string, tenantId?: string): Promise<TargetSearchResult<UserData>[]> {
    try {
      const users = await UsersService.getUsers(searchVal, 'active');
      return users.map(u => {
        const fullName = `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email || 'Utente';
        const roleStr = Array.isArray(u.roles) ? u.roles.join(', ') : '';
        const subtext = [roleStr, u.email].filter(Boolean).join(' • ');
        return {
          id: u.uid,
          label: fullName,
          subtext,
          badge: u.qualification || (u.roles?.[0]),
          email: u.email,
          raw: u
        };
      });
    } catch (e) {
      console.warn('[UsersActivitiesBridge] Errore ricerca utenti:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, tenantId?: string): Promise<TargetSummary | null> {
    try {
      const user = await UsersService.getUser(id);
      if (!user) return null;
      const original = user.original || user;
      const fullName = `${original.nome || ''} ${original.cognome || ''}`.trim() || original.email || 'Utente';
      return {
        id,
        name: fullName,
        targetType: 'user',
        url: `/dashboard/users/${id}`,
        email: original.email,
        meta: {
          roles: original.roles,
          qualification: original.qualification
        }
      };
    } catch (e) {
      console.warn('[UsersActivitiesBridge] Errore lettura utente:', e);
      return null;
    }
  }
};
