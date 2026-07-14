<script lang="ts">
  import { onMount } from 'svelte';
  import { db, doc, setDoc } from '$lib/firebase';
  import { activeRoleState } from '$lib/auth.svelte';
  import { hasAccess } from '$lib/utils/authCheck';
  import { goto } from '$app/navigation';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import Button from '$lib/components/Button.svelte';
  import { Save, ArrowLeft, ActivitySquare, Plus, Trash2, Edit2 } from 'lucide-svelte';
  import { activitiesConfigStore, type ActivityConfig } from '$lib/stores/activities';
  import { pageTitle } from '$lib/stores/page';
  import FormField from '$lib/components/FormField.svelte';

  pageTitle.set('Impostazioni KPI Attività');

  let submitting = $state(false);

  const ALL_ROLES = ['superadmin', 'direzione', 'amministrazione', 'commerciale'];

  const DEFAULT_ACTIVITIES: ActivityConfig[] = [
    { id: 'Telefonata', name: 'Telefonata', acronym: 'TF', icon: 'Phone', hasNotes: true, hasCalendar: false, rolesInsert: ['commerciale', 'amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
    { id: 'Incontro', name: 'Incontro', acronym: 'IF', icon: 'Users', hasNotes: true, hasCalendar: false, rolesInsert: ['commerciale', 'amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
    { id: 'Appuntamento', name: 'Appuntamento', acronym: 'AF', icon: 'Calendar', hasNotes: true, hasCalendar: true, rolesInsert: ['commerciale', 'amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
    { id: 'Sollecito Telefonico', name: 'Sollecito Telefonico', acronym: 'ST', icon: 'Phone', hasNotes: true, hasCalendar: false, rolesInsert: ['amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
    { id: 'Sollecito Email', name: 'Sollecito Email', acronym: 'SE', icon: 'MessageSquare', hasNotes: true, hasCalendar: false, rolesInsert: ['amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
    { id: 'Sollecito PEC', name: 'Sollecito PEC', acronym: 'SP', icon: 'FileText', hasNotes: true, hasCalendar: false, rolesInsert: ['amministrazione', 'superadmin', 'direzione'], rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] }
  ];

  let isEditing = $state(false);
  let editIndex = $state<number | null>(null);
  
  let formData = $state<ActivityConfig>({
    id: '',
    name: '',
    acronym: '',
    icon: 'ActivitySquare',
    hasNotes: true,
    hasCalendar: false,
    rolesInsert: ['superadmin', 'direzione', 'commerciale', 'amministrazione'],
    rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione']
  });

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  function startCreate() {
    isEditing = true;
    editIndex = null;
    formData = {
      id: '',
      name: '',
      acronym: '',
      icon: 'ActivitySquare',
      hasNotes: true,
      hasCalendar: false,
      rolesInsert: ['superadmin', 'direzione', 'commerciale', 'amministrazione'],
      rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione']
    };
  }

  function startEdit(index: number) {
    isEditing = true;
    editIndex = index;
    formData = JSON.parse(JSON.stringify($activitiesConfigStore[index]));
  }

  function cancelEdit() {
    isEditing = false;
    editIndex = null;
  }

  function updateName(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    formData.name = val;
    if (editIndex === null) {
      // Auto-generate ID if creating new
      formData.id = val.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
      if (!formData.acronym) {
        formData.acronym = val.substring(0, 3).toUpperCase();
      }
    }
  }

  function toggleRole(arrayType: 'rolesInsert' | 'rolesView', role: string) {
    const arr = formData[arrayType];
    if (arr.includes(role)) {
      formData[arrayType] = arr.filter(r => r !== role);
    } else {
      formData[arrayType] = [...arr, role];
    }
  }

  async function saveItem() {
    if (!formData.id.trim() || !formData.name.trim()) {
      toast.error("ID e Nome sono obbligatori.");
      return;
    }
    
    // Check ID uniqueness
    const exists = $activitiesConfigStore.findIndex(a => a.id === formData.id);
    if (exists !== -1 && exists !== editIndex) {
      toast.error("L'ID specificato è già in uso per un altro KPI.");
      return;
    }

    submitting = true;
    try {
      const newList = [...$activitiesConfigStore];
      if (editIndex !== null) {
        newList[editIndex] = formData;
      } else {
        newList.push(formData);
      }
      
      await setDoc(doc(db, 'settings', 'activities'), { list: newList }, { merge: true });
      toast.success("KPI salvato con successo.");
      isEditing = false;
    } catch (e: any) {
      toast.error(e.message || "Errore nel salvataggio");
    } finally {
      submitting = false;
    }
  }

  async function deleteItem(index: number) {
    const ok = await confirmStore.prompt("Sei sicuro di voler eliminare questo KPI? Lo storico rimarrà nel database ma non potrai più creare nuove attività di questo tipo.");
    if (!ok) return;
    
    submitting = true;
    try {
      const newList = [...$activitiesConfigStore];
      newList.splice(index, 1);
      await setDoc(doc(db, 'settings', 'activities'), { list: newList }, { merge: true });
      toast.success("KPI eliminato.");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      submitting = false;
    }
  }

  async function loadDefaults() {
    const ok = await confirmStore.prompt("Verranno aggiunti i KPI di default (Telefonata, Incontro, ecc.). Vuoi procedere?");
    if (!ok) return;
    
    submitting = true;
    try {
      const newList = [...$activitiesConfigStore];
      for (const def of DEFAULT_ACTIVITIES) {
        if (!newList.find(x => x.id === def.id)) {
          newList.push(def);
        }
      }
      await setDoc(doc(db, 'settings', 'activities'), { list: newList }, { merge: true });
      toast.success("KPI di default caricati.");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      submitting = false;
    }
  }
</script>

<div class="settings-page animate-fade-in">
  <div class="page-top-actions">
    <Button variant="secondary" href="/dashboard/settings">
      <ArrowLeft size={16} /> Torna indietro
    </Button>
    <div class="title-header">
      <ActivitySquare size={24} color="var(--color-neutral-800)" />
      <h2>Gestione KPI Attività</h2>
    </div>
  </div>

  {#if isEditing}
    <div class="settings-card card animate-slide-up">
      <div class="card-header">
        <h3>{editIndex === null ? 'Nuovo KPI' : 'Modifica KPI'}</h3>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <FormField id="kpi-name" label="Nome Visibile" helpText="Es. Telefonata Commerciale">
            <input type="text" id="kpi-name" value={formData.name} oninput={updateName} disabled={submitting} />
          </FormField>
          
          <FormField id="kpi-id" label="ID di Sistema" helpText="Codice univoco (es. telefonata_comm).">
            <input type="text" id="kpi-id" bind:value={formData.id} disabled={submitting || editIndex !== null} />
          </FormField>
        </div>

        <div class="form-grid form-grid-spaced">
          <FormField id="kpi-acronym" label="Acronimo" helpText="Max 4 caratteri (es. TF, IF, AF).">
            <input type="text" id="kpi-acronym" bind:value={formData.acronym} maxlength="4" class="uppercase-text" disabled={submitting} />
          </FormField>
          
          <FormField id="kpi-icon" label="Icona" helpText="Icona da mostrare nel riquadro della dashboard.">
            <select id="kpi-icon" bind:value={formData.icon} disabled={submitting} class="w-full">
              <option value="Phone">Telefono (Phone)</option>
              <option value="Users">Utenti/Incontro (Users)</option>
              <option value="Calendar">Calendario/App. (Calendar)</option>
              <option value="MessageSquare">Email/Messaggio (MessageSquare)</option>
              <option value="FileText">Documento/PEC (FileText)</option>
              <option value="ActivitySquare">Attività Generica (ActivitySquare)</option>
              <option value="CheckCircle">Completato (CheckCircle)</option>
              <option value="Briefcase">Lavoro/Comm. (Briefcase)</option>
              <option value="Mail">Posta (Mail)</option>
            </select>
          </FormField>
        </div>

        <div class="form-grid form-grid-spaced">
          <label class="custom-checkbox flex-checkbox">
            <input type="checkbox" bind:checked={formData.hasNotes} disabled={submitting} />
            <span class="checkmark"></span>
            <span class="lbl">Consenti aggiunta di Note Extra</span>
          </label>
          <label class="custom-checkbox flex-checkbox">
            <input type="checkbox" bind:checked={formData.hasCalendar} disabled={submitting} />
            <span class="checkmark"></span>
            <span class="lbl">Consenti calendarizzazione (Data/Ora)</span>
          </label>
        </div>

        <div class="roles-selection roles-selection-spaced">
          <div class="roles-box">
            <h4>Chi può INSERIRE questa attività?</h4>
            <div class="roles-list">
              {#each ALL_ROLES as role}
                <label class="custom-checkbox flex-checkbox">
                  <input type="checkbox" checked={formData.rolesInsert.includes(role)} onchange={() => toggleRole('rolesInsert', role)} disabled={submitting} />
                  <span class="checkmark"></span>
                  <span class="lbl capitalize-text">{role}</span>
                </label>
              {/each}
            </div>
          </div>
          <div class="roles-box">
            <h4>Chi può VEDERE questa attività?</h4>
            <div class="roles-list">
              {#each ALL_ROLES as role}
                <label class="custom-checkbox flex-checkbox">
                  <input type="checkbox" checked={formData.rolesView.includes(role)} onchange={() => toggleRole('rolesView', role)} disabled={submitting} />
                  <span class="checkmark"></span>
                  <span class="lbl capitalize-text">{role}</span>
                </label>
              {/each}
            </div>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <div class="form-actions">
          <Button variant="secondary" onclick={cancelEdit} disabled={submitting}>Annulla</Button>
          <Button variant="primary" onclick={saveItem} disabled={submitting}>
            {#if submitting}<div class="spinner-small"></div>{/if}
            Salva KPI
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <div class="settings-card card">
      <div class="card-header card-header-flex">
        <div class="header-text">
          <h3>KPI Attuali</h3>
          <p class="subtitle">Personalizza le tipologie di interazioni per le anagrafiche.</p>
        </div>
        <div class="header-actions">
          {#if $activitiesConfigStore.length === 0}
            <Button variant="secondary" onclick={loadDefaults} disabled={submitting}>Carica Default</Button>
          {/if}
          <Button variant="primary" onclick={startCreate} disabled={submitting}>
            <Plus size={16} /> Crea KPI
          </Button>
        </div>
      </div>
      
      <div class="card-body">
        {#if $activitiesConfigStore.length === 0}
          <div class="empty-panel">Nessun KPI configurato.</div>
        {:else}
          <table class="menu-table">
            <thead>
              <tr>
                <th>Nome / ID</th>
                <th>Acronimo</th>
                <th>Icona</th>
                <th>Proprietà</th>
                <th>Inserimento</th>
                <th>Visibilità</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each $activitiesConfigStore as kpi, i}
                <tr>
                  <td class="item-name">
                    <strong>{kpi.name}</strong>
                    <span class="item-id">({kpi.id})</span>
                  </td>
                  <td>
                    <span class="mini-tag uppercase-text">{kpi.acronym || '-'}</span>
                  </td>
                  <td>
                    <span class="mini-tag">{kpi.icon || 'N/A'}</span>
                  </td>
                  <td>
                    <div class="tags-container">
                      {#if kpi.hasNotes}<span class="mini-tag">Note</span>{/if}
                      {#if kpi.hasCalendar}<span class="mini-tag">Data</span>{/if}
                    </div>
                  </td>
                  <td>
                    <div class="tags-container">
                      {#each kpi.rolesInsert as r}
                        <span class="role-tag">{r.substring(0,3)}</span>
                      {/each}
                    </div>
                  </td>
                  <td>
                    <div class="tags-container">
                      {#each kpi.rolesView as r}
                        <span class="role-tag">{r.substring(0,3)}</span>
                      {/each}
                    </div>
                  </td>
                  <td>
                    <div class="actions-cell">
                      <button class="btn-icon" onclick={() => startEdit(i)} title="Modifica"><Edit2 size={16}/></button>
                      <button class="btn-icon danger" onclick={() => deleteItem(i)} title="Elimina"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    width: 100%;
    padding: 24px 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .page-top-actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .title-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card-header {
    padding: 24px;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .card-header h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .subtitle {
    margin: 0;
    color: var(--color-neutral-500);
    font-size: 14px;
  }

  .card-body {
    padding: 24px;
  }

  .card-body:has(.menu-table) {
    padding: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .roles-selection {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    background: var(--color-neutral-50);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .roles-box h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--color-neutral-800);
  }

  .roles-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .flex-checkbox {
    display: flex !important;
    align-items: center;
    height: auto !important;
  }

  .flex-checkbox .lbl {
    margin-left: 12px;
    font-size: 14px;
    color: var(--color-neutral-700);
  }

  .card-footer {
    padding: 24px;
    background: var(--color-neutral-50);
    border-top: 1px solid var(--color-neutral-200);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .menu-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .menu-table th {
    padding: 12px 16px;
    background: var(--color-neutral-50);
    color: var(--color-neutral-600);
    font-weight: 600;
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .menu-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-100);
    vertical-align: middle;
  }

  .item-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-id {
    font-size: 12px;
    color: var(--color-neutral-400);
    font-family: monospace;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mini-tag {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .role-tag {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .actions-cell {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-neutral-500);
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .btn-icon.danger:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  .empty-panel {
    padding: 32px;
    text-align: center;
    color: var(--color-neutral-500);
    font-style: italic;
  }

  .custom-checkbox {
    display: inline-block;
    position: relative;
    padding-left: 24px;
    cursor: pointer;
    user-select: none;
    height: 20px;
  }

  .custom-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkmark {
    position: absolute;
    top: 0;
    left: 0;
    height: 20px;
    width: 20px;
    background-color: var(--color-white);
    border: 2px solid var(--color-neutral-300);
    border-radius: 4px;
    transition: all 0.2s;
  }

  .custom-checkbox:hover input ~ .checkmark {
    border-color: var(--color-primary-400);
  }

  .custom-checkbox input:checked ~ .checkmark {
    background-color: var(--color-primary-600);
    border-color: var(--color-primary-600);
  }

  .checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .custom-checkbox input:checked ~ .checkmark:after {
    display: block;
  }

  .custom-checkbox .checkmark:after {
    left: 6px;
    top: 2px;
    width: 4px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .form-grid-spaced {
    margin-top: 16px;
  }

  .roles-selection-spaced {
    margin-top: 32px;
  }

  .uppercase-text {
    text-transform: uppercase;
  }

  .capitalize-text {
    text-transform: capitalize;
  }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
</style>
