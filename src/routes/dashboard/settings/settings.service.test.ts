import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { menuConfigStore, type MenuItemConfig } from '$lib/stores/menu';

const BASE_CORE_MENU: MenuItemConfig[] = [
  { id: 'todo', label: 'Cose da Fare', icon: 'CheckSquare', path: '/dashboard/todo', rolesView: ['superadmin'] },
  { id: 'clients', label: 'Gestione Clienti', icon: 'Briefcase', path: '/dashboard/clients', rolesView: ['superadmin'] },
  { id: 'qualifications', label: 'Gestione Qualifiche', icon: 'Award', path: '/dashboard/qualifications', rolesView: ['superadmin'] },
  { id: 'users', label: 'Gestione Utenti', icon: 'Users', path: '/dashboard/users', rolesView: ['superadmin'] },
  { id: 'settings', label: 'Impostazioni', icon: 'Settings', path: '/dashboard/settings', matchExact: true, rolesView: ['superadmin'] }
];

describe('Settings Hub Dynamic Module Visibility', () => {
  it('should render ONLY base core settings cards when menu store has only base core items', () => {
    menuConfigStore.set(BASE_CORE_MENU);
    const menu = get(menuConfigStore);
    const hasTickets = menu.some((item) => item.id === 'tickets');
    const hasInterventi = menu.some((item) => item.id === 'interventi');

    expect(hasTickets).toBe(false);
    expect(hasInterventi).toBe(false);
  });

  it('should dynamically reveal Tickets settings card when tickets module is present in menu store', () => {
    const updatedMenu: MenuItemConfig[] = [
      ...BASE_CORE_MENU,
      { id: 'tickets', label: 'Ticket Assistenza', icon: 'Ticket', path: '/dashboard/tickets', rolesView: ['superadmin'] }
    ];

    menuConfigStore.set(updatedMenu);
    const menu = get(menuConfigStore);

    const hasTickets = menu.some((item) => item.id === 'tickets');
    const hasInterventi = menu.some((item) => item.id === 'interventi');

    expect(hasTickets).toBe(true);
    expect(hasInterventi).toBe(false);
  });

  it('should dynamically reveal Interventi settings card when interventi module is present in menu store', () => {
    const updatedMenu: MenuItemConfig[] = [
      ...BASE_CORE_MENU,
      { id: 'interventi', label: 'Interventi Campo', icon: 'Wrench', path: '/dashboard/interventi', rolesView: ['superadmin'] }
    ];

    menuConfigStore.set(updatedMenu);
    const menu = get(menuConfigStore);

    const hasTickets = menu.some((item) => item.id === 'tickets');
    const hasInterventi = menu.some((item) => item.id === 'interventi');

    expect(hasTickets).toBe(false);
    expect(hasInterventi).toBe(true);
  });

  it('should dynamically hide all module settings cards when clean-slate menu reset occurs', () => {
    // 1. Simulate installed modules in menu
    menuConfigStore.set([
      ...BASE_CORE_MENU,
      { id: 'tickets', label: 'Ticket Assistenza', icon: 'Ticket', path: '/dashboard/tickets', rolesView: ['superadmin'] },
      { id: 'interventi', label: 'Interventi Campo', icon: 'Wrench', path: '/dashboard/interventi', rolesView: ['superadmin'] }
    ]);

    let menu = get(menuConfigStore);
    expect(menu.some((item) => item.id === 'tickets')).toBe(true);
    expect(menu.some((item) => item.id === 'interventi')).toBe(true);

    // 2. Perform Clean Slate reset
    menuConfigStore.set(BASE_CORE_MENU);
    menu = get(menuConfigStore);

    expect(menu.some((item) => item.id === 'tickets')).toBe(false);
    expect(menu.some((item) => item.id === 'interventi')).toBe(false);
  });
});
