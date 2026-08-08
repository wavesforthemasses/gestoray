<script lang="ts">
  let {
    icon: Icon = undefined,
    title = 'Nessun dato trovato',
    subtitle = 'Non ci sono elementi che corrispondono ai filtri o alla ricerca.',
    children
  }: {
    icon?: any;
    title?: string;
    subtitle?: string;
    children?: any;
  } = $props();
</script>

<div class="empty-state-card">
  {#if Icon}
    <div class="empty-icon-box">
      <Icon size={38} color="var(--color-neutral-400)" />
    </div>
  {/if}
  <h3 class="empty-title">{title}</h3>
  <p class="empty-subtitle">{subtitle}</p>
  {#if children}
    <div class="empty-actions">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    background: var(--color-surface, #ffffff);
    border: 1px dashed var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-lg, 12px);
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
  }
  .empty-icon-box {
    margin-bottom: 4px;
  }
  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800, #1f2937);
    margin: 0;
  }
  .empty-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
    max-width: 440px;
    line-height: 1.5;
  }
  .empty-actions {
    margin-top: 8px;
  }
</style>
