import { writable } from 'svelte/store';
import { db, collection, query, where, getDocs, onSnapshot } from '$lib/firebase';

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
    const colRef = collection(db, 'tickets');
    let q;
    if (isExecutive) {
      // Per ruoli direzionali: conta tutti i ticket aperti o in lavorazione
      q = query(colRef, where('status', 'in', ['aperto', 'in_lavorazione']));
    } else {
      // Per ruoli operativi: conta solo i propri ticket in lavorazione/aperti
      q = query(colRef, where('assignedTo', '==', userUid), where('status', 'in', ['aperto', 'in_lavorazione']));
    }

    unsubTicketsBadge = onSnapshot(q, (snap: any) => {
      setMenuBadge('tickets', snap.docs.length);
    }, (err: any) => {
      console.warn('Avviso ascoltatore badge ticket:', err.message);
    });
  } catch (e) {
    console.error('Errore inizializzazione badge ticket:', e);
  }
}

export function destroyBadgesListeners() {
  if (unsubTicketsBadge) {
    unsubTicketsBadge();
    unsubTicketsBadge = null;
  }
}
