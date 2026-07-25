<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { projectStore, initProjectStore } from '$lib/stores/project';

  let ticketId = $derived(page.url.searchParams.get('ticketId') || '');
  let clientName = $derived(page.url.searchParams.get('client') || 'Richiedente');
  let appName = $derived($projectStore?.projectName || 'Gestoray');

  onMount(() => {
    initProjectStore();
  });
</script>

<svelte:head>
  <title>Ticket Inviato | {appName}</title>
</svelte:head>

<div class="public-container">
  <div class="success-card">
    <div class="icon-circle">✅</div>
    <h1 class="success-title">Richiesta Inviata con Successo!</h1>
    <p class="success-sub">La tua segnalazione è stata presa in carico dal nostro team di assistenza.</p>

    <div class="ticket-receipt">
      <div class="receipt-row">
        <span>Codice Tracciamento Ticket:</span>
        <strong class="ticket-id">{ticketId}</strong>
      </div>
      <div class="receipt-row">
        <span>Richiedente / Cliente:</span>
        <strong>{clientName}</strong>
      </div>
      <div class="receipt-row">
        <span>Stato Iniziale:</span>
        <span class="status-pill">🔵 Aperto / In Presa in Carico</span>
      </div>
    </div>

    <p class="info-note">Un nostro operatore gestirà la richiesta al più presto. Conserva il codice di tracciamento per eventuali solleciti.</p>

    <a href="/public/tickets" class="btn-new">Apri Un'Altra Segnalazione</a>
  </div>
</div>

<style>
  .public-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
  }

  .success-card {
    background: #ffffff;
    width: 100%;
    max-width: 550px;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    padding: 2.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .icon-circle {
    font-size: 3rem;
    background: #dcfce7;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .success-title {
    font-size: 1.6rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
  }

  .success-sub {
    color: #64748b;
    font-size: 0.95rem;
    margin: 0;
  }

  .ticket-receipt {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.2rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    text-align: left;
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #334155;
  }

  .ticket-id {
    font-family: monospace;
    font-size: 1rem;
    color: #3b82f6;
  }

  .status-pill {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .info-note {
    font-size: 0.85rem;
    color: #64748b;
  }

  .btn-new {
    background: #f1f5f9;
    color: #334155;
    padding: 0.7rem 1.4rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    border: 1px solid #cbd5e1;
    transition: background 0.2s;
  }

  .btn-new:hover { background: #e2e8f0; }
</style>
