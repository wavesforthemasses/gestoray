<script lang="ts">
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';

  interface Props {
    fields: CustomFieldDefinition[];
    values: CustomFieldValues;
    readonly?: boolean;
  }

  let { fields = [], values = $bindable({}), readonly = false }: Props = $props();

  let activeFields = $derived(
    fields.filter(f => f.active).sort((a, b) => (a.order || 0) - (b.order || 0))
  );
</script>

{#if activeFields.length > 0}
  <div class="custom-fields-grid">
    {#each activeFields as field (field.id)}
      <div class="form-group custom-field-item">
        <label for="cf-{field.key}">
          {field.label}
          {#if field.required && !readonly}<span class="required-asterisk">*</span>{/if}
        </label>

        {#if readonly}
          <div class="readonly-value">
            {#if field.type === 'boolean'}
              <span>{values[field.key] ? '✅ Sì' : '❌ No'}</span>
            {:else if field.type === 'select'}
              <span>{field.options?.find(o => o.value === values[field.key])?.label || values[field.key] || '-'}</span>
            {:else}
              <span>{values[field.key] !== undefined && values[field.key] !== '' ? values[field.key] : '-'}</span>
            {/if}
          </div>
        {:else}
          {#if field.type === 'text'}
            <input 
              id="cf-{field.key}"
              type="text" 
              bind:value={values[field.key]} 
              placeholder={field.placeholder || ''} 
              required={field.required}
              class="form-control"
            />
          {:else if field.type === 'number'}
            <input 
              id="cf-{field.key}"
              type="number" 
              bind:value={values[field.key]} 
              placeholder={field.placeholder || ''} 
              required={field.required}
              class="form-control"
            />
          {:else if field.type === 'date'}
            <input 
              id="cf-{field.key}"
              type="date" 
              bind:value={values[field.key]} 
              required={field.required}
              class="form-control"
            />
          {:else if field.type === 'select'}
            <select id="cf-{field.key}" bind:value={values[field.key]} required={field.required} class="form-control">
              <option value="">-- Seleziona --</option>
              {#each field.options || [] as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          {:else if field.type === 'boolean'}
            <label class="checkbox-label">
              <input 
                id="cf-{field.key}"
                type="checkbox" 
                bind:checked={values[field.key]} 
              />
              <span>{field.placeholder || field.label}</span>
            </label>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .custom-fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 12px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .required-asterisk {
    color: var(--color-error);
    margin-left: 2px;
  }
  .form-control {
    padding: 9px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    box-sizing: border-box;
  }
  .form-control:focus {
    border-color: var(--color-primary-500);
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 400 !important;
  }
  .readonly-value {
    padding: 8px 12px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 13px;
    color: var(--color-neutral-800);
  }
</style>
