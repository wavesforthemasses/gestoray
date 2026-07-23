<script lang="ts">
  import { onMount } from 'svelte';
  import { Card, Button, FormField, ToastContainer, StatusBadge } from '$lib';
  import { toast } from '$lib/stores/toast.svelte';
  import { Shield, Plus, Trash2, Save, ArrowLeft, CheckSquare, Square } from '@lucide/svelte';
  import {
    rolesStore,
    initRolesStore,
    saveRolesToFirestore,
    MODULE_PERMISSIONS_REGISTRY,
    type RoleConfig,
    type ActionKey
  } from '$lib/services/roles.service';
  import { activeRoleState } from '$lib/auth.svelte';

  let rolesList = $state<RoleConfig[]>([]);
  let selectedRoleTab = $state<string>('commerciale');
  let isSaving = $state(false);
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let roleToDelete = $state<RoleConfig | null>(null);

  // New Role Form State
  let newRoleId = $state('');
  let newRoleLabel = $state('');
  let newRoleDesc = $state('');

  rolesStore.subscribe((val) => {
    rolesList = val;
    if (val.length > 0 && !val.some(r => r.id === selectedRoleTab)) {
      selectedRoleTab = val[0].id;
    }
  });

  onMount(() => {
    initRolesStore();
  });

  let activeRoleObj = $derived(rolesList.find(r => r.id === selectedRoleTab));

  async function handleSaveRoles() {
    isSaving = true;
    try {
      await saveRolesToFirestore(rolesList);
      toast.success('Matrice dei permessi salvata con successo su Firestore!');
    } catch (e: any) {
      toast.error('Errore durante il salvataggio: ' + (e.message || e));
    } finally {
      isSaving = false;
    }
  }

  function handleCreateRole() {
    const cleanId = newRoleId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanId || !newRoleLabel.trim()) {
      toast.error('Inserisci ID e Titolo del ruolo.');
      return;
    }

    if (rolesList.some(r => r.id === cleanId)) {
      toast.error('Un ruolo con questo ID esiste già.');
      return;
    }

    const defaultPerms: Record<string, boolean> = {};
    for (const mod of MODULE_PERMISSIONS_REGISTRY) {
      for (const act of mod.actions) {
        const key = `${mod.module}:${act.key}`;
        defaultPerms[key] = act.key === 'list' || act.key === 'read';
      }
    }

    const newRole: RoleConfig = {
      id: cleanId,
      label: newRoleLabel.trim(),
      description: newRoleDesc.trim() || 'Ruolo personalizzato',
      isSystem: false,
      permissions: defaultPerms
    };

    rolesList = [...rolesList, newRole];
    selectedRoleTab = cleanId;
    showAddModal = false;
    resetForm();
    handleSaveRoles();
  }

  function resetForm() {
    newRoleId = '';
    newRoleLabel = '';
    newRoleDesc = '';
  }

  function confirmDelete(role: RoleConfig) {
    if (role.isSystem) {
      toast.error('I ruoli di sistema non possono essere eliminati.');
      return;
    }
    roleToDelete = role;
    showDeleteModal = true;
  }

  function executeDelete() {
    if (!roleToDelete) return;
    rolesList = rolesList.filter(r => r.id !== roleToDelete!.id);
    showDeleteModal = false;
    if (selectedRoleTab === roleToDelete.id) {
      selectedRoleTab = rolesList[0]?.id || 'superadmin';
    }
    roleToDelete = null;
    handleSaveRoles();
  }

  function togglePerm(roleId: string, permKey: string) {
    if (roleId === 'superadmin') return; // Superadmin always full permissions
    rolesList = rolesList.map(r => {
      if (r.id === roleId) {
        const currentVal = !!r.permissions[permKey];
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [permKey]: !currentVal
          }
        };
      }
      return r;
    });
  }

  function toggleModuleRow(roleId: string, moduleName: string, enableAll: boolean) {
    if (roleId === 'superadmin') return;
    const modSpec = MODULE_PERMISSIONS_REGISTRY.find(m => m.module === moduleName);
    if (!modSpec) return;

    rolesList = rolesList.map(r => {
      if (r.id === roleId) {
        const updatedPerms = { ...r.permissions };
        for (const act of modSpec.actions) {
          updatedPerms[`${moduleName}:${act.key}`] = enableAll;
        }
        return { ...r, permissions: updatedPerms };
      }
      return r;
    });
  }
