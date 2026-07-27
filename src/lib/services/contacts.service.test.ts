import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactsService } from './contacts.service';

vi.mock('$lib/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

vi.mock('$lib/search-utils', () => ({
  generateSearchTerms: vi.fn(() => ['mario', 'rossi'])
}));

import { getDocs, getDoc, setDoc, updateDoc, deleteDoc } from '$lib/firebase';

describe('ContactsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch contacts list successfully', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      forEach: (cb: any) => {
        cb({
          id: 'cnt_1',
          data: () => ({
            original: {
              firstName: 'Mario',
              lastName: 'Rossi',
              email: 'mario@test.it',
              linkedClientIds: ['client_1']
            },
            edits: { createdAt: '2026-07-26T20:00:00Z' }
          })
        });
      }
    } as any);

    const res = await ContactsService.fetchContacts();
    expect(res.length).toBe(1);
    expect(res[0].fullName).toBe('Mario Rossi');
    expect(res[0].linkedClientIds).toContain('client_1');
  });

  it('should create a contact', async () => {
    const contactId = await ContactsService.createContact({
      firstName: 'Laura',
      lastName: 'Bianchi',
      email: 'l.bianchi@cgen.it',
      linkedClientIds: ['c001'],
      userId: 'user_1'
    });

    expect(contactId).toBeDefined();
    expect(setDoc).toHaveBeenCalledOnce();
  });

  it('should delete a contact', async () => {
    await ContactsService.deleteContact('cnt_1');
    expect(deleteDoc).toHaveBeenCalledOnce();
  });
});
