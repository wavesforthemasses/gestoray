<script lang="ts">
  import type { InterventionConsuntivoItem } from '../../schema';
  import type { InterventionSettingsConfig } from '$lib/services/interventionSettings';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';

  interface Props {
    items: InterventionConsuntivoItem[];
    settings: InterventionSettingsConfig;
    totalAmount: number;
    addItem: () => void;
    removeItem: (id: string) => void;
  }

  let { items = $bindable([]), settings, totalAmount, addItem, removeItem }: Props = $props();
</script>

<div class="card form-card">
  <div class="card-header">
    <h3 class="card-title">📝 Attività & Voci Consuntivo</h3>
    <p class="card-subtitle">Aggiungi più attività, servizi o materiali all'intervento.</p>
  </div>
  
  <div class="items-list">
    {#each items as item, index (item.id)}
      <div class="item-row">
        <div class="item-header">
          <span class="item-num">Voce #{index + 1}</span>
          {#if items.length > 1}
            <button type="button" onclick={() => removeItem(item.id)} class="btn-remove-item" title="Rimuovi Voce">🗑️ Rimuovi</button>
          {/if}
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="item-type-{item.id}">Tipo Attività</label>
            <select id="item-type-{item.id}" bind:value={item.type} class="form-control">
              {#each settings.interventionTypes as t}
                <option value={t.label}>{t.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="item-unit-{item.id}">Unità di Prezzo</label>
            <select id="item-unit-{item.id}" bind:value={item.pricingUnit} class="form-control">
              <option value="ora">Ora (h)</option>
              <option value="mq">Metri Quadri (m²)</option>
              <option value="mc">Metri Cubi (m³)</option>
              <option value="quantita">Quantità / Pezzi (pz)</option>
              <option value="corpo">A Corpo (fisso)</option>
            </select>
          </div>
        </div>

        <div class="grid-3 mt-10">
          <div class="form-group">
            <label for="item-desc-{item.id}">Descrizione Dettagliata</label>
            <input id="item-desc-{item.id}" type="text" bind:value={item.description} placeholder="Descrizione attività o note..." class="form-control" />
          </div>
          <div class="form-group">
            <label for="item-qty-{item.id}">Quantità / Ore</label>
            <input id="item-qty-{item.id}" type="number" step={UnitsOfMeasureService.getStepForUnit(item.pricingUnit)} min="0" bind:value={item.quantity} class="form-control" />
          </div>
          <div class="form-group">
            <label for="item-price-{item.id}">Prezzo Unitario (€)</label>
            <input id="item-price-{item.id}" type="number" step="any" min="0" bind:value={item.unitPrice} class="form-control" />
          </div>
        </div>

        <div class="item-subtotal">
          <span>Subtotale Voce: <strong>€ {((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</strong></span>
        </div>
      </div>
    {/each}
  </div>

  <div class="items-actions">
    <button type="button" onclick={addItem} class="btn-add-item">➕ Aggiungi Un'Altra Voce</button>
    <div class="grand-total">
      Totale Intervento Stimato: <span>€ {totalAmount.toFixed(2)}</span>
    </div>
  </div>
</div>

<style>
  .card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: var(--shadow-sm);
  }
  .card-title {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .card-subtitle {
    margin: 0 0 16px 0;
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .item-row {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .item-num {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-primary-600);
  }
  .btn-remove-item {
    background: transparent;
    border: none;
    color: var(--color-error);
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 12px;
  }
  .mt-10 {
    margin-top: 10px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .form-control {
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    box-sizing: border-box;
  }
  .item-subtotal {
    text-align: right;
    margin-top: 10px;
    font-size: 13px;
    color: var(--color-neutral-600);
  }
  .items-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .btn-add-item {
    background: var(--color-neutral-100);
    border: 1px dashed var(--color-neutral-400);
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--color-primary-600);
  }
  .btn-add-item:hover {
    background: var(--color-neutral-200);
  }
  .grand-total {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .grand-total span {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
</style>