</script>

<svelte:head>
  <title>Matrice Permessi CRUD & Ruoli | Gestoray</title>
</svelte:head>

<div class="roles-management-page">
  <ToastContainer />

  <div class="header-actions-bar">
    <Button href="/dashboard/settings" variant="secondary">
      <ArrowLeft size={16} /> Torna a Impostazioni
    </Button>

    <div class="top-buttons">
      {#if activeRoleState.role === 'superadmin'}
        <Button variant="primary" onclick={() => { resetForm(); showAddModal = true; }}>
          <Plus size={16} /> Aggiungi Nuovo Ruolo
        </Button>
        <Button variant="success" onclick={handleSaveRoles} disabled={isSaving}>
          <Save size={16} /> {isSaving ? 'Salvataggio...' : 'Salva Matrice Permessi'}
        </Button>
      {/if}
    </div>
  </div>

  <Card
    title="Matrice Permessi Azioni (CRUD) & Ruoli Aziendali"
    description="Definisci in modo granulare cosa ogni ruolo è autorizzato a fare su ciascun modulo (Elenco, Lettura Dettaglio, Creazione, Modifica, Eliminazione)."
  >
    {#snippet icon()}
      <Shield size={20} class="icon-accent" />
    {/snippet}

    <!-- TAB SWITCHER PER RUOLO -->
    <div class="role-tabs-bar">
      {#each rolesList as role}
        <button
          type="button"
          class="role-tab-btn"
          class:active={selectedRoleTab === role.id}
          onclick={() => { selectedRoleTab = role.id; }}
        >
          <span>{role.label}</span>
          {#if role.isSystem}
            <span class="mini-badge system">Sistema</span>
          {:else}
            <span class="mini-badge custom">Custom</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- DETTAGLIO RUOLO SELEZIONATO -->
    {#if activeRoleObj}
      <div class="active-role-banner">
        <div class="role-info">
          <h3>{activeRoleObj.label} <span class="role-id-code">({activeRoleObj.id})</span></h3>
          <p>{activeRoleObj.description}</p>
        </div>

        {#if !activeRoleObj.isSystem && activeRoleState.role === 'superadmin'}
          <Button variant="danger" size="sm" onclick={() => confirmDelete(activeRoleObj)}>
            <Trash2 size={14} /> Elimina Ruolo
          </Button>
        {/if}
      </div>

      <!-- TABELLA MATRICE PERMESSI -->
      <div class="permissions-matrix-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="col-module">Modulo di Sistema</th>
              <th class="col-action">Elenco (List)</th>
              <th class="col-action">Dettaglio (Read)</th>
              <th class="col-action">Creazione (Create)</th>
              <th class="col-action">Modifica (Update)</th>
              <th class="col-action">Eliminazione (Delete)</th>
              <th class="col-quick">Azioni Rapide</th>
            </tr>
          </thead>
          <tbody>
            {#each MODULE_PERMISSIONS_REGISTRY as mod}
              <tr>
                <td class="col-module">
                  <strong>{mod.label}</strong>
                  <span class="module-code">{mod.module}</span>
                </td>

                {#each ['list', 'read', 'create', 'update', 'delete'] as actKey}
                  <td class="col-action">
                    {#if mod.actions.some(a => a.key === actKey)}
                      <label class="matrix-checkbox">
                        <input
                          type="checkbox"
                          checked={activeRoleObj.id === 'superadmin' || !!activeRoleObj.permissions[`${mod.module}:${actKey}`]}
                          disabled={activeRoleObj.id === 'superadmin' || activeRoleState.role !== 'superadmin'}
                          onchange={() => togglePerm(activeRoleObj!.id, `${mod.module}:${actKey}`)}
                        />
                      </label>
                    {:else}
                      <span class="na-dash">-</span>
                    {/if}
                  </td>
                {/each}

                <td class="col-quick">
                  {#if activeRoleObj.id !== 'superadmin' && activeRoleState.role === 'superadmin'}
                    <button
                      type="button"
                      class="btn-quick-toggle"
                      onclick={() => toggleModuleRow(activeRoleObj!.id, mod.module, true)}
                      title="Abilita Tutti per questo modulo"
                    >
                      Tutti
                    </button>
                    <button
                      type="button"
                      class="btn-quick-toggle"
                      onclick={() => toggleModuleRow(activeRoleObj!.id, mod.module, false)}
                      title="Disabilita Tutti per questo modulo"
                    >
                      Nessuno
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>

  <!-- MODAL AGGIUNGI RUOLO -->
  {#if showAddModal}
    <div class="modal-overlay">
      <div class="modal-card">
        <h3>Crea Nuovo Ruolo Personalizzato</h3>
        <p class="modal-subtitle">Definisci il nome per il nuovo profilo (es. Operaio, Tecnico, Magazziniere).</p>

        <div class="form-stack">
          <FormField id="new-role-id" label="Identificativo Univoco (ID)">
            <input type="text" id="new-role-id" placeholder="es. operaio, tecnico, supervisor" bind:value={newRoleId} />
          </FormField>

          <FormField id="new-role-label" label="Titolo Ruolo">
            <input type="text" id="new-role-label" placeholder="es. Operaio Specializzato" bind:value={newRoleLabel} />
          </FormField>

          <FormField id="new-role-desc" label="Descrizione Operativa">
            <input type="text" id="new-role-desc" placeholder="es. Gestione rapportini e interventi di cantiere" bind:value={newRoleDesc} />
          </FormField>
        </div>

        <div class="modal-footer">
          <Button variant="secondary" onclick={() => { showAddModal = false; }}>Annulla</Button>
          <Button variant="primary" onclick={handleCreateRole}>Crea e Salva Ruolo</Button>
        </div>
      </div>
    </div>
  {/if}

  <!-- CONFIRM DELETE MODAL -->
  {#if showDeleteModal}
    <div class="modal-overlay">
      <div class="modal-card">
        <h3>Conferma Eliminazione Ruolo</h3>
        <p class="modal-subtitle">Sei sicuro di voler eliminare il ruolo "{roleToDelete?.label}"? Gli utenti associati a questo ruolo perderanno le autorizzazioni relative.</p>
        <div class="modal-footer">
          <Button variant="secondary" onclick={() => { showDeleteModal = false; roleToDelete = null; }}>Annulla</Button>
          <Button variant="danger" onclick={executeDelete}>Elimina Ruolo</Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .roles-management-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .header-actions-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .top-buttons {
    display: flex;
    gap: 12px;
  }

  .role-tabs-bar {
    display: flex;
    gap: 8px;
    border-bottom: 2px solid var(--color-neutral-200);
    padding-bottom: 8px;
    margin-top: 16px;
    overflow-x: auto;
  }

  .role-tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    color: var(--color-neutral-700);
    transition: all 0.2s ease;
  }

  .role-tab-btn.active {
    background: var(--color-primary-600);
    color: white;
    border-color: var(--color-primary-600);
  }

  .mini-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .mini-badge.system {
    background: rgba(0, 0, 0, 0.1);
  }

  .mini-badge.custom {
    background: var(--color-secondary-500);
    color: white;
  }

  .active-role-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    margin-top: 16px;
  }

  .role-info h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }

  .role-id-code {
    font-family: monospace;
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .role-info p {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: var(--color-neutral-600);
  }

  .permissions-matrix-wrapper {
    margin-top: 16px;
    overflow-x: auto;
  }

  .matrix-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .matrix-table th,
  .matrix-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-200);
    text-align: center;
  }

  .matrix-table th {
    background: var(--color-neutral-100);
    font-weight: 700;
    color: var(--color-neutral-700);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }

  .matrix-table th.col-module,
  .matrix-table td.col-module {
    text-align: left;
  }

  .col-module strong {
    display: block;
    color: var(--color-neutral-900);
  }

  .module-code {
    font-family: monospace;
    font-size: 11px;
    color: var(--color-neutral-500);
  }

  .matrix-checkbox input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .na-dash {
    color: var(--color-neutral-400);
  }

  .col-quick {
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  .btn-quick-toggle {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--color-neutral-300);
    background: white;
    cursor: pointer;
  }

  .btn-quick-toggle:hover {
    background: var(--color-neutral-100);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  .modal-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 24px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
