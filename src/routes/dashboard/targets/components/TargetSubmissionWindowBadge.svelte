<script lang="ts">
  import type { SubmissionWindowInfo } from '../schema';
  import { Clock, CheckCircle2, Lock } from '@lucide/svelte';

  interface Props {
    windowInfo: SubmissionWindowInfo;
  }

  let { windowInfo }: Props = $props();
</script>

<div class="window-badge {windowInfo.status}">
  {#if windowInfo.status === 'open'}
    <CheckCircle2 size={14} class="icon-open" />
  {:else if windowInfo.status === 'not_yet_open'}
    <Clock size={14} class="icon-pending" />
  {:else}
    <Lock size={14} class="icon-closed" />
  {/if}
  <span class="badge-text">{windowInfo.message}</span>
</div>

<style>
  .window-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .window-badge.open {
    background: rgba(16, 185, 129, 0.1);
    color: #065f46;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .window-badge.not_yet_open {
    background: rgba(245, 158, 11, 0.1);
    color: #92400e;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .window-badge.closed {
    background: rgba(107, 114, 128, 0.1);
    color: #374151;
    border: 1px solid rgba(107, 114, 128, 0.2);
  }

  .icon-open {
    color: #10b981;
  }

  .icon-pending {
    color: #f59e0b;
  }

  .icon-closed {
    color: #6b7280;
  }

  .badge-text {
    line-height: 1.2;
  }
</style>
