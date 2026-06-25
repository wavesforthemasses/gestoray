---
description: Best practices per la creazione e gestione di un nuovo tipo di contenuto (CRUD), inclusi listing, form di creazione/modifica e servizi backend.
---

# Creazione di un Nuovo Tipo di Contenuto (CRUD)

Questa guida descrive i pattern standard per implementare una nuova entità (es. `Users`, `Identities`) nel sistema, garantendo coerenza nell'UI e nel codice.

## 1. Struttura delle Directory

Ogni entità deve seguire questa struttura all'interno di `src/routes/dashboard/[nome-entità]`:

```text
src/routes/dashboard/[nome-entità]/
├── +page.svelte              # Listing (Tabella/Griglia) con paginazione
├── add/
│   └── +page.svelte          # Pagina di creazione
├── [id]/
│   └── +page.svelte          # Pagina di modifica e cancellazione
├── _components/
│   └── [Entity]Form.svelte   # Componente form riutilizzabile (Add/Edit)
└── schema.ts                 # Validazione Zod e tipi condivisi
```

## 2. Server Actions e Validazione

Per evitare errori `405 Method Not Allowed`, DEVI gestire l'azione POST predefinita nei file `+page.server.ts` (sia per le pagine `add` che `edit`). Questo è richiesto da `superforms` per la validazione lato server.

```typescript
// +page.server.ts
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { entitySchema } from '../schema';

export const load = async () => {
    const form = await superValidate(zod(entitySchema));
    return { form };
};

export const actions = {
    default: async ({ request }) => {
        const form = await superValidate(request, zod(entitySchema));
        if (!form.valid) {
            return fail(400, { form });
        }
        return { form };
    }
};
```

## 3. Definizione dello Schema (`schema.ts`)

Definire sempre lo schema di validazione usando Zod. Questo schema sarà usato sia per la validazione del form (frontend/backend) che per i tipi TypeScript.

```typescript
import { z } from "zod";

// Definizione Schema
export const entitySchema = z.object({
    name: z.string().min(1, "Il nome è obbligatorio").default(""),
    status: z.enum(["active", "inactive"]).default("active"),
    // ... altri campi
});

// Inferenza del Tipo
export type EntitySchema = z.infer<typeof entitySchema>;
```

## 4. Servizio (`src/lib/services/[nome-entità].ts`)

Creare un servizio dedicato per incapsulare la logica Firestore. Usare `FirestorePaginator` per il listing.

```typescript
import { collection, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '$lib/stores/firebase.svelte';
import { FirestorePaginator, type PaginatedResult } from './pagination';

const COLLECTION_NAME = 'entities';

export const EntitiesService = {
    // Listing con paginazione
    async getEntities(lastDoc = null, limitCount = 20) {
        const paginator = new FirestorePaginator(COLLECTION_NAME, limitCount);
        return await paginator.getPage(lastDoc);
    },

    // Get singola
    async getEntity(uid: string) { /* ... */ },

    // Create (usa Cloud Function se necessario auth sync, o addDoc diretto)
    async createEntity(data: any) { /* ... */ },

    // Update
    async updateEntity(uid: string, data: any) { /* ... */ },

    // Delete
    async deleteEntity(uid: string) { /* ... */ }
};
```

## 5. Listing (`+page.svelte`)

Usare il componente condiviso `Listing` per visualizzare i dati in modo consistente. **Qualsiasi testo visibile all'utente deve usare `translate.it`.**

- **Load**: Caricare i dati `onMount`.
- **State**: Usare rune `$state` per `items`, `loading`, `error`.
- **Infinite Scroll**: Implementare `InfiniteScroll` per la paginazione.
- **Layout**: Usare `Row` e `Col` per strutturare header e tabella.

```svelte
<script>
    import { translate } from '$lib/stores/i18n.svelte.js';
    let items = $state([]);
    // ... load logic using EntitiesService
</script>

<Row>
    <Col span="12">
        <PageHeader title={translate.it({ it: 'Entità', en: 'Entities' })} ... >
            <Button href="/dashboard/entities/add">{translate.it({ it: 'Nuovo', en: 'New' })}</Button>
        </PageHeader>
        
        <Listing
            {items} {loading} {error}
            columns={[
                { key: 'name', label: translate.it({ it: 'Nome', en: 'Name' }) },
                { key: 'actions', label: '', align: 'right' }
            ]}
            onRowClick={(item) => goto(`/dashboard/entities/${item.uid}`)}
        >
            {#snippet rowSnippet(item)}
                <!-- Custom Row Content -->
            {/snippet}
        </Listing>
    </Col>
</Row>
```

## 6. Creazione (`add/+page.svelte`)

Usare i componenti `Form` (basato su `superforms`) e `PageHeader`. **Qualsiasi testo visibile all'utente deve usare `translate.it`.**

- **Submit**: Gestire il submit chiamando il servizio (o Server Action).
- **Redirezione**: Usare `goto` dopo il successo.
- **Form Condiviso**: Importare `_components/[Entity]Form.svelte`.
- **Dati Annidati**: Se il form contiene oggetti annidati (es. permessi, array), aggiungere `dataType="json"` a `<Form>`.

```svelte
<script>
    import { translate } from '$lib/stores/i18n.svelte.js';
    const handleUpdate = async ({ form }) => {
        if (form.valid) {
            await EntitiesService.createEntity(form.data);
            goto('/dashboard/entities');
        }
    };
</script>

<Form validators={zod4(entitySchema)} onUpdate={handleUpdate} dataType="json">
   <EntityForm bind:formData={$form} {superform} />
   <!-- Bottoni Salva/Annulla usando translate.it -->
</Form>
```

## 7. Modifica (`[id]/+page.svelte`)

Simile alla creazione, ma con pre-popolamento dei dati. **Qualsiasi testo visibile all'utente deve usare `translate.it`.**

- **Load**: Caricare i dati dell'entità usando `id` dalla pagina (`$page.params.id`).
- **Binding**: Usare `$effect` per aggiornare `formData` quando l'entità viene caricata.
- **Delete**: Implementare la cancellazione con conferma tramite `confirm(translate.it(...))`.

```svelte
<script>
    let entity = $state(null);
    let formData = $state({});

    $effect(() => {
        if (entity) {
            formData = { name: entity.name, ... };
        }
    });
</script>

<!-- Header dinamico: "Edit Entity" o "Loading..." -->
<Form bind:formData ...>
    <EntityForm {superform} />
</Form>
```

## 8. Componente Form (`_components/[Entity]Form.svelte`)

Componente "puro" che contiene solo i campi input. Riceve `superform` come prop. **Qualsiasi testo visibile all'utente deve usare `translate.it`.**

- Usare i componenti UI standard: `TextField`, `Select`, `Switch`, etc.
- Usare `Row` e `Col` per il layout a griglia del form.

```svelte
<script>
    import { translate } from '$lib/stores/i18n.svelte.js';
    let { superform } = $props();
</script>

<Row gap="4">
    <Col span="12" md="6">
        <TextField field="name" label={translate.it({ it: 'Nome', en: 'Name' })} {superform} />
    </Col>
    <Col span="12">
        <Switch field="active" label={translate.it({ it: 'Attivo', en: 'Active' })} {superform} />
    </Col>
</Row>
```
