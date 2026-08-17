<script lang="ts">
  import { onMount } from 'svelte';
  import {
    UnitsOfMeasureService,
    type UnitOfMeasure,
    DEFAULT_UNITS
  } from '$lib/services/unitsOfMeasureService';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import {
    Ruler,
    Plus,
    Trash2,
    Save,
    RotateCcw,
    Info,
    ArrowLeft,
    Check
  } from '@lucide/svelte';

  let units = $state<UnitOfMeasure[]>([]);
  let loading = $state(true);
  let saving = $state(false);

  // New unit form state
  let newCode = $state('');
  let newLabel = $state('');
  let newSymbol = $state('');
  let newCategory = $state<UnitOfMeasure['category']>('quantity');
  let newDecimals = $state<number>(2);
  let newAliasesStr = $state('');

  onMount(async () => {
    try {
      units = await UnitsOfMeasureService.getUnits();
    } catch (e: any) {
      console.error('Errore caricamento unità di misura:', e);
      toast.error('Impossibile caricare il catalogo Unità di Misura');
    } finally {
      loading = false;
    }
  });

  async function handleAddUnit() {
    if (!newCode.trim() || !newLabel.trim()) {
      toast.error('Codice e Nome sono obbligatori');
      return;
    }

    const cleanCode = newCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanCode) {
      toast.error('Il codice deve contenere caratteri alfanumerici (es. pz, kg, m3)');
      return;
    }

    if (units.some((u) => u.code === cleanCode)) {
      toast.error(`L'unità con codice "${cleanCode}" esiste già`);
      return;
    }

    const parsedAliases = newAliasesStr
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);

    if (!parsedAliases.includes(cleanCode)) {
      parsedAliases.push(cleanCode);
    }

    const newUnit: UnitOfMeasure = {
      id: cleanCode,
      code: cleanCode,
      label: newLabel.trim(),
      symbol: newSymbol.trim() || cleanCode,
      category: newCategory,
      decimals: typeof newDecimals === 'number' ? newDecimals : 2,
      aliases: parsedAliases,
      isSystem: false
    };

    try {
      saving = true;
      await UnitsOfMeasureService.saveUnit(newUnit);
      units = await UnitsOfMeasureService.getUnits();

      newCode = '';
      newLabel = '';
      newSymbol = '';
      newDecimals = 2;
      newAliasesStr = '';
      toast.success(`Unità "${newUnit.label}" salvata su Firestore in 'units_of_measure/${cleanCode}'!`);
    } catch (err: any) {
      toast.error('Errore salvataggio su Firestore: ' + err.message);
    } finally {
      saving = false;
    }
  }

  async function handleRemoveUnit(code: string) {
    const target = units.find((u) => u.code === code);
    if (target?.isSystem) {
      toast.error('Le unità di sistema di base non possono essere eliminate');
      return;
    }

    try {
      await UnitsOfMeasureService.deleteUnit(code);
      units = units.filter((u) => u.code !== code);
      toast.success(`Unità '${code}' eliminata da Firestore collection 'units_of_measure'.`);
    } catch (err: any) {
      toast.error('Errore eliminazione su Firestore: ' + err.message);
    }
  }

  async function handleResetDefaults() {
    const confirmed = await confirmStore.prompt('Ripristinare il catalogo predefinito di sistema su Firestore? Eventuali unità personalizzate verranno rimosse.');
    if (confirmed) {
      try {
        loading = true;
        await UnitsOfMeasureService.resetDefaults();
        units = await UnitsOfMeasureService.getUnits();
        toast.success('Catalogo ripristinato su Firestore collection units_of_measure!');
      } catch (err: any) {
        toast.error('Errore ripristino: ' + err.message);
      } finally {
        loading = false;
      }
    }
  }

  async function handleSave() {
    saving = true;
    try {
      await UnitsOfMeasureService.saveUnits(units);
      toast.success('Catalogo Unità di Misura salvato con successo!');
    } catch (err: any) {
      toast.error('Errore durante il salvataggio: ' + err.message);
    } finally {
      saving = false;
    }
  }

  function getCategoryLabel(cat: UnitOfMeasure['category']): string {
    switch (cat) {
      case 'volume':
        return 'Volume';
      case 'area':
        return 'Superficie';
      case 'length':
        return 'Lunghezza';
      case 'weight':
        return 'Peso / Massa';
      case 'time':
        return 'Tempo';
      case 'service':
        return 'Servizio / Corpo';
      case 'currency':
        return 'Valuta / Moneta';
      case 'quantity':
      default:
        return 'Quantità / Pezzi';
    }
  }
  import { projectStore } from '$lib/stores/project';
