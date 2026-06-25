---
name: Form Development
description: Best practices for creating forms using the shared Form component system, zod4 validation, and standard layout components.
---

# Form Development Guide

This project uses a standardized form system based on `sveltekit-superforms` and a set of reusable UI components. Follow these guidelines to ensure consistency, type safety, and proper error handling.

## Core Concepts

1.  **Form Component**: The `<Form>` wrapper handles form state, validation, and submission.
2.  **Validation**: Always use `zod` schemas with the `zod4` adapter from `sveltekit-superforms/adapters`.
3.  **Layout**: Use `Row` and `Col` components for structure.
4.  **Error Handling**: Use `<FormErrors>` for form-level messages and built-in field errors for inputs.

## Standard Usage Pattern

### 1. Define Schema (`src/lib/schema.ts`)
Define your Zod schema in a central location.

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});
```

### 2. Page Script
Load data in `+page.server.ts` and pass it to the component.

```svelte
<script lang="ts">
    import { Form, FormErrors, TextField, Button } from "$lib/components/form";
    import { Row, Col } from "$lib/components/layout";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { loginSchema } from "$lib/schema";

    let { data } = $props();
</script>
```

### 3. Component Structure
Use `Row` and `Col` for layout. Bind inner components to the `superform` store.

```svelte
<Form
    data={data.formObject}
    validators={zod4(loginSchema)} {{/* CRITICAL: Use zod4 adapter */}}
    action="?/actionName"
    class="space-y-6"
>
    {#snippet children({ superform, message, delayed })}
        <!-- Global Error/Success Messages -->
        <FormErrors {message} />

        <Row gap="4">
            <Col span="12">
                <TextField
                    field="email"
                    label="Email address"
                    type="email"
                    {superform}
                />
            </Col>
            
            <Col span="12">
                <Button disabled={delayed} class="w-full">
                    {#if delayed}
                        Processing...
                    {:else}
                        Submit
                    {/if}
                </Button>
            </Col>
        </Row>
    {/snippet}
</Form>
```

## Advanced Usage: Custom Submission (e.g., Firebase)

When you need to handle submission client-side (like Firebase Auth) AFTER server-side validation, use the `onUpdate` prop.

### The `onUpdate` Pattern

1.  Server validates data and returns a success message (e.g., "Login info validated").
2.  `onUpdate` callback triggers.
3.  Perform async logic (e.g., `signInWithEmailAndPassword`).
4.  Handle errors by manually setting the `superform.message` store.

```typescript
const handleUpdate = async ({ form, superform }: { form: any, superform: any }) => {
    if (form.valid) {
        try {
            await firebaseAuthAction(form.data.email, form.data.password);
            // Redirect on success
        } catch (error: any) {
            // Manually set error message on the form
            superform.message.set({ 
                status: 401, 
                text: "Invalid credentials" 
            });
        }
    }
};
```

Pass it to the Form:
```svelte
<Form
    ...
    onUpdate={handleUpdate}
>
```

## Layout Components (`$lib/components/layout`)

Always use `Row` and `Col` instead of raw `div`s for grid layouts.

### Row
-   `gap`: "0" | "1" | "2" | ... | "12" (default "12")
-   `items`: "start" | "center" | "end" | "baseline" | "stretch"
-   `justify`: "start" | "center" | "end" | "between" | ...

### Col
-   `span`: 1-12 (default 12)
-   `md`, `lg`: Responsive spans (e.g., `md="6"`)
-   `card`: Boolean to apply card styling (bg-white, shadow, padding)
-   `padding`: Padding size (e.g., "8")

## Checklist
- [ ] Imported `zod4` (NOT `zod`)?
- [ ] Passed `validators={zod4(schema)}` to `<Form>`?
- [ ] Used `Row` and `Col` for layout?
- [ ] Used `<FormErrors {message} />`?
- [ ] Passed `{superform}` to all input components?

## Errors and solutions
- Error: No shape could be created for schema. Solution: Use zod4 adapter instead of zod.