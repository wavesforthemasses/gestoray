import { getContext, setContext } from 'svelte';
import type { PlaceDocument, PlaceHierarchyNode, PlaceStatus, PlaceType } from '../domain/models/place';
import { PlaceFirestoreRepository } from '../infrastructure/firestore/PlaceFirestoreRepository';
import { buildHierarchyTree, normalizeLegacyPlace } from '../domain/services/placeUtils';
import { toast } from '$lib/stores/toast.svelte';

const PLACES_CONTEXT_KEY = Symbol('PLACES_STATE_CONTEXT');

export class PlacesState {
  places = $state<PlaceDocument[]>([]);
  selectedPlaceId = $state<string | null>(null);
  isLoading = $state<boolean>(false);
  isSaving = $state<boolean>(false);
  filterType = $state<PlaceType | 'all'>('all');
  filterStatus = $state<string>('all');
  searchQuery = $state<string>('');
  viewMode = $state<'table' | 'cards' | 'map' | 'tree'>('table');

  filteredPlaces = $derived.by(() => {
    return this.places.filter(p => {
      const matchesType = this.filterType === 'all' || p.types.includes(this.filterType);
      
      let matchesStatus = true;
      if (this.filterStatus !== 'all') {
        const isLegacyActive = this.filterStatus === 'attivo' && (p.status === 'active' || p.status === 'attivo');
        const isLegacyArchived = this.filterStatus === 'inattivo' && (p.status === 'archived' || p.status === 'inattivo');
        matchesStatus = p.status === this.filterStatus || isLegacyActive || isLegacyArchived;
      }

      const q = this.searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        p.address.city.toLowerCase().includes(q) ||
        (p.address.street && p.address.street.toLowerCase().includes(q)) ||
        (p.clientName && p.clientName.toLowerCase().includes(q));

      return matchesType && matchesStatus && matchesSearch;
    });
  });

  selectedPlace = $derived(
    this.places.find(p => p.id === this.selectedPlaceId) ?? null
  );

  hierarchyTree = $derived(
    buildHierarchyTree(this.filteredPlaces)
  );

  activePlacesCount = $derived(
    this.places.filter(p => p.status === 'active' || p.status === 'attivo').length
  );

  constructor(
    public repo: PlaceFirestoreRepository = new PlaceFirestoreRepository(),
    public orgId: string = 'default'
  ) {}

  async loadPlaces(clientId?: string): Promise<void> {
    this.isLoading = true;
    try {
      this.places = await this.repo.fetchPlaces(this.orgId, { clientId });
    } catch (err: any) {
      console.error('Errore caricamento PlacesState:', err);
      toast.error('Errore nel caricamento dei luoghi: ' + err.message);
    } finally {
      this.isLoading = false;
    }
  }

  selectPlace(placeId: string | null): void {
    this.selectedPlaceId = placeId;
  }

  async createPlace(
    data: Partial<PlaceDocument>,
    oldCode?: string
  ): Promise<string> {
    this.isSaving = true;
    try {
      const id = await this.repo.savePlaceWithUniqueCodeLock(this.orgId, data, undefined, oldCode);
      await this.loadPlaces();
      return id;
    } finally {
      this.isSaving = false;
    }
  }

  async updatePlace(
    id: string,
    data: Partial<PlaceDocument>,
    oldCode?: string
  ): Promise<void> {
    this.isSaving = true;
    try {
      await this.repo.savePlaceWithUniqueCodeLock(this.orgId, data, id, oldCode);
      await this.loadPlaces();
    } finally {
      this.isSaving = false;
    }
  }

  async reparentPlace(targetPlaceId: string, newParentId: string | null): Promise<void> {
    this.isSaving = true;
    try {
      await this.repo.updatePlaceParentWithCascade(this.orgId, targetPlaceId, newParentId);
      toast.success('Gerarchia del luogo aggiornata con successo!');
      await this.loadPlaces();
    } catch (err: any) {
      console.error('Errore reparenting:', err);
      toast.error(err.message || 'Errore durante lo spostamento nella gerarchia.');
      throw err;
    } finally {
      this.isSaving = false;
    }
  }

  async deletePlace(id: string, softDelete = true, uid?: string): Promise<void> {
    this.isSaving = true;
    try {
      await this.repo.deletePlaceWithLockRelease(this.orgId, id, softDelete, uid);
      this.places = this.places.filter(p => p.id !== id);
      if (this.selectedPlaceId === id) {
        this.selectedPlaceId = null;
      }
      toast.success('Luogo eliminato con successo!');
    } catch (err: any) {
      console.error('Errore eliminazione luogo:', err);
      toast.error('Errore durante l\'eliminazione: ' + err.message);
    } finally {
      this.isSaving = false;
    }
  }
}

// Helper Context-Safe per SvelteKit (Zero SSR Memory Leaks)
export function setPlacesContext(repo?: PlaceFirestoreRepository, orgId?: string): PlacesState {
  const state = new PlacesState(repo, orgId);
  setContext(PLACES_CONTEXT_KEY, state);
  return state;
}

export function getPlacesContext(): PlacesState {
  const context = getContext<PlacesState>(PLACES_CONTEXT_KEY);
  if (!context) {
    // Fallback sicuro se chiamato fuori dal provider diretto
    return new PlacesState();
  }
  return context;
}
