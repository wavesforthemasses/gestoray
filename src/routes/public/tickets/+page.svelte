<script lang="ts">
  import { onMount } from 'svelte';
  import { TicketsService } from '../../dashboard/tickets/tickets.service';
  import { TicketSettingsService, type TicketCategoryConfig } from '$lib/services/ticketSettings';

  let email = $state('');
  let subject = $state('');
  let description = $state('');
  let category = $state('Generale');
  let categories = $state<TicketCategoryConfig[]>([]);

  let loading = $state(false);
  let successMsg = $state('');
  let errorMsg = $state('');

  onMount(async () => {
    try {
      const config = await TicketSettingsService.getSettings();
      categories = config.categories;
      if (categories.length > 0) category = categories[0].label;
    } catch (e) {
      console.error('Errore caricamento categorie ticket:', e);
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!email || !subject) return;

    loading = true;
    errorMsg = '';
    successMsg = '';

    try {
      const ticketNum = `TCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await TicketsService.createTicket({
        ticketNumber: ticketNum,
        clientName: email,
        requesterEmail: email,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority: 'media',
        status: 'aperto',
        channel: 'portale'
      });

      successMsg = `Ticket ${ticketNum} inviato con successo! Ti risponderemo al più presto.`;
      subject = '';
      description = '';
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante l\'invio del ticket.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="public-ticket-container animate-fade-in">
  <div class="ticket-card card">
    <h2 class="title">🎫 Portale Assistenza Clienti</h2>
    <p class="subtitle">Invia una richiesta di supporto ed il nostro team tecnico se ne prenderà cura.</p>

    {#if successMsg}
      <div class="alert success">{successMsg}</div>
    {/if}

    {#if errorMsg}
      <div class="alert error">{errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="form">
      <div class="form-group">
        <label for="email">Indirizzo Email *</label>
        <input id="email" type="email" bind:value={email} required placeholder="tua@email.it" class="form-control" />
      </div>

      <div class="form-group">
        <label for="cat">Categoria Richiesta</label>
        <select id="cat" bind:value={category} class="form-control">
          {#each categories as c}
            <option value={c.label}>{c.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="sub">Oggetto della Segnalazione *</label>
        <input id="sub" type="text" bind:value={subject} required placeholder="es. Problema di connessione o guasto" class="form-control" />
      </div>

      <div class="form-group">
        <label for="desc">Descrizione Dettagliata</label>
        <textarea id="desc" bind:value={description} rows="4" placeholder="Descrivi in dettaglio la richiesta..." class="form-control"></textarea>
      </div>

      <button type="submit" disabled={loading} class="btn-submit">
        {loading ? 'Invio in corso...' : '📩 Invia Richiesta Assistenza'}
      </button>
    </form>
  </div>
</div>

<style>
  .public-ticket-container { max-width: 600px; margin: 40px auto; padding: 0 16px; }
  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 32px; box-shadow: var(--shadow-md); }
  .title { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: var(--color-neutral-900); }
  .subtitle { margin: 0 0 24px 0; font-size: 14px; color: var(--color-neutral-500); }

  .form { display: flex; flex-direction: column; gap: 16px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }
  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); outline: none; width: 100%; box-sizing: border-box; }

  .btn-submit { padding: 12px; font-size: 15px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; margin-top: 8px; }
  .alert { padding: 12px 16px; border-radius: var(--radius-md); font-weight: 600; margin-bottom: 16px; }
  .success { background: #dcfce7; color: #15803d; }
  .error { background: #fee2e2; color: #991b1b; }
</style>
