<script lang="ts">
  let {
    icon: Icon = undefined,
    title,
    subtitle = '',
    actions
  }: {
    icon?: any;
    title: string;
    subtitle?: string;
    actions?: any;
  } = $props();
</script>

<header class="page-header">
  <div class="header-title-box">
    {#if Icon}
      <div class="header-icon">
        <Icon size={24} color="var(--color-primary-600)" />
      </div>
    {/if}
    <div>
      <h1 class="page-main-title">{title}</h1>
      {#if subtitle}
        <p class="page-main-subtitle">{subtitle}</p>
      {/if}
    </div>
  </div>

  {#if actions}
    <div class="header-actions">
      {@render actions()}
    </div>
  {/if}
</header>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 4px;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg, 10px);
    background: var(--color-primary-50, #EEF2FF);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .page-main-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-neutral-900, #111827);
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500, #6B7280);
    margin: 2px 0 0 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
</style>
