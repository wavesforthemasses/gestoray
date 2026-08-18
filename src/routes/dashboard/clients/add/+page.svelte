<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { goto } from '$app/navigation';
  import { List, UserPlus } from '@lucide/svelte';
  import ClientAddForm from '../components/ClientAddForm.svelte';

  function handleCreated() {
    goto('/dashboard/clients');
  }
</script>

<svelte:head>
  <title>Nuovo Cliente | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="client-add-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/clients" class="btn-module-list" title="Vai all'elenco clienti" aria-label="Vai all'elenco clienti">
      <List size={20} />
    </a>
    <div class="page-header">
      <h1 class="page-title">
        <UserPlus size={24} /> Registra Nuovo Cliente CRM
      </h1>
      <p class="page-subtitle">Inserisci i dati identificativi, recapiti, sedi operative e condizioni commerciali del cliente.</p>
    </div>
  </div>

  <div class="card form-container-card">
    <ClientAddForm oncreated={handleCreated} />
  </div>
</div>

<style>
  .client-add-page {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-600, #475569);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: var(--color-primary-600, #2563eb);
  }

  .page-header {
    margin-top: 4px;
  }

  .page-title {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-neutral-900, #0f172a);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-subtitle {
    margin: 0.3rem 0 0 0;
    font-size: 0.9rem;
    color: var(--color-neutral-500, #64748b);
  }

  .form-container-card {
    background: white;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  }

  .animate-fade-in {
    animation: fadeIn 0.25s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
