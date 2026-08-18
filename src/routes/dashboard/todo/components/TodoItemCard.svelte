<script lang="ts">
  import { formatDate } from '$lib/utils/formatters';
  import { Button } from '$lib';
  import { Calendar, Clock, AlertTriangle } from '@lucide/svelte';
  import type { TodoItem } from '../todo.service';

  interface Props {
    item: TodoItem;
  }

  let { item }: Props = $props();
</script>

<div class="timeline-todo-item border-{item.urgency}">
  <div class="todo-content">
    <div class="todo-title-row">
      <div class="title-with-badge">
        {#if item.urgency === 'high'}
          <span class="urg-badge high"><AlertTriangle size={12} /> Scadenza / Alta</span>
        {:else if item.urgency === 'medium'}
          <span class="urg-badge medium"><Clock size={12} /> Da Fare</span>
        {:else}
          <span class="urg-badge low"><Calendar size={12} /> Previsto / Bassa</span>
        {/if}
        <h4>{item.title}</h4>
      </div>
      {#if item.dueDate}
        <span class="due-date">Data: {formatDate(item.dueDate)}</span>
      {/if}
    </div>
    <p>{item.description}</p>

    <div class="todo-actions-row">
      {#if item.link}
        <Button href={item.link}>
          Gestisci
        </Button>
      {:else if item.meta?.clientId}
        <Button href={`/dashboard/clients/${item.meta.clientId}`}>
          Vedi Cliente
        </Button>
      {/if}
    </div>
  </div>
</div>

<style>
  .timeline-todo-item {
    position: relative;
    padding: 16px 20px;
    background: var(--bg-card);
    border-radius: var(--radius-md);
    margin-bottom: 12px;
    border-left: 4px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .timeline-todo-item:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .border-high {
    border-left-color: #ef4444;
  }

  .border-medium {
    border-left-color: #f59e0b;
  }

  .border-low {
    border-left-color: #10b981;
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .urg-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .urg-badge.high {
    background: #fee2e2;
    color: #991b1b;
  }
  .urg-badge.medium {
    background: #fef3c7;
    color: #b45309;
  }
  .urg-badge.low {
    background: #dcfce7;
    color: #15803d;
  }

  .todo-content h4 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-color);
  }

  .todo-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  .due-date {
    font-size: 0.82rem;
    color: var(--text-muted);
    font-weight: 500;
    background: var(--bg-hover);
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .todo-content p {
    margin: 0 0 14px 0;
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .todo-actions-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
</style>
