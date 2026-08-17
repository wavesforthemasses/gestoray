import { writable } from 'svelte/store';
import modulesRegistry from '$lib/config/modules.registry.json';

// Mappa reattiva: idModulo -> numero badge (es. { tickets: 3, todo: 2 })
export const menuBadgesStore = writable<Record<string, number>>({});

export function setMenuBadge(moduleId: string, count: number) {
  menuBadgesStore.update(current => ({
    ...current,
    [moduleId]: Math.max(0, count)
  }));
}

let unsubTicketsBadge: (() => void) | null = null;

export function initTicketsBadgeListener(userUid: string | null, isExecutive: boolean) {
  if (unsubTicketsBadge) {
    unsubTicketsBadge();
    unsubTicketsBadge = null;
  }

  // Verifica che il modulo tickets sia effettivamente installato
  const isTicketsInstalled = (modulesRegistry.modules || []).some((m: any) => m.id === 'tickets');
  if (!isTicketsInstalled || (!userUid && !isExecutive)) {
    setMenuBadge('tickets', 0);
    return;
  }

  try {
    const ticketsGlob = import.meta.glob('../../routes/dashboard/tickets/tickets.service.ts');
    const globKey = Object.keys(ticketsGlob)[0];
    if (globKey && typeof ticketsGlob[globKey] === 'function') {
      (ticketsGlob[globKey]() as Promise<any>).then((mod: any) => {
        if (mod?.TicketsService) {
          unsubTicketsBadge = mod.TicketsService.subscribeToActiveTicketsCount(userUid || '', isExecutive, (count: number) => {
            setMenuBadge('tickets', count);
          });
        }
      }).catch(err => {
        console.warn('Errore import TicketsService per badges:', err);
      });
    }
  } catch (e) {
    console.warn('Impossibile agganciare listener badge tickets', e);
  }
}

export function destroyBadgesListeners() {
  if (unsubTicketsBadge) {
    unsubTicketsBadge();
    unsubTicketsBadge = null;
  }
}
