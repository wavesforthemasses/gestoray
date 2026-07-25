---
name: Gestoray Reusable Architecture & Shared Utilities Catalog
description: Complete catalog of shared services, utilities, Svelte 5 runes stores, and UI components in Gestoray. All agents MUST consult this before creating new helper functions to prevent duplicate code.
---

# 📚 Gestoray Reusable Architecture & Shared Utilities Catalog

This skill provides a comprehensive index of all generic, reusable modules, services, stores, and components in Gestoray.

---

## 🛠️ 1. Shared Utilities & Helper Functions (`$lib/`)

| Utility Name | File Path | Function / Export Signature | Usage & Problem Solved |
| :--- | :--- | :--- | :--- |
| **Search Terms Generator** | [src/lib/search-utils.ts](file:///home/vincenzo/Code/gestoray/src/lib/search-utils.ts) | `generateSearchTerms(...inputs: string[])` | Generates word-prefix and multi-word phrase combination tokens for Firestore `derived.textSearch` array indexing. |
| **Backend Search Generator** | [functions/src/search-utils.ts](file:///home/vincenzo/Code/gestoray/functions/src/search-utils.ts) | `generateSearchTerms(...inputs: string[])` | Cloud Functions backend twin of `generateSearchTerms` for server-side triggers and functions. |
| **RBAC Access Control** | [src/lib/utils/authCheck.ts](file:///home/vincenzo/Code/gestoray/src/lib/utils/authCheck.ts) | `hasAccess(role: string, allowed: string[])` | Evaluates if a user role matches allowed roles (`superadmin`, `commerciale`, `amministrazione`, etc.). |
| **PDF Vector Exporter** | [src/lib/utils/pdfExport.ts](file:///home/vincenzo/Code/gestoray/src/lib/utils/pdfExport.ts) | `PdfExportService.exportDocumentToPdf(data)` | Formats and triggers native browser vector PDF export / print window for interventions, contracts, and invoices. |
| **Firebase Native SDK** | [src/lib/firebase.ts](file:///home/vincenzo/Code/gestoray/src/lib/firebase.ts) | `db`, `auth`, `storage`, `functions` | Strongly-typed Firebase app initialization without unnecessary wrapper abstractions. |

---

## 🏬 2. Shared Services & Global State Stores (`$lib/services/` & `$lib/stores/`)

| Service / Store | File Path | Export | Purpose & Behavior |
| :--- | :--- | :--- | :--- |
| **Custom Fields Service** | [src/lib/services/customFieldsService.ts](file:///home/vincenzo/Code/gestoray/src/lib/services/customFieldsService.ts) | `CustomFieldsService` | Handles CRUD operations for dynamic PMI custom field definitions per module (`interventi`, `clients`, `tickets`). |
| **Cache Lookup Service** | [src/lib/services/cacheLookupService.ts](file:///home/vincenzo/Code/gestoray/src/lib/services/cacheLookupService.ts) | `CacheLookupService` | Maintains scalable chunked `{ [id]: name }` lookup maps in `system_cache/{type}_chunk_{chunkIndex}` (max 200 items per chunk ~10KB) to prevent Firestore 1MB limits. Eliminates full-document fetches for dropdowns & autocompletes. |
| **Notifications Service** | [src/lib/services/notificationsService.ts](file:///home/vincenzo/Code/gestoray/src/lib/services/notificationsService.ts) | `NotificationsService` | Manages creation and realtime streaming of user notifications in Firestore (`notifications/{id}`). |
| **Tenant Feature Flags** | [src/lib/services/tenantFeatures.service.ts](file:///home/vincenzo/Code/gestoray/src/lib/services/tenantFeatures.service.ts) | `TenantFeaturesService` | Manages module activation/deactivation per tenant in `system_config/tenant_features`. |
| **System Toast Store** | [src/lib/stores/toast.svelte.ts](file:///home/vincenzo/Code/gestoray/src/lib/stores/toast.svelte.ts) | `toastStore` | Global reactive Svelte 5 Toast notification store (`toastStore.addToast(msg, type)`). Replaces native `alert()`. |
| **Network Offline Store** | [src/lib/stores/network.svelte.ts](file:///home/vincenzo/Code/gestoray/src/lib/stores/network.svelte.ts) | `networkState` | Reactive store tracking `online` status (`networkState.isOnline`) to show offline warning banners. |
| **Page Title Store** | [src/lib/stores/page.ts](file:///home/vincenzo/Code/gestoray/src/lib/stores/page.ts) | `pageTitle` | Reactive store to update page title in top navigation bar (`pageTitle.set(...)`). |

---

## 🎨 3. Shared UI Components (`$lib/components/`)

| Component Name | File Path | Props / Binding | Description |
| :--- | :--- | :--- | :--- |
| **`<CustomFieldsRenderer>`** | [src/lib/components/CustomFieldsRenderer.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/CustomFieldsRenderer.svelte) | `moduleName`, `bind:values`, `readonly` | Renders dynamic PMI form fields (text, number, select, date, boolean) or readonly detail cards. |
| **`<NotificationCenter>`** | [src/routes/dashboard/components/NotificationCenter.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/components/NotificationCenter.svelte) | Internal stream | Header bell icon drawer displaying realtime unread notifications with mark-as-read actions. |
| **`<ProjectSetupBlocker>`** | [src/lib/components/ProjectSetupBlocker.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/ProjectSetupBlocker.svelte) | Internal | Overlay modal blocking admin users until project name and email are configured. |
| **`<RoleSelector>`** | [src/lib/components/RoleSelector.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/RoleSelector.svelte) | `bind:selectedRole` | Reusable role selection dropdown for user creation and permission editing. |

---

## 🔒 4. Rule for AI Agents & Developers

1. **Search Before Implementing**: Before writing any helper function (e.g. string slugification, search token generation, toast alerts, role checks), ALWAYS check this catalog.
2. **Generic Location Enforcement**: Any logic used by more than 1 module MUST reside in `$lib/` (frontend) or `functions/src/` (backend). NEVER place shared logic in route-specific folders (`src/routes/dashboard/module/`).
3. **No Duplicate Implementations**: Never create inline variants of `generateSearchTerms`, `hasAccess`, or `toastStore`.
4. **Mandatory Vitest Unit Testing (`npm run test:unit`)**:
   - Every service (`*.service.ts`) or shared utility (`$lib/utils/`) MUST have a corresponding `*.test.ts` file using Vitest.
   - Run `npm run test:unit` after making changes to verify logic correctness before claiming task completion.
   - Note: Playwright E2E browser tests use `*.spec.ts` (`npm run test:e2e`), whereas Vitest unit tests use `*.test.ts`.

---

## ⚡ 5. Mandatory Cache Lookup Pattern for Dropdowns & Autocompletes

Whenever adding a new entity type (`clients`, `vehicles`, `teams`, `tickets`, `qualifications`, etc.) or building a form dropdown / autocomplete:

1. **NEVER fetch full entity collections** for select inputs or dropdowns (e.g. do NOT run `getDocs(collection(db, 'clients'))` to populate an Autocomplete).
2. **ALWAYS use `CacheLookupService.getLookup(type)`**:
   ```typescript
   import { CacheLookupService } from '$lib/services/cacheLookupService';
   const clientOptions = await CacheLookupService.getLookup('clients');
   ```
3. **Save `cacheChunkId` on Entity Documents**:
   When creating or updating an entity, call `updateEntityCache` and save the returned `chunkId` into `derived.cacheChunkId`:
   ```typescript
   const chunkId = await CacheLookupService.updateEntityCache(type, entityId, entityName);
   // Save chunkId inside doc.derived.cacheChunkId for 1-click targeted updates
   ```
4. **Chunking Safeguard**: `CacheLookupService` automatically shards records into chunks of 200 items max (~10KB each), preventing Firestore's 1MB document limit while keeping reads lightweight and cheap.

---

## 🔄 6. Mandatory CLI Template Synchronization Rule

Whenever a new route feature, schema change, UI component, or service integration is made in `src/routes/dashboard/`:

1. **ALWAYS run `npm run template:sync`** before completing the task.
2. This ensures `scripts/templates/modules/` is updated, so module installations (`node scripts/install-module.js`) produce identical, production-ready code.


