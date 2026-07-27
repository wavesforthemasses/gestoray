import { db, collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';
import { generateSearchTerms } from '$lib/search-utils';

export interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phone: string;
  mobile: string;
  email: string;
  pec: string;
  doNotContact: boolean;
  notes: string;
  linkedClientIds: string[];
  createdBy: string;
  createdAt: string;
  modifiedAt?: string;
  derived?: any;
}

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  role?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  pec?: string;
  doNotContact?: boolean;
  notes?: string;
  linkedClientIds?: string[];
  userId: string;
}

export class ContactsService {
  /**
   * Fetches list of contacts with optional text search or client filtering.
   */
  static async fetchContacts(
    searchVal?: string,
    filterClientId?: string,
    filterStatus?: 'all' | 'active' | 'doNotContact'
  ): Promise<ContactItem[]> {
    let q: any = collection(db, 'contacts');

    if (searchVal && searchVal.trim()) {
      const term = searchVal.trim().toLowerCase();
      q = query(q, where('derived.textSearch', 'array-contains', term));
    }

    if (filterClientId) {
      q = query(q, where('original.linkedClientIds', 'array-contains', filterClientId));
    }

    const snap = await getDocs(q);
    const list: ContactItem[] = [];

    snap.forEach((docSnap) => {
      const data: any = docSnap.data();
      const orig = data.original || {};

      const item: ContactItem = {
        id: docSnap.id,
        firstName: orig.firstName || '',
        lastName: orig.lastName || '',
        fullName: `${orig.firstName || ''} ${orig.lastName || ''}`.trim(),
        role: orig.role || '',
        phone: orig.phone || '',
        mobile: orig.mobile || '',
        email: orig.email || '',
        pec: orig.pec || '',
        doNotContact: !!orig.doNotContact,
        notes: orig.notes || '',
        linkedClientIds: orig.linkedClientIds || [],
        createdBy: orig.createdBy || '',
        createdAt: data.edits?.createdAt || orig.createdAt || new Date().toISOString(),
        modifiedAt: data.edits?.modifiedAt,
        derived: data.derived || {}
      };

      if (filterStatus === 'active' && item.doNotContact) return;
      if (filterStatus === 'doNotContact' && !item.doNotContact) return;

      list.push(item);
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Gets a single contact by ID.
   */
  static async getContact(contactId: string): Promise<ContactItem | null> {
    const docSnap = await getDoc(doc(db, 'contacts', contactId));
    if (!docSnap.exists()) return null;

    const data: any = docSnap.data();
    const orig = data.original || {};

    return {
      id: docSnap.id,
      firstName: orig.firstName || '',
      lastName: orig.lastName || '',
      fullName: `${orig.firstName || ''} ${orig.lastName || ''}`.trim(),
      role: orig.role || '',
      phone: orig.phone || '',
      mobile: orig.mobile || '',
      email: orig.email || '',
      pec: orig.pec || '',
      doNotContact: !!orig.doNotContact,
      notes: orig.notes || '',
      linkedClientIds: orig.linkedClientIds || [],
      createdBy: orig.createdBy || '',
      createdAt: data.edits?.createdAt || orig.createdAt || new Date().toISOString(),
      derived: data.derived || {}
    };
  }

  /**
   * Creates a new contact.
   */
  static async createContact(input: CreateContactInput): Promise<string> {
    const contactId = generateId('cnt');
    const now = new Date().toISOString();

    const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
    const terms = generateSearchTerms(fullName, input.phone || '', input.mobile || '', input.email || '', input.role || '');

    const payload = {
      original: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        role: (input.role || '').trim(),
        phone: (input.phone || '').trim(),
        mobile: (input.mobile || '').trim(),
        email: (input.email || '').trim(),
        pec: (input.pec || '').trim(),
        doNotContact: !!input.doNotContact,
        notes: (input.notes || '').trim(),
        linkedClientIds: input.linkedClientIds || [],
        createdBy: input.userId,
        createdAt: now
      },
      edits: {
        createdAt: now,
        createdBy: input.userId
      },
      derived: {
        textSearch: terms
      }
    };

    await setDoc(doc(db, 'contacts', contactId), payload);
    return contactId;
  }

  /**
   * Updates an existing contact.
   */
  static async updateContact(contactId: string, input: Partial<CreateContactInput> & { userId: string }): Promise<void> {
    const current = await this.getContact(contactId);
    if (!current) throw new Error('Contatto non trovato.');

    const now = new Date().toISOString();
    const firstName = input.firstName !== undefined ? input.firstName.trim() : current.firstName;
    const lastName = input.lastName !== undefined ? input.lastName.trim() : current.lastName;
    const fullName = `${firstName} ${lastName}`.trim();

    const role = input.role !== undefined ? input.role.trim() : current.role;
    const phone = input.phone !== undefined ? input.phone.trim() : current.phone;
    const mobile = input.mobile !== undefined ? input.mobile.trim() : current.mobile;
    const email = input.email !== undefined ? input.email.trim() : current.email;
    const pec = input.pec !== undefined ? input.pec.trim() : current.pec;
    const doNotContact = input.doNotContact !== undefined ? input.doNotContact : current.doNotContact;
    const notes = input.notes !== undefined ? input.notes.trim() : current.notes;
    const linkedClientIds = input.linkedClientIds !== undefined ? input.linkedClientIds : current.linkedClientIds;

    const terms = generateSearchTerms(fullName, phone, mobile, email, role);

    const updates = {
      'original.firstName': firstName,
      'original.lastName': lastName,
      'original.role': role,
      'original.phone': phone,
      'original.mobile': mobile,
      'original.email': email,
      'original.pec': pec,
      'original.doNotContact': doNotContact,
      'original.notes': notes,
      'original.linkedClientIds': linkedClientIds,
      'edits.modifiedAt': now,
      'edits.modifiedBy': input.userId,
      'derived.textSearch': terms
    };

    await updateDoc(doc(db, 'contacts', contactId), updates);
  }

  /**
   * Deletes a contact.
   */
  static async deleteContact(contactId: string): Promise<void> {
    await deleteDoc(doc(db, 'contacts', contactId));
  }

  /**
   * Links a contact to a client ID (Many-to-Many).
   */
  static async linkContactToClient(contactId: string, clientId: string, userId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) return;
    if (!contact.linkedClientIds.includes(clientId)) {
      const updated = [...contact.linkedClientIds, clientId];
      await updateDoc(doc(db, 'contacts', contactId), {
        'original.linkedClientIds': updated,
        'edits.modifiedAt': new Date().toISOString(),
        'edits.modifiedBy': userId
      });
    }
  }

  /**
   * Unlinks a contact from a client ID.
   */
  static async unlinkContactFromClient(contactId: string, clientId: string, userId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) return;
    const updated = contact.linkedClientIds.filter(id => id !== clientId);
    await updateDoc(doc(db, 'contacts', contactId), {
      'original.linkedClientIds': updated,
      'edits.modifiedAt': new Date().toISOString(),
      'edits.modifiedBy': userId
    });
  }
}
