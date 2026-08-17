<script lang="ts">
  import { onMount } from 'svelte';
  import { menuConfigStore } from '$lib/stores/menu';
  import { UsersService } from '../../routes/dashboard/users/users.service';
  import type { AssignedEntityRef, EntityType } from '$lib/types/assignments';
  import { toast } from '$lib/stores/toast.svelte';
  import { User, Users, Truck, Plus, Trash2, Shield, Tag, UserPlus, RefreshCw, Layers } from '@lucide/svelte';

  let {
    assignedEntities = $bindable([]),
    allowedTypes = ['user', 'team', 'vehicle'],
    disabled = false
  }: {
    assignedEntities: AssignedEntityRef[];
    allowedTypes?: EntityType[];
    disabled?: boolean;
  } = $props();

  interface OptionItem {
    id: string;
    name: string;
    type: EntityType;
  }

  let selectedType = $state<EntityType>('user');
  let selectedEntityId = $state<string>('');
  let roleLabel = $state<string>('');
  let autoExpandTeam = $state<boolean>(false);
  let expandingTeamId = $state<string | null>(null);

  let userOptions = $state<OptionItem[]>([]);
  let teamOptions = $state<OptionItem[]>([]);
  let vehicleOptions = $state<OptionItem[]>([]);

  let currentTypeOptions = $derived.by(() => {
    if (selectedType === 'user') return userOptions;
    if (selectedType === 'team') return teamOptions;
    if (selectedType === 'vehicle') return vehicleOptions;
    return [];
  });

  let hasTeamsModule = $derived($menuConfigStore.some(m => m.id === 'teams'));
  let hasVehiclesModule = $derived($menuConfigStore.some(m => m.id === 'vehicles'));

  onMount(async () => {
    // Set default selectedType based on allowedTypes
    if (allowedTypes.length > 0 && !allowedTypes.includes(selectedType)) {
      selectedType = allowedTypes[0];
    }

    try {
      // 1. Fetch Users
      if (allowedTypes.includes('user')) {
        const usersSnap = await UsersService.getUsers();
        userOptions = usersSnap.map((u: any) => ({
          id: u.id,
          name: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Utente',
          type: 'user' as EntityType
        })).sort((a, b) => a.name.localeCompare(b.name));
      }

      // 2. Fetch Teams dynamically if module is active
      if (allowedTypes.includes('team') && $menuConfigStore.some(m => m.id === 'teams')) {
        try {
          const servicePath = '../../routes/dashboard/teams/teams.service';
          // @ts-ignore
          const mod = await import(/* @vite-ignore */ servicePath);
          if (mod?.TeamsService) {
            const teamsList = await mod.TeamsService.getTeams();
            teamOptions = teamsList.map((t: any) => ({
              id: t.id,
              name: `${t.code} - ${t.name}`,
              type: 'team' as EntityType
            }));
          }
        } catch (e) {
          console.warn('Teams module service load skipped:', e);
        }
      }

      // 3. Fetch Vehicles dynamically if module is active
      if (allowedTypes.includes('vehicle') && $menuConfigStore.some(m => m.id === 'vehicles')) {
        try {
          const servicePath = '../../routes/dashboard/vehicles/vehicles.service';
          // @ts-ignore
          const mod = await import(/* @vite-ignore */ servicePath);
          if (mod?.VehiclesService) {
            const vList = await mod.VehiclesService.getVehicles();
            vehicleOptions = vList.map((v: any) => ({
              id: v.id,
              name: `${v.code} - ${v.name} (${v.licensePlate || 'N/D'})`,
              type: 'vehicle' as EntityType
            }));
          }
        } catch (e) {
          console.warn('Vehicles module service load skipped:', e);
        }
      }
    } catch (err) {
      console.error('Error loading entity options for EntityAssigner:', err);
    }
  });

  async function expandTeamAssignment(teamId: string, replaceTeamChip: boolean = false) {
    if (disabled) return;
    expandingTeamId = teamId;
    try {
      const servicePath = '../../routes/dashboard/teams/teams.service';
      // @ts-ignore
      const mod = await import(/* @vite-ignore */ servicePath);
      if (!mod || !mod.TeamsService) {
        toast.error('Modulo Squadre non attivo o non trovata la configurazione.');
        return;
      }

      const team = await mod.TeamsService.getTeamById(teamId);
      if (!team) {
        toast.error('Impossibile trovare i dati della squadra selezionata');
        return;
      }

      let newAssignments = [...assignedEntities];
      let addedUsersCount = 0;
      let addedVehiclesCount = 0;

      // 1. Denormalize Team Members (Users)
      if (team.members && Array.isArray(team.members)) {
        for (const m of team.members) {
          if (m.userId) {
            const exists = newAssignments.some(a => a.entityType === 'user' && a.entityId === m.userId);
            if (!exists) {
              newAssignments.push({
                entityType: 'user',
                entityId: m.userId,
                entityName: m.userName || 'Operatore',
                roleLabel: m.roleInTeam || (m.isLeader ? 'Caposquadra' : `Membro ${team.name}`)
              });
              addedUsersCount++;
            }
          }
        }
      }

      // 2. Denormalize Team Vehicle (Mezzo)
      if (team.vehicleId) {
        const exists = newAssignments.some(a => a.entityType === 'vehicle' && a.entityId === team.vehicleId);
        if (!exists) {
          newAssignments.push({
            entityType: 'vehicle',
            entityId: team.vehicleId,
            entityName: team.vehicleName || 'Mezzo Squadra',
            roleLabel: `Mezzo ${team.name}`
          });
          addedVehiclesCount++;
        }
      }

      if (replaceTeamChip) {
        newAssignments = newAssignments.filter(a => !(a.entityType === 'team' && a.entityId === teamId));
      }

      assignedEntities = newAssignments;
      toast.success(`Squadra denormalizzata: +${addedUsersCount} operatori e +${addedVehiclesCount} mezzi.`);
    } catch (err) {
      console.error('Errore espansione squadra:', err);
      toast.error('Impossibile denormalizzare i componenti della squadra');
    } finally {
      expandingTeamId = null;
    }
  }

  function addAssignment() {
    if (disabled) return;
    if (!selectedEntityId) {
      toast.error('Seleziona un elemento da assegnare');
      return;
    }

    const found = currentTypeOptions.find(o => o.id === selectedEntityId);
    if (!found) return;

    const alreadyExists = assignedEntities.some(
      a => a.entityType === selectedType && a.entityId === selectedEntityId
    );

    if (alreadyExists) {
      toast.error('Questo elemento è già stato assegnato');
      return;
    }

    assignedEntities = [
      ...assignedEntities,
      {
        entityType: selectedType,
        entityId: found.id,
        entityName: found.name,
        roleLabel: roleLabel.trim() || undefined
      }
    ];

    const addedTeamId = found.id;
    selectedEntityId = '';
    roleLabel = '';
    toast.success('Assegnazione aggiunta');

    if (selectedType === 'team' && autoExpandTeam) {
      expandTeamAssignment(addedTeamId, false);
    }
  }

  function removeAssignment(index: number) {
    if (disabled) return;
    assignedEntities = assignedEntities.filter((_, i) => i !== index);
  }

  function getTypeBadge(type: EntityType) {
    switch (type) {
      case 'user': return { label: 'Persona', color: 'var(--color-primary-600)', bg: 'var(--color-primary-50)', Icon: User };
      case 'team': return { label: 'Squadra', color: '#059669', bg: '#ECFDF5', Icon: Users };
      case 'vehicle': return { label: 'Mezzo', color: '#D97706', bg: '#FFFBEB', Icon: Truck };
      default: return { label: type, color: 'var(--color-neutral-600)', bg: 'var(--color-neutral-100)', Icon: Tag };
    }
  }
