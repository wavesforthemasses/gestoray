<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { db, doc, getDoc, setDoc } from '$lib/firebase';
  import { activeRoleState } from '$lib/auth.svelte';
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import Button from '$lib/components/Button.svelte';
  import { Save, ArrowLeft, Menu, ChevronUp, ChevronDown } from 'lucide-svelte';
  import { DEFAULT_MENU_CONFIG, type MenuItemConfig } from '$lib/stores/menu';
  import { pageTitle } from '$lib/stores/page';

  pageTitle.set('Impostazioni Menu');

  let loading = $state(true);
  let submitting = $state(false);

  let menuItems = $state<MenuItemConfig[]>(JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)));

  const ALL_ROLES = ['superadmin', 'direzione', 'amministrazione', 'commerciale'];
  
  const MENU_LABELS: Record<string, string> = {
    'todo': 'Cose da Fare',
    'clients': 'Gestione Clienti',
    'contacts': 'Gestione Contatti',
    'activities': 'Gestione Attività',
    'contracts': 'Gestione Contratti',
    'my-commissions': 'Le Mie Provvigioni',
    'payments': 'Gestione Incassi',
    'commissions': 'Gestione Provvigioni',
    'products': 'Catalogo Prodotti',
    'users': 'Gestione Utenti',
    'qualifications': 'Gestione Qualifiche',
    'settings': 'Impostazioni'
  };

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {
    loadSettings();
  });

  async function loadSettings() {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'menu'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.list && Array.isArray(data.list) && data.list.length > 0) {
          const savedList: MenuItemConfig[] = data.list;
          const validIds = new Set(DEFAULT_MENU_CONFIG.map(item => item.id));
          const filteredSaved = savedList.map(item => {
            const def = DEFAULT_MENU_CONFIG.find(d => d.id === item.id);
            return def ? { ...def, ...item } : item;
          }).filter(item => validIds.has(item.id));
          const savedIds = new Set(filteredSaved.map(item => item.id));
          const missingItems = DEFAULT_MENU_CONFIG.filter(item => !savedIds.has(item.id));
          menuItems = [...filteredSaved, ...missingItems];
        }
      }
    } catch (e: any) {
      toast.error("Errore nel caricamento delle impostazioni.");
    } finally {
      loading = false;
    }
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= menuItems.length) return;
    const copy = [...menuItems];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    menuItems = copy;
  }

  function toggleRole(itemId: string, role: string) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.rolesView.includes(role)) {
      item.rolesView = item.rolesView.filter(r => r !== role);
    } else {
      item.rolesView = [...item.rolesView, role];
    }
  }

  async function saveSettings() {
    submitting = true;
    try {
      await setDoc(doc(db, 'settings', 'menu'), {
        list: menuItems
      }, { merge: true });
      
      toast.success('Impostazioni menu salvate con successo.');
    } catch (e: any) {
      toast.error(e.message || "Errore nel salvataggio");
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
      <Menu size={24} color="var(--color-neutral-800)" />
      <h2>Visibilità Menu & Ordine</h2>
    </div>
  </div>

  {#if loading}
    <div class="skeleton-loader skeleton-tall"></div>
  {:else}
    <div class="settings-card card">
      <div class="card-header">
        <div class="header-text">
          <h3>Voci di Menu</h3>
          <p class="subtitle">Scegli quali ruoli possono visualizzare ciascuna voce nel menu di navigazione laterale e personalizzane l'ordine di visualizzazione.</p>
        </div>
      </div>
      <div class="card-body">
        <table class="menu-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 80px;">Ordine</th>
              <th>Voce di Menu</th>
              {#each ALL_ROLES as role}
                <th class="text-center capitalize-text">{role}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each menuItems as item, idx (item.id)}
              <tr>
                <td class="text-center order-cell">
                  <div class="order-btn-group">
                    <button 
                      type="button" 
                      class="btn-order" 
                      onclick={() => moveItem(idx, 'up')} 
                      disabled={idx === 0 || submitting}
                      title="Sposta Su"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button 
                      type="button" 
                      class="btn-order" 
                      onclick={() => moveItem(idx, 'down')} 
                      disabled={idx === menuItems.length - 1 || submitting}
                      title="Sposta Giù"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </td>
                <td class="item-name">
                  <strong>{MENU_LABELS[item.id] || item.label || item.id}</strong>
                  <span class="item-id">({item.id})</span>
                </td>
                {#each ALL_ROLES as role}
                  <td class="text-center">
                    <label class="custom-checkbox">
                      <input 
                        type="checkbox" 
                        checked={item.rolesView.includes(role)}
                        onchange={() => toggleRole(item.id, role)}
                        disabled={submitting || (item.id === 'settings' && role !== 'superadmin')}
                      />
                      <span class="checkmark"></span>
                    </label>
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="card-footer">
        <div class="form-actions">
          <Button variant="primary" onclick={saveSettings} disabled={submitting}>
            {#if submitting}
              <div class="spinner-small"></div>
              Salvataggio...
            {:else}
              <Save size={16} /> Salva Impostazioni
            {/if}
          </Button>
        </div>
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
    padding: 0;
    overflow-x: auto;
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

  .menu-table th.text-center {
    text-align: center;
  }

  .menu-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-100);
    vertical-align: middle;
  }

  .menu-table td.text-center {
    text-align: center;
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

  .card-footer {
    padding: 24px;
    background: var(--color-neutral-50);
    border-top: 1px solid var(--color-neutral-200);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
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

  .custom-checkbox input:disabled ~ .checkmark {
    background-color: var(--color-neutral-100);
    border-color: var(--color-neutral-200);
    cursor: not-allowed;
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

  .skeleton-tall {
    height: 400px;
  }

  .capitalize-text {
    text-transform: capitalize;
  }

  .order-cell {
    width: 70px;
  }

  .order-btn-group {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  .btn-order {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-order:hover:not(:disabled) {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    border-color: var(--color-primary-300);
  }

  .btn-order:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
