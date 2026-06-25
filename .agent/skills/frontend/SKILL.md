---
description: Best practices for modern, minimalist, and high-performance frontend development using Svelte 5 and Tailwind CSS.
---

# Frontend Best Practices

## Core Philosophy
- **Minimalism**: Write less code to do more. Avoid over-engineering.
- **No Boilerplate**: Use Svelte 5's concise syntax. If you find yourself writing repetitive patterns, abstract them.
- **Component-First**: Build small, reusable, and composable components.
- **Composition over Configuration**: Use children/slots and snippets to compose UIs rather than complex configuration objects or excessive props.

## Svelte 5 & Runes
- **Reactivity**: ALWAYS use Runes (`$state`, `$derived`, `$effect`, `$props`). Purely reactive code is easier to reason about and performant.
    - Use `$state` for mutable local state.
    - Use `$derived` for values that depend on other state. Avoid manual updates or `$:`.
    - Use `$effect` sparingly, primarily for synchronization with external systems (DOM, localStorage, APIs). Do NOT use it for derived state.
- **Props**: Use `$props()` to define strictly typed component props.
    ```svelte
    <script lang="ts">
      let { title, count = 0 }: { title: string; count?: number } = $props();
    </script>
    ```
- **Snippets**: Use `<snippet>` for reusable template parts within a component or passed as props. This replaces `slot` and `let:` directives for cleaner composition.
- **Event Handling**: Prefer standard HTML attributes (`onclick`, `oninput`) over custom event dispatchers (`createEventDispatcher`) where possible. Pass callback functions as props.

## Tailwind CSS & Styling
- **Utility-First**: Use standard Tailwind classes directly in the markup.
- **No @apply**: Avoid using `@apply` in CSS files. Keep styles co-located with markup for maintainability and smaller bundles.
- **Consistency**: Stick to the design system scales (spacing, colors, typography). Avoid magic numbers.
- **Dynamic Classes**: Use a utility function (like `cn` combining `clsx` and `tailwind-merge`) to merge class names safely.
    ```ts
    // lib/utils.ts
    import { type ClassValue, clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';

    export function cn(...inputs: ClassValue[]) {
      return twMerge(clsx(inputs));
    }
    ```
    Usage: `<div class={cn("bg-red-500", className)}>...</div>`

## Component Architecture
- **Single Responsibility**: A component should do one thing well. If it grows too large, break it down.
- **Headless Patterns**: For complex UI logic (modals, dropdowns), separate logic from presentation. Use libraries or custom hooks that handle state/accessibility, and let the component handle the UI.
- **Co-location**: Keep related files (component, types, utils) close together.

## TypeScript
- **Strict Typing**: No `any`. Define interfaces/types for all props and data structures.
- **Generic Components**: Use generics for reusable list/table components to preserve type safety.

## Performance & UX
- **Keys**: Always use keyed `{#each}` blocks: `{#each items as item (item.id)}` to prevent UI bugs and ensure efficient DOM patches.
- **Layout Stability**: Prevent layout shifts (CLS) by defining dimensions for images and containers before content loads.
- **Transitions**: Use Svelte's built-in transitions for smoother UX, but keep them subtle and short.

## Design Guidelines & Theming (Ray Theme)
- **Primary Color**: Orange (`--primary`: 37 91% 60%). Use `text-primary-600` for text and `bg-primary-600` for buttons.
- **Sidebar**: Use semantic `sidebar-*` tokens. `bg-sidebar`, `text-sidebar-foreground`, `hover:bg-sidebar-accent`.
- **Layout**: ALWAYS use the custom `Row` and `Col` components for page layouts to ensure consistent spacing and responsiveness. Avoid the use of any other thing for the grid layout.
    ```svelte
    <Row gap="6">
        <Col span="12" md="4">...</Col>
    </Row>
    ```
- **Cards**: Use the "Glass/Clean" aesthetic:
    - Background: `bg-white dark:bg-zinc-900`
    - Border: `border border-gray-100 dark:border-zinc-800`
    - Shadow: `shadow-sm hover:shadow-md`
    - Rounded: `rounded-2xl`
- **Icons**: Use `phosphor-svelte`.
    - Weight: `duotone` for feature icons (stats), `bold` for smaller UI elements (buttons).
    - Size: Standardize on `16`, `18`, `24`.
- **Typography**:
    - Headers: `font-bold tracking-tight text-gray-900 dark:text-white`.
    - Subtext: `text-gray-500 dark:text-gray-400`.
- **Interactions**:
    - Buttons/Cards: `transition-all duration-300 active:scale-95`.
    - Hover: `hover:-translate-y-1` for cards to add depth.
