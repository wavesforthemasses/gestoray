<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField } from '$lib';
  import { Users, Plus, ArrowLeft } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'commerciale') {
        goto('/dashboard');
      }
    });

    fetchClients();
    return () => unsubscribe();
  });

  let clientsList = $state<Array<{ id: string, nome: string, cognome?: string, email?: string, phone?: string, notes?: string[], communications?: any[] }>>([]);
  let loadingClients = $state(true);
  let showAddForm = $state(false);

  // Simple customer creation form state
  let nome = $state('');
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'cognome', header: 'Cognome' },
    { key: 'email', header: 'Indirizzo Email' },
    { key: 'phone', header: 'Telefono' },
    { key: 'notesCount', header: 'Note registrate' },
    { key: 'activitiesCount', header: 'Attività loggate' }
  ];

  async function fetchClients() {
    loadingClients = true;
    try {
      const querySnapshot = await getDocs(collection(db, 'clients'));
      const list: typeof clientsList = [];
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          nome: data.nome,
          cognome: data.cognome,
          email: data.email,
          phone: data.phone,
          notes: data.notes || [],
          communications: data.communications || []
        });
      });
      clientsList = list;
    } catch (e) {
      console.error('Error fetching clients:', e);
    } finally {
      loadingClients = false;
    }
  }

  async function handleCreateClient(e: Event) {
    e.preventDefault();
    if (!nome || !$auth) return;
    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      const clientId = 'client_' + Math.random().toString(36).substring(2, 11);
      const newClient = {
        nome: nome.trim(),
        notes: [],
        communications: [],
        createdBy: $auth.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'clients', clientId), newClient);
      
      // Save initial audit log history
      const historyId = 'audit_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'client_history', historyId), {
        clientId,
        updatedBy: $auth.uid,
        updatedEmail: $auth.email,
        updatedAt: new Date().toISOString(),
        previousState: {},
        currentState: newClient
      });

      successMsg = `Lead per "${nome}" creato con successo!`;
      nome = '';
      showAddForm = false; // Close form
      await fetchClients();
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante la creazione del cliente.';
    } finally {
      submitting = false;
    }
  }

  function handleSelectClient(item: any) {
    goto(`/dashboard/clients/${item.id}`);
  }
</script>

<svelte:head>
  <title>Gestione Clienti CRM | Gestoray</title>
</svelte:head>

<div class="clients-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success animate-fade-in">{successMsg}</div>
  {/if}

  {#if !showAddForm}
    <Card
      title="Anagrafica Clienti CRM"
      description="Database dei contatti e dei lead commerciali. Fai clic su un cliente per vederne i dettagli, le note, e loggare le attività."
      class="list-card"
    >
      {#snippet icon()}
        <Users size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = true; successMsg = ''; errorMsg = ''; }} class="add-client-btn">
          <Plus size={16} /> Aggiungi Cliente
        </button>
      {/snippet}

      {#if loadingClients}
        <div class="loader-box">
          <span class="spinner"></span>
          Caricamento clienti...
        </div>
      {:else}
        {#snippet cell(col: any, row: any)}
          {#if col.key === 'nome'}
            <span class="name-cell">{row.nome}</span>
          {:else if col.key === 'cognome'}
            <span>{row.cognome || 'N/D'}</span>
          {:else if col.key === 'email'}
            <span class="mail-cell">{row.email || 'N/D'}</span>
          {:else if col.key === 'phone'}
            <span>{row.phone || 'N/D'}</span>
          {:else if col.key === 'notesCount'}
            <span class="count-badge">{row.notes?.length || 0}</span>
          {:else if col.key === 'activitiesCount'}
            <span class="count-badge active">{row.communications?.length || 0}</span>
          {/if}
        {/snippet}

        <div class="table-wrapper">
          <Table
            {columns}
            data={clientsList}
            cellSnippet={cell}
            onRowClick={handleSelectClient}
            emptyText="Nessun cliente registrato nel database vendite."
          />
        </div>
      {/if}
    </Card>
  {:else}
    <Card
      title="Aggiungi Nuovo Lead Semplificato"
      description="Crea una scheda cliente inserendo solo il nome. Potrai completare l'anagrafica in fase di contratto."
      class="form-card"
    >
      {#snippet icon()}
        <Users size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = false; successMsg = ''; errorMsg = ''; }} class="back-link">
          <ArrowLeft size={14} /> Annulla e torna all'elenco
        </button>
      {/snippet}

      <form onsubmit={handleCreateClient} class="client-form">
        <FormField id="client-name" label="Nome del Lead / Azienda" helpText="Richiesto per iniziare a loggare attività e note.">
          <input
            type="text"
            id="client-name"
            bind:value={nome}
            placeholder="es. Mario Rossi s.r.l."
            required
            disabled={submitting}
          />
        </FormField>

        <button type="submit" class="submit-btn" disabled={submitting}>
          {#if submitting}
            Salvataggio in corso...
          {:else}
            Crea Scheda Lead
          {/if}
        </button>
      </form>
    </Card>
  {/if}
</div>

<style>
  .clients-page {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-client-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  .add-client-btn:hover {
    opacity: 0.9;
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .name-cell {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .mail-cell {
    color: var(--color-neutral-500);
  }

  .count-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    padding: 2px 6px;
    border-radius: var(--radius-round);
    min-width: 20px;
    text-align: center;
  }

  .count-badge.active {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 30px;
    color: var(--color-neutral-500);
    font-size: 14px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .client-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .submit-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 12px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), 50%, 0.2);
    margin-top: 10px;
    width: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .alert {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
  }

  .alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .alert.success {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
