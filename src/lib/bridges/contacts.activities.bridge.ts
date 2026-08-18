import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { ContactsService, type ContactItem } from '$lib/services/contacts.service';

export const ContactsActivitiesBridge: ModuleActivitiesBridgeSpec<ContactItem> = {
  moduleId: 'contacts',
  targetType: 'contact',
  targetLabel: 'Contatto / Persona',
  targetIcon: 'UserCheck',

  async searchTargets(searchVal: string, tenantId?: string): Promise<TargetSearchResult<ContactItem>[]> {
    try {
      const contacts = await ContactsService.fetchContacts(searchVal, undefined, 'all', tenantId);
      return contacts.map(c => ({
        id: c.id,
        label: c.fullName || `${c.firstName} ${c.lastName}`.trim(),
        subtext: c.role ? `${c.role} ${c.email ? '• ' + c.email : ''}` : c.email || c.phone,
        badge: c.doNotContact ? 'Non contattare' : undefined,
        phone: c.mobile || c.phone,
        email: c.email,
        raw: c
      }));
    } catch (e) {
      console.warn('[ContactsActivitiesBridge] Errore ricerca contatti:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, tenantId?: string): Promise<TargetSummary | null> {
    try {
      const contact = await ContactsService.getContact(id);
      if (!contact) return null;
      return {
        id: contact.id,
        name: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
        targetType: 'contact',
        url: `/dashboard/contacts/${contact.id}`,
        email: contact.email,
        phone: contact.mobile || contact.phone,
        meta: {
          role: contact.role,
          linkedClientIds: contact.linkedClientIds
        }
      };
    } catch (e) {
      console.warn('[ContactsActivitiesBridge] Errore lettura contatto:', e);
      return null;
    }
  }
};
