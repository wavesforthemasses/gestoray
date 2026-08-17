<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { TeamsService } from '../teams.service';
  import { VehiclesService } from '../vehicles.service';
  import type { TeamItem, VehicleItem } from '../schema';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';

  let teams = $state<TeamItem[]>([]);
  let vehicles = $state<VehicleItem[]>([]);
  let users = $state<{ id: string; name: string }[]>([]);
  
  let loading = $state(true);
  let showModal = $state(false);
  let saving = $state(false);
  let searchQuery = $state('');

  // Form State Nuova / Modifica Squadra
  let editingId = $state<string | null>(null);
  let teamName = $state('');
  let teamColor = $state('#3b82f6');
  let leaderUid = $state('');
  let defaultVehicleId = $state('');
  let selectedMemberUids = $state<string[]>([]);

  onMount(async () => {
    try {
      await loadData();
    } catch (e) {
      console.error('Errore caricamento squadre:', e);
    } finally {
      loading = false;
    }
  });

  async function loadData() {
    teams = await TeamsService.getTeams();
    vehicles = await VehiclesService.getVehicles();

    users = await CacheLookupService.getLookup('users');
  }

  function openCreateModal() {
    editingId = null;
    teamName = '';
    teamColor = '#3b82f6';
    leaderUid = '';
    defaultVehicleId = '';
    selectedMemberUids = [];
    showModal = true;
  }

  function openEditModal(t: TeamItem) {
    editingId = t.id || null;
    teamName = t.name;
    teamColor = t.color || '#3b82f6';
    leaderUid = t.leaderUid || '';
    defaultVehicleId = t.defaultVehicleId || '';
    selectedMemberUids = t.memberUids ? [...t.memberUids] : [];
    showModal = true;
  }

  function toggleMember(uId: string) {
    if (selectedMemberUids.includes(uId)) {
      selectedMemberUids = selectedMemberUids.filter(id => id !== uId);
    } else {
      selectedMemberUids = [...selectedMemberUids, uId];
    }
  }

  async function handleSaveTeam(e: SubmitEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;

    saving = true;
    try {
      if (editingId) {
        await TeamsService.updateTeam(editingId, {
          name: teamName.trim(),
          color: teamColor,
          leaderUid: leaderUid || undefined,
          defaultVehicleId: defaultVehicleId || undefined,
          memberUids: selectedMemberUids
        });
      } else {
        await TeamsService.createTeam({
          name: teamName.trim(),
          color: teamColor,
          leaderUid: leaderUid || undefined,
          defaultVehicleId: defaultVehicleId || undefined,
          memberUids: selectedMemberUids,
          active: true
        });
      }
      showModal = false;
      await loadData();
    } catch (err: any) {
      toast.error('Errore salvataggio squadra: ' + err.message);
    } finally {
      saving = false;
    }
  }

  async function handleDeleteTeam(id?: string) {
    if (!id) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questa squadra?');
    if (!confirmed) return;
    try {
      await TeamsService.deleteTeam(id);
      toast.success('Squadra eliminata con successo');
      await loadData();
    } catch (e: any) {
      toast.error('Errore eliminazione squadra: ' + e.message);
    }
  }

  let filteredTeams = $derived(
    teams.filter(t => !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
</script>

<svelte:head>
  <title>Gestione Squadre di Lavoro | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="teams-page">
  <!-- SUB-NAV / HEADER -->
  <header class="page-header">
    <div>
      <a href="/dashboard/interventi" class="back-link">← Torna agli Interventi</a>
      <h1 class="page-title">👥 Gestione Squadre di Lavoro (Teams & Crews)</h1>
      <p class="page-subtitle">Crea e gestisci le squadre di operatori, i capisquadra ed i mezzi aziendali abbinati di default.</p>
    </div>
    <div class="header-actions">
      <button type="button" class="btn btn-primary" onclick={openCreateModal}>+ Nuova Squadra</button>
    </div>
  </header>

  <!-- MODULE SUB-NAV BAR -->
  <nav class="module-nav-bar">
    <a href="/dashboard/interventi" class="nav-tab">📋 Interventi & Progetti</a>
    <a href="/dashboard/interventi/teams" class="nav-tab active">👥 Squadre di Lavoro ({teams.length})</a>
    <a href="/dashboard/interventi/vehicles" class="nav-tab">🚚 Parco Mezzi ({vehicles.length})</a>
    <a href="/dashboard/settings/interventi" class="nav-tab tab-settings">⚙️ Impostazioni Modulo</a>
  </nav>

  <!-- SEARCH BOX -->
  <div class="filter-card">
    <input 
      type="text" 
      placeholder="🔍 Cerca squadra per nome..." 
      bind:value={searchQuery} 
      class="search-input"
    />
  </div>

  {#if loading}
    <div class="loading-state">Caricamento squadre di lavoro...</div>
  {:else if filteredTeams.length === 0}
    <div class="empty-state">
      <span class="empty-icon">👥</span>
      <h3>Nessuna squadra trovata</h3>
      <p>Crea la prima squadra per velocizzare la pianificazione degli interventi.</p>
      <button type="button" class="btn btn-primary" onclick={openCreateModal}>+ Crea Nuova Squadra</button>
    </div>
  {:else}
    <div class="teams-grid">
      {#each filteredTeams as t}
        {@const leader = users.find(u => u.id === t.leaderUid)}
        {@const veh = vehicles.find(v => v.id === t.defaultVehicleId)}
        <div class="team-card" style="border-top: 4px solid {t.color || '#3b82f6'};">
          <div class="team-card-header">
            <h3>{t.name}</h3>
            <div class="card-actions">
              <button type="button" class="btn-icon" onclick={() => openEditModal(t)}>✏️</button>
              <button type="button" class="btn-icon-danger" onclick={() => handleDeleteTeam(t.id)}>🗑️</button>
            </div>
          </div>

          <div class="team-card-body">
            <div class="info-row">
              <span class="info-label">Caposquadra:</span>
              <strong>{leader ? leader.name : 'Nessuno'}</strong>
            </div>

            <div class="info-row">
              <span class="info-label">Mezzo Default:</span>
              <span>{veh ? `🚚 ${veh.name} (${veh.plate || 'No Targa'})` : 'Nessun Mezzo'}</span>
            </div>

            <div class="info-row">
              <span class="info-label">Componenti ({t.memberUids?.length || 0}):</span>
              <div class="members-tags">
                {#if t.memberUids && t.memberUids.length > 0}
                  {#each t.memberUids as mUid}
                    {@const member = users.find(u => u.id === mUid)}
                    <span class="member-tag">👷 {member ? member.name : mUid}</span>
                  {/each}
                {:else}
                  <span class="empty-tag">Nessun operatore assegnato</span>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- MODALE CREAZIONE / MODIFICA -->
  {#if showModal}
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{editingId ? '✏️ Modifica Squadra' : '👥 Nuova Squadra di Lavoro'}</h2>
          <button type="button" class="btn-close" onclick={() => showModal = false}>✕</button>
        </div>

        <form onsubmit={handleSaveTeam}>
          <div class="modal-body">
            <div class="form-group">
              <label for="tName">Nome Squadra *</label>
              <input type="text" id="tName" bind:value={teamName} placeholder="es. Squadra Alpha (Impiantisti)" required />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="tLeader">Caposquadra</label>
                <select id="tLeader" bind:value={leaderUid}>
                  <option value="">-- Seleziona Caposquadra --</option>
                  {#each users as u}
                    <option value={u.id}>{u.name}</option>
                  {/each}
                </select>
              </div>

              <div class="form-group">
                <label for="tVehicle">Mezzo (Default)</label>
                <select id="tVehicle" bind:value={defaultVehicleId}>
                  <option value="">-- Nessun Mezzo --</option>
                  {#each vehicles as v}
                    <option value={v.id}>{v.name} ({v.plate || 'No Targa'})</option>
                  {/each}
                </select>
              </div>

              <div class="form-group">
                <label for="tColor">Colore Identificativo</label>
                <input type="color" id="tColor" bind:value={teamColor} style="height: 40px; border: none; width: 100%;" />
              </div>
            </div>

            <div class="form-group">
              <span class="section-label">👷 Operatori della Squadra</span>
              <div class="checkbox-grid">
                {#each users as u}
                  <label class="checkbox-pill">
                    <input 
                      type="checkbox" 
                      checked={selectedMemberUids.includes(u.id)} 
                      onchange={() => toggleMember(u.id)} 
                    />
                    <span>{u.name}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick={() => showModal = false}>Annulla</button>
            <button type="submit" class="btn btn-primary" disabled={saving}>
              {saving ? 'Salvataggio...' : (editingId ? 'Aggiorna Squadra' : 'Crea Squadra')}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .teams-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-link { color: #64748b; text-decoration: none; font-size: 0.88rem; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0.2rem 0 0 0; }
  .page-subtitle { color: #64748b; font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .header-actions { display: flex; gap: 0.8rem; }

  .module-nav-bar {
    display: flex;
    gap: 0.5rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 0.4rem;
    border-radius: 12px;
    overflow-x: auto;
  }

  .nav-tab {
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    color: #64748b;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .nav-tab.active {
    background: #eff6ff;
    color: #2563eb;
  }

  .nav-tab.tab-settings {
    margin-left: auto;
    color: #64748b;
  }

  .filter-card { background: white; border: 1px solid #e2e8f0; padding: 0.8rem; border-radius: 12px; }
  .search-input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; }

  .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.2rem; }
  .team-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
  .team-card-header { display: flex; justify-content: space-between; align-items: center; }
  .team-card-header h3 { margin: 0; font-size: 1.1rem; color: #0f172a; }

  .info-row { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.88rem; margin-bottom: 0.4rem; }
  .info-label { font-size: 0.78rem; color: #64748b; font-weight: 600; }

  .members-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.2rem; }
  .member-tag { font-size: 0.78rem; background: #eff6ff; color: #1d4ed8; padding: 0.2rem 0.5rem; border-radius: 6px; }
  .empty-tag { font-size: 0.78rem; color: #94a3b8; font-style: italic; }

  .btn { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
  .btn-icon { background: none; border: none; cursor: pointer; }
  .btn-icon-danger { background: none; border: none; cursor: pointer; }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal-card { background: white; border-radius: 12px; max-width: 550px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; }

  .modal-body { display: flex; flex-direction: column; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label, .section-label { font-size: 0.88rem; font-weight: 600; color: #334155; }
  .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.8rem; }

  input, select { padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; }

  .checkbox-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .checkbox-pill { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.7rem; border: 1px solid #cbd5e1; border-radius: 20px; background: #f8fafc; cursor: pointer; font-size: 0.82rem; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.8rem; margin-top: 1rem; }
  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0; }
  .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
</style>