</script>

<svelte:head>
  <title>Gestione Unità di Misura | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="units-settings-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/settings" class="back-link">
      <ArrowLeft size={16} /> Torna alle Impostazioni Generali
    </a>
    <div class="title-bar">
      <h2>
        <Ruler size={28} /> Gestione Unità di Misura (UdM)
      </h2>
      <button type="button" onclick={handleResetDefaults} class="btn-secondary-sm">
        <RotateCcw size={16} /> Ripristina Predefiniti
      </button>
    </div>
    <p class="subtitle">
      Configura le Unità di Misura aziendali ed i sinonimi/alias utilizzati durante l'importazione automatica CSV.
    </p>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento catalogo in corso...
    </div>
  {:else}
    <!-- Quick Add Form Card -->
    <div class="card form-card mb-24">
      <h3 class="card-title">
        <Plus size={20} /> Aggiungi Nuova Unità di Misura
      </h3>
      <p class="card-subtitle">
        Inserisci un nuovo codice ed i relativi alias per permettere l'abbinamento automatico dai file Excel/CSV dei fornitori.
      </p>

      <div class="grid-form">
        <div class="form-group">
          <label for="u-code">Codice Univoco *</label>
          <input
            id="u-code"
            type="text"
            bind:value={newCode}
            placeholder="es. pal, flac, scatol"
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="u-label">Nome / Denominazione *</label>
          <input
            id="u-label"
            type="text"
            bind:value={newLabel}
            placeholder="es. Pallet, Flaconi, Scatole"
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="u-symbol">Simbolo Grafico</label>
          <input
            id="u-symbol"
            type="text"
            bind:value={newSymbol}
            placeholder="es. pl, fl, sc"
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="u-cat">Categoria</label>
          <select id="u-cat" bind:value={newCategory} class="form-control">
            <option value="quantity">Quantità / Pezzi</option>
            <option value="volume">Volume (m³ / l)</option>
            <option value="area">Superficie (m²)</option>
            <option value="length">Lunghezza (m)</option>
            <option value="weight">Peso (kg)</option>
            <option value="time">Tempo (ore)</option>
            <option value="service">Servizio / Corpo</option>
            <option value="currency">Valuta / Moneta (€)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="u-decimals">Cifre Decimali (0 - 4)</label>
          <input
            id="u-decimals"
            type="number"
            min="0"
            max="4"
            bind:value={newDecimals}
            class="form-control"
          />
        </div>

        <div class="form-group full-width">
          <label for="u-aliases">Sinonimi / Alias CSV (separati da virgola)</label>
          <input
            id="u-aliases"
            type="text"
            bind:value={newAliasesStr}
            placeholder="es. pallet, bancale, bancali, pal"
            class="form-control"
          />
          <span class="field-hint">
            <Info size={14} /> Se un file CSV contiene una di queste parole, verrà convertito automaticamente in questo codice.
          </span>
        </div>
      </div>

      <div class="form-actions mt-16">
        <button type="button" onclick={handleAddUnit} class="btn-primary-sm">
          <Plus size={16} /> Aggiungi alla Tabella
        </button>
      </div>
    </div>

    <!-- Units Table Card -->
    <div class="card table-card">
      <div class="card-header">
        <h3 class="card-title">Catalogo Attivo Unità di Misura ({units.length})</h3>
      </div>

      <div class="table-wrapper">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Nome / Etichetta</th>
              <th>Simbolo</th>
              <th>Categoria</th>
              <th>Decimali</th>
              <th>Sinonimi / Alias Riconosciuti</th>
              <th>Tipo</th>
              <th class="text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each units as u}
              <tr>
                <td>
                  <code class="unit-code">{u.code}</code>
                </td>
                <td>
                  <strong>{u.label}</strong>
                </td>
                <td>
                  <span class="unit-symbol">{u.symbol || u.code}</span>
                </td>
                <td>
                  <span class="category-badge">{getCategoryLabel(u.category)}</span>
                </td>
                <td>
                  <span class="decimals-badge">{typeof u.decimals === 'number' ? u.decimals : 2} dec</span>
                </td>
                <td>
                  <div class="aliases-tags">
                    {#each u.aliases as a}
                      <span class="alias-tag">{a}</span>
                    {/each}
                  </div>
                </td>
                <td>
                  {#if u.isSystem}
                    <span class="badge-system">Sistema</span>
                  {:else}
                    <span class="badge-custom">Personalizzata</span>
                  {/if}
                </td>
                <td class="text-right">
                  {#if !u.isSystem}
                    <button
                      type="button"
                      onclick={() => handleRemoveUnit(u.code)}
                      class="btn-icon-danger"
                      title="Elimina unità"
                    >
                      <Trash2 size={16} />
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bottom Save Action Bar -->
    <div class="actions-bar mt-24">
      <button type="button" onclick={handleSave} disabled={saving} class="btn-success-lg">
        <Save size={18} />
        {saving ? 'Salvataggio in corso...' : 'Salva Catalogo Unità di Misura'}
      </button>
    </div>
  {/if}
</div>

<style>
  .units-settings-page {
    width: 100%;
    padding: 24px 0;
    box-sizing: border-box;
  }
  .page-top {
    margin-bottom: 24px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-600);
    font-size: 14px;
    text-decoration: none;
    margin-bottom: 12px;
    transition: color 0.2s ease;
  }
  .back-link:hover {
    color: var(--color-primary-600);
  }
  .title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .title-bar h2 {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 26px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0;
  }
  .subtitle {
    font-size: 15px;
    color: var(--color-neutral-500);
    margin: 6px 0 0 0;
  }

  .card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  .form-card {
    margin-bottom: 24px;
  }
  .card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-neutral-800);
    margin: 0 0 4px 0;
  }
  .card-subtitle {
    font-size: 14px;
    color: var(--color-neutral-500);
    margin: 0 0 16px 0;
  }

  .grid-form {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .full-width {
    grid-column: span 4;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
    margin-bottom: 6px;
  }
  .form-control {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 8px;
    font-size: 14px;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .form-control:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }
  .field-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-neutral-500);
    margin-top: 6px;
  }

  .styled-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .styled-table th {
    background: var(--color-neutral-50);
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: var(--color-neutral-700);
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .styled-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-100);
    color: var(--color-neutral-800);
  }
  .unit-code {
    background: var(--color-neutral-100);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: monospace;
    font-weight: 700;
    color: var(--color-neutral-800);
  }
  .unit-symbol {
    font-weight: 600;
    color: var(--color-primary-700);
  }
  .category-badge {
    background: #eef2ff;
    color: #4338ca;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
  }

  .aliases-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .alias-tag {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .badge-system {
    background: #f1f5f9;
    color: #475569;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
  }
  .badge-custom {
    background: #ecfdf5;
    color: #047857;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
  }

  .btn-primary-sm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-secondary-sm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    border: 1px solid var(--color-neutral-300);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-success-lg {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }
  .btn-icon-danger {
    background: none;
    border: none;
    color: #ef4444;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn-icon-danger:hover {
    background: #fef2f2;
  }
  .text-right {
    text-align: right;
  }
</style>
