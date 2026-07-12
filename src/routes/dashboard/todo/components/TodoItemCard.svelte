<script lang="ts">
  import { formatDate } from '$lib/utils/formatters';
  import { Button } from '$lib';
  import { Calendar, Clock, AlertTriangle, CheckCircle, Check, Play, User } from '@lucide/svelte';
  import type { TodoItem } from '../todo.service';
  import { goto } from '$app/navigation';

  interface Props {
    item: TodoItem;
    activeRole: string | null;
    onPostpone: (contractId: string, installmentId: string, dueDate: string, clientId: string, clientName: string) => void;
    onCollect: (contractId: string, installmentId: string, amount: number) => void;
    onApprove: (contractId: string) => void;
  }

  let {
    item,
    activeRole,
    onPostpone,
    onCollect,
    onApprove
  }: Props = $props();

</script>

<div class="timeline-todo-item border-{item.urgency}" class:is-future={item.type === 'future_payment'}>
  <div class="todo-marker">
    {#if item.urgency === 'high'}
      <span class="urg-badge high"><AlertTriangle size={12} /> Scaduto</span>
    {:else if item.urgency === 'medium'}
      <span class="urg-badge medium"><Clock size={12} /> Da Fare</span>
    {:else}
      <span class="urg-badge low"><Calendar size={12} /> Previsto</span>
    {/if}
  </div>

  <div class="todo-content">
    <div class="todo-title-row">
      <h4>{item.title}</h4>
      {#if item.dueDate}
        <span class="due-date">Scadenza: {formatDate(item.dueDate)}</span>
      {/if}
    </div>
    <p>{item.description}</p>

    <div class="todo-actions-row">
      {#if item.type === 'overdue_payment' || item.type === 'future_payment'}
        {#if activeRole === 'superadmin' || activeRole === 'amministrazione'}
          <Button 
            onclick={() => onPostpone(item.meta.contractId, item.meta.installmentId, item.dueDate || '', item.meta.clientId, item.meta.clientName)} 
            variant="secondary"
          >
            Rimanda / Posticipa
          </Button>
          <Button 
            onclick={() => onCollect(item.meta.contractId, item.meta.installmentId, item.meta.amount)} 
          >
            <Check size={14} /> Registra Incasso
          </Button>
        {:else}
          <Button 
            onclick={() => goto(`/dashboard/clients/${item.meta.clientId}?tab=profile`)} 
            variant="secondary"
          >
            Visualizza Anagrafica
          </Button>
        {/if}
      {:else if item.type === 'pending_approval'}
        {#if activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione'}
          <Button 
            onclick={() => onApprove(item.meta.contractId)} 
          >
            <CheckCircle size={14} /> Approva e Valida Ora
          </Button>
        {/if}
        <Button 
          onclick={() => goto(`/dashboard/contracts/${item.meta.contractId}`)} 
          variant="secondary"
        >
          Dettaglio Contratto
        </Button>
      {:else if item.type === 'prospect_followup'}
        <Button 
          onclick={() => goto(`/dashboard/clients/${item.meta.clientId}`)} 
        >
          <Play size={12} /> Avvia Contratto / Log Attività
        </Button>
      {:else if item.type === 'quote_followup'}
        <Button 
          onclick={() => goto(`/dashboard/clients/${item.meta.clientId}`)} 
        >
          <User size={12} /> Gestisci Preventivi
        </Button>
      {/if}
    </div>
  </div>
</div>

<style>
  .timeline-todo-item {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s;
  }

  .timeline-todo-item:hover {
    transform: translateY(-2px);
  }

  .timeline-todo-item.border-high {
    border-left: 5px solid var(--color-error);
  }

  .timeline-todo-item.border-medium {
    border-left: 5px solid var(--color-warning);
  }

  .timeline-todo-item.border-low {
    border-left: 5px solid var(--color-primary-500);
  }

  .timeline-todo-item.is-future {
    opacity: 0.85;
  }

  .todo-marker {
    display: flex;
  }

  .urg-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .urg-badge.high {
    background: var(--color-error-light);
    color: var(--color-error-text);
  }

  .urg-badge.medium {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }

  .urg-badge.low {
    background: #e0f2fe;
    color: #0369a1;
  }

  .todo-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .todo-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .todo-title-row h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .due-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
  }

  .todo-content p {
    margin: 0;
    font-size: 13.5px;
    color: var(--color-neutral-600);
    line-height: 1.4;
  }

  .todo-actions-row {
    margin-top: 6px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
</style>
