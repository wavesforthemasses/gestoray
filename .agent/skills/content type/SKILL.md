---
description: Best practices for creating and managing a new content type (CRUD), including listing, add/edit forms, and backend services.
---

# Creating a New Content Type (CRUD)

This guide describes the standard patterns for implementing a new entity (e.g., `Users`, `Identities`) in the system, ensuring consistency in UI and code.

## 1. Directory Structure

Each entity must follow this structure within `src/routes/dashboard/[entity-name]`:

```text
src/routes/dashboard/[entity-name]/
├── +page.svelte              # Listing (Table/Grid) with pagination
├── add/
│   └── +page.svelte          # Creation page
├── [id]/
│   └── +page.svelte          # Edit and deletion page
├── _components/
│   └── [Entity]Form.svelte   # Reusable form component (Add/Edit)
└── schema.ts                 # Zod validation and shared types
```

## 2. Server Actions and Validation

To avoid `405 Method Not Allowed` errors, you MUST handle the default POST action in your `+page.server.ts` files (both for `add` and `edit` pages). This is required by `superforms` for server-side validation.

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

## 3. Schema Definition (`schema.ts`)

Always define the validation schema using Zod. This schema will be used for both form validation (frontend/backend) and TypeScript types.

```typescript
import { z } from "zod";

// Schema Definition
export const entitySchema = z.object({
    name: z.string().min(1, "Name is required").default(""),
    status: z.enum(["active", "inactive"]).default("active"),
    // ... other fields
});

// Type Inference
export type EntitySchema = z.infer<typeof entitySchema>;
```

## 4. Service (`src/lib/services/[entity-name].ts`)

Create a dedicated service to encapsulate Firestore logic. Use `FirestorePaginator` for listings.

```typescript
import { collection, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '$lib/stores/firebase.svelte';
import { FirestorePaginator, type PaginatedResult } from './pagination';

const COLLECTION_NAME = 'entities';

export const EntitiesService = {
    // Listing with pagination
    async getEntities(lastDoc = null, limitCount = 20) {
        const paginator = new FirestorePaginator(COLLECTION_NAME, limitCount);
        return await paginator.getPage(lastDoc);
    },

    // Get single
    async getEntity(uid: string) { /* ... */ },

    // Create (use Cloud Function if auth sync is needed, or direct addDoc)
    async createEntity(data: any) { /* ... */ },

    // Update
    async updateEntity(uid: string, data: any) { /* ... */ },

    // Delete
    async deleteEntity(uid: string) { /* ... */ }
};
```

## 5. Listing (`+page.svelte`)

Use the shared `Listing` component to display data consistently. **Always use `translate.it` for user-facing strings.**

- **Load**: Load data `onMount`.
- **State**: Use Svelte 5 runes `$state` for `items`, `loading`, `error`.
- **Infinite Scroll**: Implement `InfiniteScroll` for pagination.
- **Layout**: Use `Row` and `Col` to structure the header and table.

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

## 6. Creation (`add/+page.svelte`)

Use the `Form` component (based on `superforms`) and `PageHeader`. **Always use `translate.it` for user-facing strings.**

- **Submit**: Handle submission by calling the service (or Server Action).
- **Redirection**: Use `goto` after success.
- **Shared Form**: Import `_components/[Entity]Form.svelte`.
- **Nested Data**: If your form has nested objects (e.g., permissions, arrays), add `dataType="json"` to `<Form>`.

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
   <!-- Save/Cancel Buttons using translate.it -->
</Form>
```

## 7. Edit (`[id]/+page.svelte`)

Similar to creation, but with data pre-population. **Always use `translate.it` for user-facing strings.**

- **Load**: Load entity data using `id` from the page (`$page.params.id`).
- **Binding**: Use `$effect` to update `formData` when the entity is loaded.
- **Delete**: Implement deletion with confirmation using `confirm(translate.it(...))`.

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

<!-- Dynamic Header: "Edit Entity" or "Loading..." -->
<Form bind:formData ...>
    <EntityForm {superform} />
</Form>
```

## 8. Form Component (`_components/[Entity]Form.svelte`)

A "pure" component containing only input fields. Receives `superform` as a prop. **Always use `translate.it` for user-facing strings.**

- Use standard UI components: `TextField`, `Select`, `Switch`, etc.
- Use `Row` and `Col` for form grid layout.

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
