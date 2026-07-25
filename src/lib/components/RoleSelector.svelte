<script lang="ts">
  interface RoleItem {
    value: string;
    label: string;
    desc?: string;
  }

  interface Props {
    selectedRoles: string[];
    disabled?: boolean;
    label?: string;
    showDescriptions?: boolean;
  }

  let {
    selectedRoles = $bindable([]),
    disabled = false,
    label = 'Ruoli Abilitati',
    showDescriptions = true,
    customRolesList = []
  }: Props & { customRolesList?: RoleItem[] } = $props();

  import { onMount } from 'svelte';
  import { rolesStore, initRolesStore, type RoleConfig } from '$lib/services/roles.service';

  let firestoreRoles = $derived(
    $rolesStore.map(r => ({
      value: r.id,
      label: r.label,
      desc: r.description
    }))
  );

  onMount(() => {
    initRolesStore();
  });

  const defaultRoles: RoleItem[] = [
    { value: 'superadmin', label: 'Superadmin', desc: 'Accesso completo e gestione utenti' },
    { value: 'amministrazione', label: 'Amministrazione', desc: 'Visualizzazione e operatività contabile' },
    { value: 'commerciale', label: 'Commerciale', desc: 'Visualizzazione vendite e provvigioni' },
    { value: 'direzione', label: 'Direzione', desc: 'Visualizzazione reportistica e KPI di vertice' }
  ];

  let combinedRoles = $derived([
    ...defaultRoles,
    ...firestoreRoles.filter(fr => !defaultRoles.some(dr => dr.value === fr.value)),
    ...customRolesList.filter(cr => !defaultRoles.some(dr => dr.value === cr.value) && !firestoreRoles.some(fr => fr.value === cr.value)),
    ...selectedRoles
      .filter(r => !defaultRoles.some(dr => dr.value === r) && !firestoreRoles.some(fr => fr.value === r) && !customRolesList.some(cr => cr.value === r))
      .map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1), desc: 'Ruolo personalizzato' }))
  ]);

  let newRoleInput = $state('');

  function handleToggle(value: string) {
    if (selectedRoles.includes(value)) {
      selectedRoles = selectedRoles.filter(r => r !== value);
    } else {
      selectedRoles = [...selectedRoles, value];
    }
  }

  function handleAddCustomRole() {
    const trimmed = newRoleInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    if (!selectedRoles.includes(trimmed)) {
      selectedRoles = [...selectedRoles, trimmed];
    }
    newRoleInput = '';
  }
</script>

<div class="form-group">
  <span class="field-label">{label}</span>
  <div class="checkbox-group">
    {#each combinedRoles as role}
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={selectedRoles.includes(role.value)}
          onchange={() => handleToggle(role.value)}
          {disabled}
        />
        {#if showDescriptions && role.desc}
          {role.label} ({role.desc})
        {:else}
          {role.label}
        {/if}
      </label>
    {/each}

    {#if !disabled}
      <div class="add-custom-role-row">
        <input
          type="text"
          placeholder="Nuovo ruolo (es. operaio, tecnico...)"
          bind:value={newRoleInput}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomRole(); } }}
          class="custom-role-input"
        />
        <button type="button" class="btn-add-role" onclick={handleAddCustomRole} disabled={!newRoleInput.trim()}>
          + Aggiungi Ruolo
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--color-neutral-100);
    padding: 16px 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    cursor: pointer;
    color: var(--color-neutral-600);
  }

  .checkbox-label input {
    cursor: pointer;
  }

  .add-custom-role-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--color-neutral-300);
  }

  .custom-role-input {
    flex: 1;
    padding: 6px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    background: var(--color-neutral-0);
  }

  .btn-add-role {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary-600);
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-add-role:hover:not(:disabled) {
    background: var(--color-primary-100);
  }

  .btn-add-role:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
