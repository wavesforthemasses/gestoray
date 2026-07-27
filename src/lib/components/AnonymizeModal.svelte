<script lang="ts">
  import { ShieldAlert, UserX, Check, AlertTriangle, X } from '@lucide/svelte';
  import { AnonymizationService, type FieldAnonymizationSpec } from '$lib/services/anonymizationService';

  interface Props {
    isOpen: boolean;
    entityName: string; // es. "Utente", "Contatto"
    originalDoc: Record<string, any> | null;
    specs: FieldAnonymizationSpec[];
    onClose: () => void;
    onConfirm: () => Promise<void>;
  }

  let { isOpen, entityName, originalDoc, specs, onClose, onConfirm }: Props = $props();

  let submitting = $state(false);
  let confirmText = $state('');
  
  // Ricalcola il documento anonimizzato in tempo reale (solo in memory)
  let anonymizedDoc = $derived(
    originalDoc ? AnonymizationService.applyAnonymization(originalDoc, specs, originalDoc.id || originalDoc.uid) : null
  );

  function getNestedValue(obj: any, path: string) {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  async function handleConfirm() {
    if (confirmText !== 'ANONIMIZZA') return;
    submitting = true;
    try {
      await onConfirm();
      onClose();
    } finally {
      submitting = false;
      confirmText = '';
    }
  }
</script>

{#if isOpen && originalDoc}
  <div class="modal-backdrop" onclick={onClose}>
    <div class="modal-card animate-scale-in" onclick={e => e.stopPropagation()}>
      <div class="modal-header header-danger">
        <h3>
          <UserX size={22} color="var(--color-red-600)" />
          Anonimizza {entityName}
        </h3>
        <button class="btn-close" onclick={onClose} disabled={submitting}>
          <X size={20} />
        </button>
      </div>

      <div class="modal-body">
        <div class="alert-box danger-bg">
          <ShieldAlert size={20} class="alert-icon" />
          <div class="alert-content">
            <strong>Azione Irreversibile (GDPR - Diritto all'oblio)</strong>
            <p>Questa operazione rimuoverà in modo permanente i dati personali identificativi di questo {entityName.toLowerCase()}, mantenendo solo le chiavi strutturali per non invalidare lo storico ed i report passati. L'azione non può essere annullata.</p>
          </div>
        </div>

        <div class="preview-section">
          <h4>Anteprima Modifiche</h4>
          <table class="preview-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Valore Attuale</th>
                <th>Dopo Anonimizzazione</th>
              </tr>
            </thead>
            <tbody>
              {#each specs as spec}
                {@const oldVal = getNestedValue(originalDoc, spec.fieldPath)}
                {@const newVal = getNestedValue(anonymizedDoc, spec.fieldPath)}
                <tr>
                  <td class="field-name">{spec.fieldPath.replace('original.', '')}</td>
                  <td class="old-value" class:empty={!oldVal && oldVal !== 0 && typeof oldVal !== 'boolean'}>
                    {oldVal !== undefined && oldVal !== null && oldVal !== '' ? String(oldVal) : 'N.D.'}
                  </td>
                  <td class="new-value">
                    {#if spec.strategy === 'PRESERVE'}
                      <span class="badge badge-neutral">Preservato</span>
                    {:else if spec.strategy === 'CLEAR'}
                      <span class="badge badge-neutral">Svuotato</span>
                    {:else}
                      <span class="highlight">{String(newVal)}</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="confirm-section">
          <label for="confirm-text">Digita <strong>ANONIMIZZA</strong> per confermare:</label>
          <input 
            type="text" 
            id="confirm-text" 
            bind:value={confirmText} 
            placeholder="Scrivi ANONIMIZZA"
            class="input-danger"
            disabled={submitting}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick={onClose} disabled={submitting}>
          Annulla
        </button>
        <button 
          type="button" 
          class="btn-danger" 
          disabled={submitting || confirmText !== 'ANONIMIZZA'} 
          onclick={handleConfirm}
        >
          {#if submitting}
            Attendere...
          {:else}
            <UserX size={16} /> Conferma ed Anonimizza
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; backdrop-filter: blur(2px); }
  .modal-card { background: white; border-radius: var(--radius-lg); width: 100%; max-width: 650px; display: flex; flex-direction: column; max-height: 90vh; box-shadow: var(--shadow-xl); overflow: hidden; }
  .header-danger { border-bottom: 1px solid var(--color-error-border); background: var(--color-error-light); }
  .header-danger h3 { color: var(--color-error-text); }
  
  .modal-header { padding: 1.2rem 1.5rem; display: flex; justify-content: space-between; align-items: center; }
  .modal-header h3 { margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 0.6rem; font-weight: 700; }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--color-neutral-500); padding: 0.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .btn-close:hover { background: var(--color-neutral-200); color: var(--color-neutral-800); }
  
  .modal-body { padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.5rem; }
  
  .alert-box { display: flex; gap: 1rem; padding: 1rem; border-radius: var(--radius-md); border: 1px solid transparent; }
  .danger-bg { background: var(--color-red-50); border-color: var(--color-red-200); color: var(--color-red-800); }
  .alert-icon { flex-shrink: 0; margin-top: 2px; }
  .alert-content p { margin: 0.4rem 0 0 0; font-size: 0.9rem; line-height: 1.4; opacity: 0.9; }
  
  .preview-section h4 { margin: 0 0 0.8rem 0; font-size: 1rem; color: var(--color-neutral-800); }
  
  .preview-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); overflow: hidden; }
  .preview-table th, .preview-table td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .preview-table th { background: var(--color-neutral-50); font-weight: 600; color: var(--color-neutral-600); }
  .preview-table tr:last-child td { border-bottom: none; }
  .field-name { font-weight: 600; color: var(--color-neutral-700); }
  .old-value { color: var(--color-neutral-500); text-decoration: line-through; }
  .old-value.empty { text-decoration: none; font-style: italic; opacity: 0.6; }
  .new-value { font-weight: 500; color: var(--color-green-700); }
  
  .highlight { background: var(--color-green-50); padding: 0.1rem 0.3rem; border-radius: 4px; border: 1px solid var(--color-green-200); }
  
  .confirm-section { display: flex; flex-direction: column; gap: 0.5rem; }
  .confirm-section label { font-size: 0.9rem; color: var(--color-neutral-700); }
  .input-danger { padding: 0.6rem 0.8rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.95rem; font-family: monospace; }
  .input-danger:focus { border-color: var(--color-error); outline: none; box-shadow: 0 0 0 3px var(--color-error-light); }
  
  .modal-footer { padding: 1rem 1.5rem; background: var(--color-neutral-50); border-top: 1px solid var(--color-neutral-200); display: flex; justify-content: flex-end; gap: 1rem; }
  
  .btn-secondary { padding: 0.6rem 1.2rem; background: white; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-weight: 600; cursor: pointer; color: var(--color-neutral-700); }
  .btn-secondary:hover { background: var(--color-neutral-100); }
  .btn-danger { padding: 0.6rem 1.2rem; background: var(--color-error); border: none; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; gap: 6px; }
  .btn-danger:hover:not(:disabled) { background: hsl(346, 84%, 40%); }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
