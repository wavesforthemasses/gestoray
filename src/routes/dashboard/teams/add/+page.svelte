<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { menuConfigStore } from '$lib/stores/menu';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { TeamsService } from '../teams.service';
  import { UsersService } from '../../users/users.service';
  import { TeamSettingsService } from '../teamSettingsService';
  import type { TeamSettings, TeamStatus, TeamMember } from '../schema';
  import { pageTitle } from '$lib/stores/page';
  import { Card, Button, Autocomplete, type AutocompleteOption } from '$lib';
  import { toast } from '$lib/stores/toast.svelte';
  import { Users, List, Save, Plus, Trash2, UserCheck, Shield, Truck } from '@lucide/svelte';

  interface SystemUser {
    id: string;
    name: string;
    email?: string;
  }

  interface VehicleOption {
    id: string;
    name: string;
  }

  let settings = $state<TeamSettings>({
    entityNaming: 'squadra',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'SQD-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva'
  });

  let availableUsers = $state<SystemUser[]>([]);
  let availableVehicles = $state<VehicleOption[]>([]);
  let hasVehiclesModule = $derived($menuConfigStore.some(m => m.id === 'vehicles'));

  let name = $state('');
  let vehicleId = $state('');
  let vehicleName = $state('');
  let members = $state<TeamMember[]>([]);
  let status = $state<TeamStatus>('attiva');
  let notes = $state('');
  let saving = $state(false);

  // Temporary state for adding a member
  let selectedUserId = $state('');
  let memberRoleInTeam = $state('Operatore');

  let labels = $derived(TeamSettingsService.getLabels(settings));

  let vehicleOptions = $derived<AutocompleteOption[]>([
    { id: '', label: '-- Nessun Mezzo Assegnato --' },
    ...availableVehicles.map(v => ({ id: v.id, label: v.name }))
  ]);

  let userOptions = $derived<AutocompleteOption[]>([
    { id: '', label: '-- Seleziona Operatore --' },
    ...availableUsers.map(u => ({ id: u.id, label: u.name, sublabel: u.email }))
  ]);

  onMount(async () => {
    try {
      const [s, rawUsers] = await Promise.all([
        TeamSettingsService.getSettings(),
        UsersService.getUsers()
      ]);
      settings = s;
      status = settings.defaultStatus || 'attiva';
      pageTitle.set(`Nuova ${labels.singular}`);

      availableUsers = (rawUsers || []).map(u => {
        const nome = u.nome || '';
        const cognome = u.cognome || '';
        const email = u.email || '';
        const fullName = `${nome} ${cognome}`.trim() || email || u.uid;

        return {
          id: u.uid,
          name: fullName,
          email
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      // Dynamic vehicle loading if vehicles module is active
      if ($menuConfigStore.some(m => m.id === 'vehicles')) {
        try {
          const { VehiclesService } = await import('../../vehicles/vehicles.service');
          const vList = await VehiclesService.getVehicles();
          availableVehicles = vList.map((v: any) => ({ id: v.id, name: `${v.code} - ${v.name} (${v.licensePlate || 'N/D'})` }));
        } catch (e) {
          console.warn('Modulo vehicles non ancora disponibile:', e);
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati per squadra:', e);
    }
  });

  function handleVehicleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selectedId = target.value;
    vehicleId = selectedId;
    const found = availableVehicles.find(v => v.id === selectedId);
    vehicleName = found ? found.name : '';
  }

  function addMember() {
    if (!selectedUserId) {
      toast.error('Seleziona un operatore da aggiungere');
      return;
    }
    const found = availableUsers.find(u => u.id === selectedUserId);
    if (!found) return;

    if (members.some(m => m.userId === selectedUserId)) {
      toast.error('Operatore già presente nella squadra');
      return;
    }

    const isFirstMember = members.length === 0;

    members = [
      ...members,
      {
        userId: found.id,
        userName: found.name,
        roleInTeam: memberRoleInTeam.trim() || 'Operatore',
        isLeader: isFirstMember
      }
    ];

    selectedUserId = '';
    memberRoleInTeam = 'Operatore';
    toast.success('Membro aggiunto alla squadra');
  }

  function setLeader(userId: string) {
    members = members.map(m => ({
      ...m,
      isLeader: m.userId === userId
    }));
  }

  function removeMember(userId: string) {
    const wasLeader = members.find(m => m.userId === userId)?.isLeader;
    members = members.filter(m => m.userId !== userId);
    
    if (wasLeader && members.length > 0) {
      members[0].isLeader = true;
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(`Inserisci il nome della ${labels.singular.toLowerCase()}`);
      return;
    }

    const leaderMember = members.find(m => m.isLeader);

    saving = true;
    try {
      await TeamsService.createTeam({
        name,
        leaderId: leaderMember?.userId || '',
        leaderName: leaderMember?.userName || '',
        vehicleId,
        vehicleName,
        members,
        status,
        notes
      });
      toast.success(`${labels.singular} creata con successo!`);
      goto('/dashboard/teams');
    } catch (e) {
      console.error('Errore salvataggio squadra:', e);
      toast.error('Errore durante il salvataggio');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuova {labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-team-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/teams" class="btn-module-list" title="Vai all'elenco {labels.plural}" aria-label="Vai all'elenco {labels.plural}">
        <List size={20} />
      </a>
      <div class="header-icon">
        <Users size={24} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.newBtn}</h1>
        <p class="page-main-subtitle">Inserisci i dati, assegna il mezzo ed i membri della squadra di lavoro.</p>
      </div>
    </div>
  </header>

  <form onsubmit={handleSubmit}>
    <div class="form-layout">
      <Card class="form-card">
        <h2 class="section-title">Dati Principali {labels.singular}</h2>

        <div class="form-grid">
          <div class="form-group span-2">
            <label for="name">Nome Squadra / Team *</label>
            <input 
              id="name" 
              type="text" 
              bind:value={name} 
              placeholder="es. Squadra Alpha - Impianti Elettrici" 
              required 
              class="form-control"
            />
          </div>

          {#if hasVehiclesModule}
            <div class="form-group">
              <label for="vehicle">Mezzo / Furgone Assegnato</label>
              <Autocomplete 
                options={vehicleOptions} 
                value={vehicleId} 
                onchange={(selectedId) => {
                  vehicleId = selectedId;
                  const v = availableVehicles.find(x => x.id === selectedId);
                  vehicleName = v ? v.name : '';
                }} 
                placeholder="Seleziona mezzo..." 
              />
            </div>
          {/if}

          <div class="form-group">
            <label for="status">Stato Operativo</label>
            <select id="status" bind:value={status} class="form-control">
              <option value="attiva">Attiva</option>
              <option value="in_servizio">In Servizio</option>
              <option value="inattiva">Inattiva</option>
            </select>
          </div>

          <div class="form-group span-2">
            <label for="notes">Note & Specializzazioni</label>
            <textarea 
              id="notes" 
              bind:value={notes} 
              rows="3" 
              placeholder="Competenze specifiche, certificazioni o note operative..." 
              class="form-control"
            ></textarea>
          </div>
        </div>
      </Card>

      <Card class="form-card">
        <h2 class="section-title">Composizione Membri Team ({members.length})</h2>
        <p class="section-desc">Seleziona e aggiungi gli operatori al team. Spunta chi tra loro copre il ruolo di **Caposquadra**.</p>

        <div class="add-member-box">
          <div class="form-group flex-2">
            <label for="selectUser">Seleziona Operatore</label>
            <Autocomplete 
              options={userOptions} 
              bind:value={selectedUserId} 
              placeholder="Seleziona operatore..." 
            />
          </div>

          <div class="form-group flex-1">
            <label for="memberRole">Ruolo nel Team</label>
            <input 
              id="memberRole" 
              type="text" 
              bind:value={memberRoleInTeam} 
              placeholder="es. Tecnico" 
              class="form-control"
            />
          </div>

          <Button variant="secondary" type="button" onclick={addMember} class="btn-add-member">
            <Plus size={16} />
            <span>Aggiungi al Team</span>
          </Button>
        </div>

        {#if members.length === 0}
          <div class="empty-members">
            <Users size={32} color="var(--color-neutral-400)" />
            <p>Nessun membro ancora aggiunto a questa squadra.</p>
          </div>
        {:else}
          <table class="members-table">
            <thead>
              <tr>
                <th class="text-center">Caposquadra</th>
                <th>Operatore</th>
                <th>Ruolo nel Team</th>
                <th class="text-right">Azione</th>
              </tr>
            </thead>
            <tbody>
              {#each members as member (member.userId)}
                <tr class:is-leader-row={member.isLeader}>
                  <td class="text-center">
                    <label class="radio-leader-label" title="Contrassegna come Caposquadra">
                      <input 
                        type="radio" 
                        name="teamLeaderRadio" 
                        checked={member.isLeader} 
                        onchange={() => setLeader(member.userId)} 
                      />
                      {#if member.isLeader}
                        <Shield size={16} color="var(--color-primary-600)" class="leader-star" />
                      {/if}
                    </label>
                  </td>
                  <td class="font-semibold">
                    <div class="member-name-box">
                      <UserCheck size={16} color={member.isLeader ? "var(--color-primary-600)" : "var(--color-neutral-400)"} />
                      <span>{member.userName}</span>
                      {#if member.isLeader}
                        <span class="leader-tag">CAPOSQUADRA</span>
                      {/if}
                    </div>
                  </td>
                  <td><span class="role-badge">{member.roleInTeam || 'Operatore'}</span></td>
                  <td class="text-right">
                    <button type="button" class="btn-remove" onclick={() => removeMember(member.userId)} title="Rimuovi dal team">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        <div class="form-actions">
          <a href="/dashboard/teams" class="btn-cancel">Annulla</a>
          <Button variant="primary" type="submit" disabled={saving}>
            <Save size={18} />
            <span>{saving ? 'Salvataggio...' : `Salva ${labels.singular}`}</span>
          </Button>
        </div>
      </Card>
    </div>
  </form>
</div>

<style>
  .add-team-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .form-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px 0;
  }
  .section-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0 0 16px 0;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 8px 0;
  }
  .span-2 {
    grid-column: span 2;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .flex-2 { flex: 2; }
  .flex-1 { flex: 1; }
  .form-control {
    padding: 10px 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .add-member-box {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    background: var(--color-neutral-50);
    padding: 14px;
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }
  .empty-members {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }
  .members-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  .members-table th, .members-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-100);
  }
  .members-table th {
    font-size: 12px;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
  }
  .is-leader-row {
    background: var(--color-primary-50, #F5F3FF);
  }
  .radio-leader-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
  .member-name-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .leader-tag {
    font-size: 10px;
    font-weight: 700;
    background: var(--color-primary-600);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .role-badge {
    font-size: 12px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }
  .btn-remove {
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    padding: 4px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-100);
  }
  .btn-cancel {
    padding: 8px 16px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 14px;
  }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-semibold { font-weight: 600; }
</style>