</script>

<div class="entity-assigner-container">
  {#if !disabled}
    <div class="assigner-form-box">
      <div class="form-group flex-1">
        <label for="entityTypeSelect">Tipo Assegnazione</label>
        <select id="entityTypeSelect" bind:value={selectedType} class="form-control">
          {#if allowedTypes.includes('user')}
            <option value="user">Persona / Operatore</option>
          {/if}
          {#if allowedTypes.includes('team') && hasTeamsModule}
            <option value="team">Squadra / Team</option>
          {/if}
          {#if allowedTypes.includes('vehicle') && hasVehiclesModule}
            <option value="vehicle">Mezzo / Attrezzatura</option>
          {/if}
        </select>
      </div>

      <div class="form-group flex-2">
        <label for="entitySelect">Seleziona Risorsa *</label>
        <select id="entitySelect" bind:value={selectedEntityId} class="form-control">
          <option value="">-- Seleziona --</option>
          {#each currentTypeOptions as opt (opt.id)}
            <option value={opt.id}>{opt.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group flex-1">
        <label for="roleInput">Ruolo / Note (Opzionale)</label>
        <input 
          id="roleInput" 
          type="text" 
          bind:value={roleLabel} 
          placeholder="es. Caposquadra, Autista" 
          class="form-control" 
        />
      </div>

      <button type="button" class="btn-add" onclick={addAssignment} {disabled}>
        <Plus size={16} />
        <span>Assegna</span>
      </button>
    </div>

    {#if selectedType === 'team'}
      <div class="team-expand-toggle">
        <label class="toggle-label">
          <input type="checkbox" bind:checked={autoExpandTeam} />
          <span>Includi automaticamente persone e mezzi di questa squadra all'assegnazione</span>
        </label>
      </div>
    {/if}
  {/if}

  <!-- LIST OF ASSIGNED ENTITIES -->
  {#if assignedEntities.length === 0}
    <div class="empty-assignments">
      <Tag size={24} color="var(--color-neutral-400)" />
      <span>Nessuna persona, squadra o mezzo ancora assegnato.</span>
    </div>
  {:else}
    <div class="assignments-tags-grid">
      {#each assignedEntities as entity, idx (entity.entityType + '_' + entity.entityId + '_' + idx)}
        {@const badge = getTypeBadge(entity.entityType)}
        {@const IconComp = badge.Icon}
        <div class="assignment-chip" style="background: {badge.bg}; border-color: {badge.color}22;">
          <div class="chip-icon" style="color: {badge.color};">
            <IconComp size={16} />
          </div>
          <div class="chip-content">
            <span class="chip-title">{entity.entityName}</span>
            <div class="chip-meta">
              <span class="chip-type" style="color: {badge.color};">{badge.label}</span>
              {#if entity.roleLabel}
                <span class="chip-role">• {entity.roleLabel}</span>
              {/if}
            </div>
          </div>

          {#if !disabled}
            <div class="chip-actions">
              {#if entity.entityType === 'team'}
                <button
                  type="button"
                  class="btn-chip-action btn-expand"
                  onclick={() => expandTeamAssignment(entity.entityId, false)}
                  disabled={expandingTeamId === entity.entityId}
                  title="Denormalizza: Aggiungi singoli operatori e mezzi della squadra alla lista"
                >
                  <UserPlus size={13} />
                  <span>{expandingTeamId === entity.entityId ? 'Espansione...' : 'Aggiungi componenti'}</span>
                </button>
                <button
                  type="button"
                  class="btn-chip-action btn-replace"
                  onclick={() => expandTeamAssignment(entity.entityId, true)}
                  disabled={expandingTeamId === entity.entityId}
                  title="Sostituisci il tag squadra con i singoli operatori e mezzi"
                >
                  <RefreshCw size={13} />
                  <span>Sostituisci</span>
                </button>
              {/if}

              <button 
                type="button" 
                class="btn-remove-chip" 
                onclick={() => removeAssignment(idx)} 
                title="Rimuovi assegnazione"
              >
                <Trash2 size={14} />
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .entity-assigner-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }
  .assigner-form-box {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    background: var(--color-neutral-50, #F9FAFB);
    padding: 14px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-200, #E5E7EB);
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600, #4B5563);
  }
  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }
  .form-control {
    padding: 9px 12px;
    border: 1px solid var(--color-neutral-300, #D1D5DB);
    border-radius: var(--radius-md, 6px);
    font-size: 14px;
    background: white;
  }
  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    background: var(--color-primary-600, #4F46E5);
    color: white;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-add:hover {
    background: var(--color-primary-700, #4338CA);
  }
  .empty-assignments {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px;
    background: var(--color-neutral-50, #F9FAFB);
    border: 1px dashed var(--color-neutral-300, #D1D5DB);
    border-radius: var(--radius-md, 8px);
    color: var(--color-neutral-500, #6B7280);
    font-size: 13px;
  }
  .assignments-tags-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .assignment-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
  }
  .chip-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .chip-content {
    display: flex;
    flex-direction: column;
  }
  .chip-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-900, #111827);
  }
  .chip-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
  }
  .chip-type {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 10px;
  }
  .chip-role {
    color: var(--color-neutral-600, #4B5563);
    font-weight: 500;
  }
  .team-expand-toggle {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    background: #ECFDF5;
    border: 1px solid #A7F3D0;
    border-radius: var(--radius-md, 6px);
    margin-top: -6px;
  }
  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #065F46;
    cursor: pointer;
  }
  .chip-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 6px;
  }
  .btn-chip-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    background: white;
  }
  .btn-expand {
    color: #047857;
    border-color: #A7F3D0;
  }
  .btn-expand:hover {
    background: #D1FAE5;
  }
  .btn-replace {
    color: #B45309;
    border-color: #FDE68A;
  }
  .btn-replace:hover {
    background: #FEF3C7;
  }
  .btn-remove-chip {
    background: none;
    border: none;
    color: var(--color-error, #EF4444);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .btn-remove-chip:hover {
    background: rgba(239, 68, 68, 0.1);
  }
</style>
