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
    showDescriptions = true
  }: Props = $props();

  const rolesList: RoleItem[] = [
    { value: 'superadmin', label: 'Superadmin', desc: 'Accesso completo e gestione utenti' },
    { value: 'amministrazione', label: 'Amministrazione', desc: 'Visualizzazione homepage amministrazione' },
    { value: 'commerciale', label: 'Commerciale', desc: 'Visualizzazione homepage commerciale' },
    { value: 'direzione', label: 'Direzione', desc: 'Visualizzazione homepage direzione' }
  ];

  function handleToggle(value: string) {
    if (selectedRoles.includes(value)) {
      selectedRoles = selectedRoles.filter(r => r !== value);
    } else {
      selectedRoles = [...selectedRoles, value];
    }
  }
</script>

<div class="form-group">
  <span class="field-label">{label}</span>
  <div class="checkbox-group">
    {#each rolesList as role}
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
</style>
