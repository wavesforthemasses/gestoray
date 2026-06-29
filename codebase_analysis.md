# Gestoray Codebase Analysis

Welcome to the comprehensive, file-by-file codebase analysis of the Gestoray project. The goal of this document is to inspect every source and configuration file in detail to prepare the repository for refinement, optimization, and perfecting.

---

## 1. Project Configuration & Setup

### [gestoray.config.json](file:///home/vincenzo/Code/gestoray/gestoray.config.json)
* **Purpose**: Project metadata/configuration used for Firebase environment setup and deployment region/location details.
* **Contents**:
  ```json
  {
    "projectId": "gesto-ray",
    "region": "europe-west3",
    "locationId": "europe-west3"
  }
  ```
* **State Management**: N/A (Static configuration file).
* **Firebase Integration**: Directly specifies the project ID (`gesto-ray`) and Cloud Functions / resource hosting region (`europe-west3`, which maps to Frankfurt).
* **UX Structure**: N/A.
* **Safety Audits**: The configuration exposes project IDs and locations, which is standard. Ensure this matches the settings in `.firebaserc` and Cloud console to avoid deploy mismatches.
* **Notes**: Very simple configuration, used by build tools or CLI deployment scripts to target correct regions and projects.

### [firebase.json](file:///home/vincenzo/Code/gestoray/firebase.json)
* **Purpose**: Root-level Firebase configuration file that defines rules for Firestore and Cloud Storage, functions folder setup, and emulator ports.
* **Contents**:
  * Rules location: `firestore.rules` and `storage.rules`.
  * Cloud Functions: Source directory `functions`, using codebase `default`, ignoring standard runtime log files and `node_modules`.
  * Emulators configured: Auth (port 9099), Firestore (port 8080), Functions (port 5001), UI suite (port 4000).
* **State Management**: N/A.
* **Firebase Integration**: The core configuration file for Firebase CLI. Defines the rules mappings and enables testing via local emulators.
* **UX Structure**: N/A.
* **Safety Audits**:
  * Emulators are correctly scoped and set to `singleProjectMode: true` to prevent data leakage across environments.
  * Rules are mapped to external files, preventing rule misconfigurations when deploying.
* **Notes**: The configuration is standard and correct for modern Firebase projects.

### [firestore.rules](file:///home/vincenzo/Code/gestoray/firestore.rules)
* **Purpose**: Security rules file defining read and write permissions for Cloud Firestore database collections.
* **Contents**:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
  ```
* **State Management**: N/A.
* **Firebase Integration**: Determines Firestore authorization constraints globally.
* **UX Structure**: N/A.
* **Safety Audits**:
  * > [!CAUTION]
  * > **CRITICAL SECURITY RISK**: The rules currently allow public read and write access (`allow read, write: if true;`) to ALL documents in the database.
  * > Anyone with the Firestore endpoint/project name can read, modify, or delete any data. This must be restricted to authenticated users or specific roles before moving to production.
* **Notes**: Ideal for early development/testing, but must be refined using proper authentication and path matching.

### [storage.rules](file:///home/vincenzo/Code/gestoray/storage.rules)
* **Purpose**: Security rules configuration file defining access permissions for Cloud Storage files.
* **Contents**:
  ```javascript
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /{allPaths=**} {
        allow read, write: if request.auth != null && 
          firestore.exists(/databases/$(database)/documents/users/$(request.auth.uid));
      }
    }
  }
  ```
* **State Management**: N/A.
* **Firebase Integration**: Directly integrated with Firebase Auth and Firestore to check if the requesting user's UID exists in the `users` collection.
* **UX Structure**: N/A.
* **Safety Audits**:
  * > [!WARNING]
  * > **SYNTAX/COMPILATION ERROR**: The path variable `$(database)` is referenced in `firestore.exists(/databases/$(database)/documents/...)` but is not defined in any `match` block.
  * > In Firebase Storage rules, there is no automatic binding for `database`. To cross-reference Firestore, you must either bind `database` in the match block (if supported by the service configuration) or hardcode it to `(default)` which is the standard database name:
  * > `firestore.exists(/databases/(default)/documents/users/$(request.auth.uid))`
  * If the user doesn't exist in Firestore, read and write are denied. This is a good safety guard, assuming the syntax error is corrected.
* **Notes**: A clever rule design connecting Firestore collection existence with Storage rules, but currently broken due to undefined `database` reference.

### [tsconfig.json](file:///home/vincenzo/Code/gestoray/tsconfig.json)
* **Purpose**: TypeScript configuration file for the SvelteKit application, extending SvelteKit's auto-generated tsconfig.
* **Contents**:
  * Extends: `./.svelte-kit/tsconfig.json` (auto-generated by SvelteKit sync).
  * Compiler options: enables `allowJs` and `checkJs` to check JS files, enables `esModuleInterop`, strict checking (`strict: true`), source mapping, and module resolution using `bundler`.
* **State Management**: N/A.
* **Firebase Integration**: N/A.
* **UX Structure**: N/A.
* **Safety Audits**: Strict mode is enabled (`strict: true`) and JavaScript checking is turned on, which ensures higher type safety.
* **Notes**: Modern config correctly extending SvelteKit's configuration. Path aliases (`$lib`, etc.) are handled automatically by SvelteKit and do not need to be manually defined here.

### [vite.config.ts](file:///home/vincenzo/Code/gestoray/vite.config.ts)
* **Purpose**: Vite bundler config for compiling the SvelteKit frontend app.
* **Contents**:
  * Plugins: uses `@sveltejs/kit/vite` plugin with customized options:
    * `runes`: explicitly set to `true` for all project source files to force Svelte 5 runes mode, except files under `node_modules` (library compatibility).
    * `adapter`: specifies default auto-detecting adapter `@sveltejs/adapter-auto`.
  * SSR details: bundles `@lucide/svelte` and `lucide-svelte` instead of externalizing them during Server-Side Rendering.
* **State Management**: N/A.
* **Firebase Integration**: N/A (Standard Vite configuration).
* **UX Structure**: N/A.
* **Safety Audits**: Force-runes mode ensures strict adherence to modern reactive structures, minimizing reactivity bugs.
* **Notes**: Adapting the bundler to keep Lucide icons inside SSR prevents dehydration mismatches and missing icons in server-generated HTML.

### [package.json](file:///home/vincenzo/Code/gestoray/package.json)
* **Purpose**: Manifest file containing app metadata, dependencies, devDependencies, and custom scripts for SvelteKit and Firebase.
* **Contents**:
  * Dependencies:
    * `firebase`: SDK to connect SvelteKit frontend to Firebase services.
    * `firebase-admin`: Admin SDK used by server routes to bypass security rules or perform elevated operations.
    * `lucide-svelte` / `@lucide/svelte`: Component libraries for UI icons.
  * DevDependencies:
    * `@sveltejs/kit` (v2.63.0) and Svelte (v5.56.1) - modern SvelteKit/Svelte framework.
    * Vite, TypeScript, and svelte-check for validation.
  * Scripts:
    * `npm run dev`: Starts Vite dev server.
    * `npm run build`: Compiles production assets.
    * `npm run preview`: Previews built app.
    * `npm run check`: Performs svelte-check type checks.
    * `npm run emulators`: Starts local Firebase Emulator suite.
* **State Management**: N/A.
* **Firebase Integration**: Hooks up both client SDK (`firebase`) and admin SDK (`firebase-admin`), and defines scripts to run local emulators (`npm run emulators`).
* **UX Structure**: N/A.
* **Safety Audits**:
  * Using both `firebase` and `firebase-admin` is standard in SSR environments (SvelteKit), but developer must be very careful not to import `firebase-admin` in client-side code (should only be imported in server-side load/API routes, i.e. `+server.ts` or `+page.server.ts`).
* **Notes**: Clean configuration. The dependency lists are minimal and well-targeted.

---

## 2. Firebase Functions (Backend)

### [functions/package.json](file:///home/vincenzo/Code/gestoray/functions/package.json)
* **Purpose**: Configuration and dependency file for the Cloud Functions backend environment.
* **Contents**:
  * Node version engine: `"node": "20"` (modern Cloud Functions gen2 requirement).
  * Main entrypoint: `"lib/index.js"` (compiled JS).
  * Dependencies:
    * `firebase-admin` (v13.10.0) - Node admin SDK.
    * `firebase-functions` (v6.3.1) - Cloud Functions SDK.
  * DevDependencies:
    * `typescript` (v5.3.3) for type safety and compilation.
  * Build/deploy scripts:
    * `build`: `tsc` (compiles TS to JS in `lib/` directory).
    * `serve`: `npm run build && firebase emulators:start --only functions`.
    * `start`: Runs compilation and starts all emulators.
    * `deploy`: Deploys only functions to Firebase.
* **State Management**: N/A.
* **Firebase Integration**: Declares the `firebase-functions` and `firebase-admin` SDKs necessary for Cloud Functions deployment.
* **UX Structure**: N/A.
* **Safety Audits**:
  * Targeting Node 20 is optimal as it's the recommended active LTS runtime for Firebase functions.
* **Notes**: Very simple and clean. Dependencies are up to date.

### [functions/tsconfig.json](file:///home/vincenzo/Code/gestoray/functions/tsconfig.json)
* **Purpose**: TypeScript compiler configuration file for the Cloud Functions code.
* **Contents**:
  * Compiler options:
    * `module`: `"commonjs"` (required by Firebase Functions to output standard Node modules).
    * `outDir`: `"lib"` (tells compiler to write transpiled JS into `/lib`).
    * `strict`: `true` (enables all strict type-checking options).
    * `target`: `"es2022"` (transpilation target compatible with Node 20).
    * `noImplicitReturns`: `true` & `noUnusedLocals`: `true` (code hygiene flags).
  * Includes: `"index.ts"` and the `"src"` folder.
* **State Management**: N/A.
* **Firebase Integration**: Directly affects Functions build process (`npm run build`).
* **UX Structure**: N/A.
* **Safety Audits**: Strict type safety ensures compiled functions don't throw runtime TS/type errors inside production logs.
* **Notes**: Very clean. Using commonjs is mandatory because the Firebase backend loader executes function source bundles via standard CommonJS require statements.

### [functions/index.ts](file:///home/vincenzo/Code/gestoray/functions/index.ts)
* **Purpose**: Main entrypoint for Firebase Cloud Functions backend, setting up administration and exporting all function handlers.
* **Contents**:
  * Imports `firebase-admin`.
  * Initialization check: ensures `admin.initializeApp()` is called exactly once if no app exists in `admin.apps`.
  * Modular exports:
    * `sendLoginPin`, `verifyLoginPin` from `./src/auth`
    * `initSuperAdmin`, `updateUser` from `./src/admin`
    * `updateProfile`, `updateProfileEmail` from `./src/profile`
* **State Management**: N/A (Standard functional entrypoint).
* **Firebase Integration**: The central module initialized by the Firebase Cloud Functions runtime to discover deployable handlers.
* **UX Structure**: N/A.
* **Safety Audits**:
  * The check `if (admin.apps.length === 0) { admin.initializeApp(); }` is a best practice. It prevents initialization errors when functions are executed in hot-start or cold-start environments where admin might have already been initialized.
* **Notes**: Simple, modular structure, delegating actual handler implementations to files in `./src/`.

### [functions/src/admin.ts](file:///home/vincenzo/Code/gestoray/functions/src/admin.ts)
* **Purpose**: Implements administrative Callable Functions for initializing the seed superadmin and updating user profiles/roles.
* **Contents**:
  * Region constraint: `REGION = 'europe-west3'` (Europe/Frankfurt).
  * Helper `checkAdminPermissions(callerUid, db)`: verifies if caller has `superadmin` or `amministrazione` role in the Firestore `/users` collection.
  * Function `initSuperAdmin`:
    * Seeds a hardcoded superadmin (`wavesforthemasses@gmail.com`).
    * Checks if user already exists in Firestore. If not, retrieves/creates the user in Auth and sets the Firestore document with role `superadmin`.
  * Function `updateUser`:
    * Expects caller to be authenticated.
    * Verifies permissions using `checkAdminPermissions`.
    * Validates parameters (`uid`, `email`, `roles`, `nome`, `cognome`).
    * Updates Auth email (verifying uniqueness) and writes profile changes to the Firestore document.
* **State Management**: N/A (Stateless Callable Functions).
* **Firebase Integration**: Uses Firebase Admin SDK for Firestore writes (`db.collection('users')`) and Auth operations (`auth.getUserByEmail`, `auth.createUser`, `auth.updateUser`).
* **UX Structure**: Backend operations responding to front-end administrative dashboard triggers.
* **Safety Audits**:
  * > [!IMPORTANT]
  * > **ADMIN AUTHORIZATION BYPASS RISK**: `initSuperAdmin` is publicly callable (unauthenticated). While the target email is hardcoded to `wavesforthemasses@gmail.com`, anyone can trigger this function if the database is uninitialized, creating that user record. To increase security, we could limit invocation to a specific security secret or remove it after seeding.
  * > [!NOTE]
  * > Roles check: Roles are checked using a simple string array comparison (`roles.includes('superadmin') || roles.includes('amministrazione')`). Ensure role values match exactly throughout client and backend.
* **Notes**: Robust implementation using `v2/https` (`onCall`), which handles serialization and authorization contexts cleanly.

### [functions/src/auth.ts](file:///home/vincenzo/Code/gestoray/functions/src/auth.ts)
* **Purpose**: Implements passwordless PIN login flow generating and verifying single-use login PINs.
* **Contents**:
  * Region constraint: `REGION = 'europe-west3'`.
  * Function `sendLoginPin`:
    * Expects an `email` parameter.
    * Verifies that the email exists in Firestore `/users`. If not, throws `not-found`.
    * Generates a 6-digit PIN and expiry timestamp (5 minutes).
    * Saves it to Firestore collection `/login_pins` using the email as document ID.
    * Logs the PIN in production and, if running inside the emulator, returns it as `debugPin` for UI testing.
  * Function `verifyLoginPin`:
    * Expects `email` and `pin`.
    * Compares the PIN with the one stored in `/login_pins`.
    * Validates expiry time, deletes the PIN from the database upon verification.
    * Retrieves the user UID from Firestore, creates a custom authentication token (`createCustomToken(uid)`), and returns it.
* **State Management**: The login PIN state is managed in the Firestore `/login_pins` database.
* **Firebase Integration**: Uses Firestore for PIN storage and checking user emails. Uses Admin SDK Auth (`auth.createCustomToken`) to issue authenticating tokens.
* **UX Structure**: Serves as the backend endpoint for passwordless email verification.
* **Safety Audits**:
  * > [!WARNING]
  * > **MISSING EMAIL SENDING INTEGRATION**: The `sendLoginPin` function generates and stores the PIN, but it **does not send an email** to the user. It only logs it to Cloud Logging (`logger.info(...)`). In a production environment, users would not receive their PINs unless an email provider (such as SendGrid or Postmark) is integrated here.
  * > [!TIP]
  * > Emulator feature: The conditional `debugPin` output when `process.env.FUNCTIONS_EMULATOR === 'true'` is a very clean pattern for developer UX and automated testing.
* **Notes**: Safe and clean verification flow. Deleting the PIN immediately on verification prevents replay attacks.

---

### [functions/src/profile.ts](file:///home/vincenzo/Code/gestoray/functions/src/profile.ts)
* **Purpose**: Implements Callable Functions for users to update their own profiles (name, surname, and email).
* **Contents**:
  * Region constraint: `REGION = 'europe-west3'`.
  * Function `updateProfile`:
    * Expects parameters `uid`, `email`, `nome`, and `cognome`.
    * Requires client authentication and enforces that the caller can only modify their own profile (`request.auth.uid === uid`).
    * Checks email uniqueness in Firestore if the email changes, then updates Auth and Firestore.
  * Function `updateProfileEmail`:
    * Expects parameters `uid` and `newEmail`.
    * Ensures the new email is different from the current email.
    * Checks email uniqueness in Firestore, updates Firestore, and then updates Firebase Auth.
* **State Management**: N/A (Stateless backend functions).
* **Firebase Integration**: Uses Firebase Admin Auth (`auth.updateUser`) and Firestore collections (`users`).
* **UX Structure**: Standard profile setting APIs triggered from the user's dashboard profile view.
* **Safety Audits**:
  * > [!IMPORTANT]
  * > **SECURITY LOCK ENFORCED**: Both functions correctly enforce `request.auth.uid === uid` before making edits, meaning users cannot alter other users' profiles.
  * > [!WARNING]
  * > **API REDUNDANCY**: `updateProfile` already handles email updates along with name/cognome. `updateProfileEmail` does almost the same checks but updates only the email. This is not a security flaw, but represents duplicate logic.
* **Notes**: Safe and clean implementations. Transactional consistency is kept high by modifying Firestore first and then Auth.

---

## 3. SvelteKit Global Setup & Libs

### [src/app.d.ts](file:///home/vincenzo/Code/gestoray/src/app.d.ts)
* **Purpose**: Global TypeScript declaration file for the SvelteKit application.
* **Contents**:
  * Declares the global namespace `App` with placeholders for SvelteKit-specific interfaces (`Error`, `Locals`, `PageData`, `PageState`, `Platform`).
  * Empty default implementation.
* **State Management**: N/A.
* **Firebase Integration**: N/A.
* **UX Structure**: N/A.
* **Safety Audits**:
  * Currently empty. We can add typed properties to `App.Locals` (such as `user` or `role`) if we implement middleware hooks to store authentication state on the server.
* **Notes**: Standard boilerplate generated by Svelte template.

---

### [src/app.html](file:///home/vincenzo/Code/gestoray/src/app.html)
* **Purpose**: The base HTML template file for rendering the SvelteKit frontend.
* **Contents**:
  * Standard viewport metadata.
  * Custom meta tag: `<meta name="text-scale" content="scale" />`.
  * SvelteKit placeholders: `%sveltekit.head%` in `<head>` and `%sveltekit.body%` inside a wrapping `div` (styled as `display: contents`).
  * Body attribute: `data-sveltekit-preload-data="hover"`.
* **State Management**: N/A.
* **Firebase Integration**: N/A (Client SDK initializes dynamically in JS).
* **UX Structure**: Serves as the HTML skeleton. Preloads page code when user hovers over links, improving responsiveness.
* **Safety Audits**:
  * Lang attribute is hardcoded to "en". For localization (e.g. Italian, which seems to be the target audience judging by backend error messages), we could make this dynamic.
* **Notes**: Very standard SvelteKit layout container.

### [src/app.css](file:///home/vincenzo/Code/gestoray/src/app.css)
* **Purpose**: Global stylesheet defining the color tokens, fonts, typography, scrollbars, resets, and element-level default styles.
* **Contents**:
  * Configures HSL variables for dynamic theme customization:
    * Primary brand color: `--brand-h: 211` (dark blue-grey).
    * Secondary accent color: `--sec-h: 38` (warm gold/amber).
    * Neutral tint: `--neutral-s: 8%` (tints grey tones slightly with the brand hue for a cohesive premium look).
  * Uses CSS `calc()` to dynamically generate complete primary/secondary color scales (50 to 900) based on base hue/saturation/lightness values.
  * > [!TIP]
  * > Automatic high-contrast text color resolver: uses `clamp` and math signs to automatically select light vs dark text contrast depending on the lightness index:
  * > `--color-primary-text-contrast: hsl(..., calc(clamp(10%, (var(--brand-l-num) - 50) * -9999%, 95%)));`
  * Implements resets, custom scrollbar styling, standard input/select focuses with glow rings, and responsive button hover transitions.
* **State Management**: CSS Variables define the global visual design tokens.
* **Firebase Integration**: N/A.
* **UX Structure**: Establishes custom Outfit font, smooth transitions, premium typography spacing, and dynamic visual feedbacks (e.g. primary buttons transition into secondary color gradients on hover).
* **Safety Audits**:
  * Custom focus states (`input:focus { outline: none; border-color: ...; box-shadow: ... }`) are properly implemented, maintaining accessibility for keyboard navigation.
  * Contrast formula works beautifully to ensure text readability on dynamic background states.
* **Notes**: Exquisite CSS architecture. The HSL dynamic generation allows transforming the entire app theme simply by changing `--brand-h` or `--sec-h`.

### [src/lib/auth.ts](file:///home/vincenzo/Code/gestoray/src/lib/auth.ts)
* **Purpose**: Manages the client-side authentication state, user profile caching, and role checks.
* **Contents**:
  * Interface `UserProfile`: defines the fields for a user's local profile (`uid`, `email`, `roles`, `nome`, `cognome`, and `qualification`).
  * Store `auth`: a Svelte writable store holding the current `UserProfile` or `null`.
  * Store `activeRole`: a Svelte writable store holding the currently active role string (supporting session-based role changes).
  * Store `has`: a Svelte derived store that returns helper methods checking if the authenticated user has a specific role.
* **State Management**: Uses Svelte 4 legacy stores (`writable`, `derived`). These are fully reactive and work in Svelte 5.
* **Firebase Integration**: Holds the user details loaded after Firebase Auth completes a sign-in operation.
* **UX Structure**: Stores reactive state used by page layouts and route guards to conditionally render UI sections (like showing the "Users" link only for admins).
* **Safety Audits**:
  * > [!IMPORTANT]
  * > **CLIENT-SIDE ROUTE GUARD ONLY**: This file implements client-side state validation. Client-side route guards can be bypassed by users modifying application bundle variables. Any secure operations must also be validated on the server/Firestore side using backend rules or Functions permissions.
  * > [!TIP]
  * > Svelte 5 Runes Refactoring: For Svelte 5 perfection, this file could be refactored using global reactive runes (e.g. `export let auth = $state<UserProfile | null>(null)`) for cleaner syntax and better integration with Svelte 5's compilation model.
* **Notes**: Very clean interface definition and role check helper.

### [src/lib/firebase.ts](file:///home/vincenzo/Code/gestoray/src/lib/firebase.ts)
* **Purpose**: Initializes the Firebase Client SDK for the frontend application and provides a wrapper layer over Firestore, Auth, Storage, and Functions API operations.
* **Contents**:
  * Configures Firebase using Vite environment variables (`import.meta.env.VITE_FIREBASE_...`).
  * Exports initialized services: `auth`, `db` (Firestore), `storage`, and `functions` (restricted to `'europe-west3'`).
  * Connects to local Firebase emulators (Auth, Firestore, Functions) in development mode.
  * Exports wrapped, un-typed Firebase methods (e.g. `doc`, `collection`, `getDoc`, `setDoc`, `query`, `uploadBytes`, `httpsCallable`, `signOut`, etc.) casted `as any`.
  * Implements a custom `updateEmail` helper that invokes the `updateProfileEmail` Callable Cloud Function and reloads the local auth session.
* **State Management**: N/A.
* **Firebase Integration**: The core hub for frontend-to-Firebase interaction.
* **UX Structure**: Enables seamless client-side database reads/writes, authentication, and file uploads.
* **Safety Audits**:
  * > [!WARNING]
  * > **LOSS OF TYPE SAFETY**: Every single wrapper function utilizes `any` types and `as any` casting. This defeats TypeScript's compiler checks for database and authentication objects, exposing components to typos and structural mismatch bugs.
  * > [!TIP]
  * > Refactoring: For codebase perfection, these wrappers should be typed using actual Firebase SDK interface definitions (e.g. `Firestore`, `DocumentReference`, `User`, `Auth`) or bypassed entirely in favor of direct SDK imports where appropriate.
* **Notes**: The `updateEmail` wrapper is well-designed since it encapsulates the necessary Cloud Function call and the client auth session reload in a single helper.

### [src/lib/index.ts](file:///home/vincenzo/Code/gestoray/src/lib/index.ts)
* **Purpose**: Main entrypoint/barrel file exporting shared Svelte UI components and common logic helpers.
* **Contents**:
  * Exports components: `Card`, `Table`, `Pagination`, `FormField`, `RoleSelector`, `LineChart`.
  * Exports utility: `recalculateNNCF` from `./nncf`.
* **State Management**: N/A (Centralized export barrel file).
* **Firebase Integration**: N/A.
* **UX Structure**: Serves as the library collection point. Let pages import UI components easily using `import { Card, Table } from '$lib'`.
* **Safety Audits**:
  * The file ensures clean imports for frontend pages, maintaining directory encapsulation.
* **Notes**: Simple and standard SvelteKit barrel file.

### [src/lib/export-utils.ts](file:///home/vincenzo/Code/gestoray/src/lib/export-utils.ts)
* **Purpose**: Provides client-side data export helpers for generating Excel-compatible files (.csv and .xls) and triggering native browser prints.
* **Contents**:
  * Private helper `escapeValue(val, separator)`: escapes CSV/TSV double quotes and wraps values in double quotes if they contain commas, newlines, or quotes.
  * Exported function `exportToCSV(data, columns, filename)`: converts data arrays to CSV, prepends UTF-8 BOM (`\uFEFF`) to fix Excel characters encoding, and initiates a browser file download.
  * Exported function `exportToExcel(data, columns, filename)`: converts data arrays to tab-separated TSV, prepends UTF-8 BOM (`\uFEFF`), and initiates a `.xls` file download (which Excel reads cleanly without encoding prompts).
  * Exported function `triggerPrint()`: prints the document safely by validating `typeof window !== 'undefined'` (avoiding errors in SvelteKit SSR environment).
* **State Management**: N/A.
* **Firebase Integration**: N/A.
* **UX Structure**: Triggered by user interaction (clicks on "Export" or "Print" buttons in lists or detail pages).
* **Safety Audits**:
  * Memory leak safety: Uses `URL.createObjectURL(blob)` to create transient URLs, but does not call `URL.revokeObjectURL(url)`. In high-frequency operations, this could cause memory bloat. For perfection, it is recommended to call `URL.revokeObjectURL(url)` in a `setTimeout` callback or after trigger completion.
  * Server-Side Rendering compatibility: Correctly guards `window` checks using `typeof window !== 'undefined'` in `triggerPrint`.
* **Notes**: The TSV-to-xls approach is a very smart way to bypass the need for a full Excel parser library while still providing Excel compatibility.

### [src/lib/nncf.ts](file:///home/vincenzo/Code/gestoray/src/lib/nncf.ts)
* **Purpose**: Implements business metric recalculation for clients, specifically the NNCF (first approved order) date and ID.
* **Contents**:
  * Recalculates NNCF for a specific `clientId`.
  * Fetches the client document from Firestore.
  * Fetches **all** contracts from Firestore, filtering them in memory to find client-owned ones.
  * Filters client contracts to find approved ones (`status === 'approved'`).
  * Sorts approved contracts ascending by `createdAt` date to find the oldest contract.
  * Updates the client document with `nncfDate` and `nncfOrderId`.
  * If no approved contracts exist, deletes `nncfDate` and `nncfOrderId` from the client profile.
* **State Management**: N/A.
* **Firebase Integration**: Imports custom helpers from `./firebase` (which wraps client Firestore SDK) to read/write collections `clients` and `contracts`.
* **UX Structure**: Serves as a helper run after a contract is approved or modified, updating the associated client's metadata for metrics.
* **Safety Audits**:
  * > [!CAUTION]
  * > **PERFORMANCE & FIRESTORE BILLING LEAK**: The code fetches **ALL contracts** in the database: `getDocs(collection(db, 'contracts'))` and filters them in-memory by `clientId`.
  * > In a live environment with thousands of contracts, this will trigger thousands of Firestore read billing events for every single recalculation call, causing massive performance lag and expensive Firestore bills.
  * > **Refactoring recommendation**: Replace the in-memory filtering with a Firestore query constraint using `where`:
  * > `query(collection(db, 'contracts'), where('clientId', '==', clientId))`
* **Notes**: Simple business logic recalculator, but critical to optimize database query structure before launch.

---

## 4. Shared Components

### [src/lib/components/Card.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/Card.svelte)
* **Purpose**: A highly customizable layout Card component used to wrap data blocks, forms, or tables with premium spacing and styles.
* **Contents**:
  * Utilizes Svelte 5 runes mode: defines `Props` interface using typed Svelte `Snippet` inputs for child elements, header actions, footer, and leading icons.
  * Captures props using `$props()`.
  * Variants supported:
    * `default`: solid white card with neutral border and soft shadow.
    * `glass`: premium transparent glassmorphism using `backdrop-filter: blur(16px)` and translucent backgrounds.
    * `accent`: adds a vertical primary brand-colored bar on the left edge.
    * `error`: uses red warning background and text for alert boxes.
  * Local CSS styles manage responsiveness, flex direction, shadows, border-radii, and hover scales.
* **State Management**: Uses Svelte 5 Runes `$props()` structure for state propagation.
* **Firebase Integration**: N/A.
* **UX Structure**: Standard structural layout box displaying uniform content groups with subtle micro-animations (transitions on shadows and scales on hover).
* **Safety Audits**:
  * Scoped Svelte styles ensure no class namespace leakage.
  * Accessibility: The component is structural; ensure children contain appropriate ARIA roles if interactive.
* **Notes**: Implementation is extremely neat and fully exploits Svelte 5's snippets (`{@render children()}`), rendering Svelte 4 slot tags obsolete.

### [src/lib/components/FormField.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/FormField.svelte)
* **Purpose**: A reusable form field input wrapper that handles label text, placeholder, validation, help text, and custom input elements (like `<select>` tags).
* **Contents**:
  * Props interface: defines standard input attributes (`id`, `label`, `type`, `value`, `placeholder`, `required`, `disabled`, `helpText`).
  * Utilizes Svelte 5 `$bindable` rune on `value` to support two-way bindings.
  * Extensibility: If a custom child element is passed via the `children` snippet, it renders the custom child using `{@render children()}`. Otherwise, it renders a standard `<input>`.
  * Local styling manages focus glow animations, disabled states, help text sizing, and custom SVG dropdown arrows for select elements.
* **State Management**: Uses Svelte 5 `$props()` and `$bindable()` for reactive two-way data bindings.
* **Firebase Integration**: N/A.
* **UX Structure**: Standardizes all input fields, select boxes, and textareas across the application with uniform styles, height (46px), and focus colors.
* **Safety Audits**:
  * Focus styles are maintained properly for accessibility.
  * Inputs and selects are correctly configured for `disabled` states.
* **Notes**: Very powerful design. Using `children` snippet allows developers to pass custom components or complex elements while still inheriting FormField's label and error/help text containers.

### [src/lib/components/Pagination.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/Pagination.svelte)
* **Purpose**: A pagination controls bar that displays current page number, page switching numbers, and next/prev page buttons.
* **Contents**:
  * Props interface: expects `totalItems` (number), `itemsPerPage` (number), `currentPage` (number), and `onPageChange(page)` handler.
  * Svelte 5 derived runes:
    * `totalPages` calculated using `$derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)))`.
    * `pages` array calculated using `$derived(Array.from({ length: totalPages }, (_, i) => i + 1))`.
  * Visual controls:
    * Prev/Next page navigation buttons containing arrows (`&larr; Prec`, `Succ &rarr;`).
    * Direct page number selection buttons mapped via `{#each pages as p}`.
    * Uses modern Svelte 5 `onclick` syntax: `onclick={() => onPageChange(p)}`.
  * CSS styles active page numbers with primary brand color, and disabled navigation buttons with reduced opacity.
* **State Management**: Uses Svelte 5 `$props()` to read configuration and `$derived()` to automatically recalculate pagination pages when total items or items per page change.
* **Firebase Integration**: N/A.
* **UX Structure**: Standard list table pagination footer, hidden automatically if total page count is <= 1.
* **Safety Audits**:
  * Prev/Next buttons correctly set `disabled` attribute at limits (`currentPage === 1` and `currentPage === totalPages`), preventing index-out-of-bounds callback invocations.
* **Notes**: Uses highly clean and idiomatic Svelte 5 code.

### [src/lib/components/RoleSelector.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/RoleSelector.svelte)
* **Purpose**: A checkbox group component allowing administrators to assign one or multiple roles to users.
* **Contents**:
  * Props interface: expects `selectedRoles` (bindable string array), `disabled` (boolean), `label` (string), and `showDescriptions` (boolean).
  * Predefined roles list `rolesList`:
    * `superadmin`: Accesso completo e gestione utenti.
    * `amministrazione`: Visualizzazione homepage amministrazione.
    * `commerciale`: Visualizzazione homepage commerciale.
    * `direzione`: Visualizzazione homepage direzione.
  * Helper `handleToggle(value)`: checks if a role is already inside the bindable `selectedRoles` array, and toggles it in/out.
  * Uses checkboxes rendered inside an `{#each}` loop, mapping the change event to Svelte 5 `onchange={() => handleToggle(role.value)}`.
  * CSS structures checkboxes in a padded column box with standard margins and borders.
* **State Management**: Implements two-way bindings via Svelte 5 `$bindable([])` for `selectedRoles`, communicating selections back to parent forms automatically.
* **Firebase Integration**: Directly affects user role assignments submitted to backend Firebase Cloud Functions.
* **UX Structure**: Rendered within user registration/modification forms in the administrator panel. Displays inline description summaries if `showDescriptions` is enabled.
* **Safety Audits**:
  * Checked status matches the array elements correctly (`selectedRoles.includes(role.value)`).
  * Correctly supports `disabled` state on individual checkboxes.
* **Notes**: Safe and highly modular. The array toggling is reactive and elegant.

### [src/lib/components/Table.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/Table.svelte)
* **Purpose**: A generic, highly reusable tabular data component displaying custom arrays of items in rows and columns.
* **Contents**:
  * TS Generics: `<script lang="ts" generics="T extends Record<string, any>">` (uses Svelte 5 component generic support).
  * Column definition: `key`, `header`, and `class`.
  * Custom snippet support: accepts optional `cellSnippet` to render custom formatted cells (e.g. status tags, buttons). Falls back to standard string properties (`row[col.key]`).
  * Interactivity: supports row clicking (`onRowClick`), applying visual cursor cues (`cursor: pointer`) and background transitions on hover.
  * Local styling controls table alignment, collapse borders, padding, font sizes (13px), and empty cells messages.
* **State Management**: Uses Svelte 5 `$props()` to receive configurations, data, and click events.
* **Firebase Integration**: N/A.
* **UX Structure**: Renders tabular list representations of clients, payments, products, or contracts throughout the dashboard views.
* **Safety Audits**:
  * Accessibility: Uses `svelte-ignore a11y_click_events_have_key_events` and `svelte-ignore a11y_no_noninteractive_element_interactions` on `<tr>` elements for row clicking.
  * > [!TIP]
  * > **A11Y REFACTORING SUGGESTION**: For better accessibility, if row clicking is enabled, cells should contain actual interactive `<button>` elements or links, or have appropriate ARIA keys to ensure assistive technologies can trigger the action.
* **Notes**: Very clean generic implementation. The `cellSnippet` pattern enables high visual flexibility without duplicating layout code.

### [src/lib/components/LineChart.svelte](file:///home/vincenzo/Code/gestoray/src/lib/components/LineChart.svelte)
* **Purpose**: Renders an interactive, responsive SVG line chart with currency formatting and interactive point filtering.
* **Contents**:
  * Props interface: expects `data` (number array), `labels` (string array), `selectedIdx` (index | null), and `onSelect` selection callback. Optional dimensions (`width`, `height`, `padding`).
  * Derived state calculations:
    * `maxVal`: derived scale maximum to normalize grid coordinates.
    * `points`: derived array of screen coordinates `{ x, y, val }`.
    * `pathD`: SVG path data string generated using `points.reduce` dynamically.
    * `areaD`: SVG polygon fill data string.
  * SVG Markup:
    * Grid lines, path lines, area fill using linear gradient.
    * Linear gradient uses a dynamically generated `gradientId` via `Math.random()` to prevent ID conflicts when rendering multiple charts on the same page.
    * Renders dual circles: a large invisible interactive overlay (`r="12"`) for better pointer/touch targeting, and a smaller visual indicator dot.
  * Local styling manages line stroke widths, dot hover transitions, and active point highlights.
* **State Management**: Uses Svelte 5 `$derived` runes to compute SVG paths dynamically based on data changes.
* **Firebase Integration**: N/A.
* **UX Structure**: Displays billing/contract trends over time on the main dashboard view, allowing users to click individual nodes to filter dashboard lists for that specific month/period.
* **Safety Audits**:
  * > [!IMPORTANT]
  * > **A11Y EXCELLENCE**: Correctly implements accessible keyboard navigation triggers (`onkeydown` with Enter/Space support) and `role="button"` on interactive SVG dots.
* **Notes**: Superb implementation. Custom SVG rendering inside Svelte is faster, lighter, and more maintainable than importing heavy charting libraries (like Chart.js or Recharts).

---

## 5. Root & Layout Routes

### [src/routes/+layout.svelte](file:///home/vincenzo/Code/gestoray/src/routes/+layout.svelte)
* **Purpose**: App-wide SvelteKit root layout wrapper that handles global CSS injection, sets up the favicon, and establishes the Firebase Auth state listener to sync user credentials and role tokens.
* **Contents**:
  * Global imports: `../app.css` and the favicon SVG.
  * Lifecycle: onMount hooks `onAuthStateChanged` listener.
  * Auth sync flow:
    * If firebase user state is detected, queries Firestore path `/users/{uid}`.
    * If Firestore profile exists, sets the client `auth` store with the full user object (uid, email, roles, name, surname, qualification).
    * If profile is missing, logs a warning and stores an empty user wrapper.
    * Dynamically sets `activeRole` session store (defaults to the first role in their role list).
    * Automatically unsubscribes from the Auth listener when unmounted.
  * Renders `%sveltekit.head%` favicon link and page children `{@render children()}`.
* **State Management**: Listens to Auth changes to populate global Svelte stores (`auth`, `activeRole`).
* **Firebase Integration**: The core gateway connecting the client-side Firebase Auth SDK state to custom Svelte application stores.
* **UX Structure**: The root skeleton enclosing all application page vistas, ensuring authentication context is loaded immediately on boot.
* **Safety Audits**:
  * Correctly handles cleanup by returning `unsubscribe()` in Svelte lifecycle.
  * Syncs Firebase Auth email with Firestore database document fields.
* **Notes**: Very clean state sync flow. By using `get(activeRole)`, it respects session state changes if they were already defined.

---

### [src/routes/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/+page.svelte)
* **Purpose**: Root index page that acts as an authentication traffic controller, redirecting users to the dashboard or login page depending on their authentication status.
* **Contents**:
  * Lifecycle: onMount subscribes to client `auth` store.
  * Navigation: uses SvelteKit's `goto` to redirect:
    * Authenticated user (`$auth !== null`) -> `/dashboard`.
    * Unauthenticated user (`$auth === null`) -> `/login`.
  * Visuals: Displays a premium fullscreen loading loader page with a spinning CSS spinner and "Reindirizzamento in corso..." label during transition.
  * Head details: `<title>Gestoray</title>`.
* **State Management**: Subscribes to client `auth` store and handles reactive redirection.
* **Firebase Integration**: Directly depends on the Auth state derived from the root layout listener.
* **UX Structure**: Serves as the landing page, handling redirection so quickly that users usually see the loading spinner for less than 150ms before landing on their destination.
* **Safety Audits**:
  * Correctly returns the unsubscribe callback in onMount to prevent store subscription leaks.
* **Notes**: Simple and robust redirection wrapper.

### [src/routes/init/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/init/+page.svelte)
* **Purpose**: Database initialization (seeding) page that invokes the `initSuperAdmin` Cloud Function to seed the initial Superadmin.
* **Contents**:
  * Reactive state:
    * `status`: manages view status (`"idle"`, `"loading"`, `"success"`, `"error"`).
    * `message`: stores response messages from the server.
  * Async action `handleInit`: triggers the unauthenticated Callable `initSuperAdmin` Cloud Function, handling transitions.
  * Head definition: sets title "Setup Iniziale | Gestoray" and imports Outfit Google font files.
  * UX Structure: Full-screen setup portal displaying background glows, logo header, current seeding email context, and a CTA button. Displays spinner during seeding and status notifications (with redirect link to login on success).
* **State Management**: Uses Svelte 5 `$state` runes to store local rendering state.
* **Firebase Integration**: Connects to Callable Functions using the `httpsCallable` client SDK helper.
* **Safety Audits**:
  * Anyone visiting this URL can initiate the Superadmin user setup, but the target email is hardcoded (`wavesforthemasses@gmail.com`). Repeated runs return `already-exists` database error.
* **Notes**: Simple setup seeding wrapper, built using standard Svelte 5 structures.

### [src/routes/login/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/login/+page.svelte)
* **Purpose**: Login page displaying a passwordless 2-step verification form where users request a 6-digit access PIN via email and then enter it to sign in.
* **Contents**:
  * Reactive state:
    * `email`, `pin`: binds input fields values.
    * `currentStep`: determines step 1 (request PIN) or step 2 (verify PIN).
    * `errorMessage`, `loading`: views status controls.
    * `localPinNotification`: stores emulator PIN for easy testing.
  * Async action `handleSendPin(e)`: invokes Callable function `sendLoginPin` to generate/save PIN, then proceeds to step 2.
  * Async action `handleVerifyPin(e)`: invokes Callable function `verifyLoginPin` to verify PIN. On success, receives a Firebase Custom Auth Token and logs in using `signInWithCustomToken(clientAuth, customToken)`.
  * Head definition: sets title "Login | Gestoray" and imports Outfit Google font files.
  * UX Structure: Modern card portal displaying background glows, brand logo, validation alert banner, and inputs.
    * Custom styling: step 2 styles the PIN input box with spaced, large text and center alignment (`letter-spacing: 0.5em; text-align: center; font-size: 20px; font-weight: 600;`).
* **State Management**: Uses Svelte 5 `$state` runes for page variables.
* **Firebase Integration**: Directly references client Firebase Auth (`signInWithCustomToken`) and calls backend Cloud Functions (`sendLoginPin`, `verifyLoginPin`).
* **UX Structure**: Serves as the gateway login portal. Includes helpful animations (`bounce` for emulator code alert box, `fade-in` for validation notifications).
* **Safety Audits**:
  * PIN input leverages HTML5 validation constraints: `maxlength="6"` and `pattern="[0-9]{6}"` (forces numeric 6-digit pins).
* **Notes**: The local PIN helper (`debugPin` alert display) makes local testing of passwordless login exceptionally easy, eliminating the need to read backend emulator terminal prints manually.

---

## 6. Dashboard Vistas (Pages & Subpages)

### [src/routes/dashboard/+layout.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+layout.svelte)
* **Purpose**: Dashboard shell layout providing navigation menus, responsive mobile drawers, session role switching, and layout boundaries.
* **Contents**:
  * Navigation links: Dashboard, To-Do, Clients, Activities, Contracts, Payments, Products, Users, Profile.
  * Sign out: `handleLogout()` signs out client-side and redirects to `/login`.
  * Collapsible sidebar:
    * `isCollapsed` toggles and stores status in `localStorage` to persist across reloads.
  * Role switcher: If the user possesses multiple roles (`$auth.roles.length > 1`), displays a dropdown selector bound to `$activeRole`. This recalculates available navigation paths in real time.
  * Layout navigation guards:
    * Clients list requires: `commerciale`, `superadmin`, `direzione`.
    * Activities & Contracts require: `commerciale`, `amministrazione`, `superadmin`, `direzione`.
    * Payments (Incassi) requires: `amministrazione`, `superadmin`, `direzione`.
    * Products require: `amministrazione`, `superadmin`.
    * Users management requires: `superadmin`.
  * Navbar displays dynamic title headers depending on `$page.url.pathname` and emulator connectivity status.
* **State Management**: Uses Svelte 5 `$state` runes for UI toggles (`isCollapsed`, `isMobileOpen`), and subscribes to auth stores (`$auth`, `$activeRole`) for navigation rules.
* **Firebase Integration**: Hooks sign-out calls to Firebase Auth.
* **UX Structure**: Standard dashboard layout structure. Supports full responsiveness, transition animations, sidebar collapse states, mobile backdrop overlays, and a pulsing status indicator.
* **Safety Audits**:
  * > [!IMPORTANT]
  * > **CLIENT-SIDE ACCESS CONTROLS ONLY**: Navigation elements are shown or hidden based on `$activeRole` store checking. However, if a user navigates to direct links or alters Javascript variables, Svelte client routing will load the pages. These guards must be complemented by server-side load queries, API validations, and Firestore rules.
* **Notes**: The multi-role switcher selector represents a very strong design capability, letting admins or managers switch roles to audit comercial or administrative views dynamically.

---

### [src/routes/dashboard/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/+page.svelte)
* **Purpose**: Main administrative and commercial dashboard rendering stats summaries, trends, and list drill-downs customized by role.
* **Contents**:
  * Dual-layout dashboards:
    * **Amministrazione role**: Displays pending contract approval list (approves via direct link navigation) and a debt-collector/late-payment list ("Rate Overdue") showing overdue installments.
    * **Commerciale / Management roles**: Displays financial performance indicators (totals, maturated and pending commissions calculated with co-selling splits and qualification levels) and activity graphs.
  * Analytical Charting:
    * Implements `LineChart` and handles tab selections (VSS, GI, leads, NNCF, activities).
    * Customizes date parameters and granularity (weekly, monthly, yearly).
    * Integrates interactive drill-down filtering: clicking any node on the line chart displays detailed lists of items in that time slot, supporting filters by client, product, or salesman.
* **State Management**: Heavily utilizes Svelte 5 `$state` and `$derived.by` runes to calculate analytical totals, list filters, and SVG path coordinates dynamically based on dataset changes.
* **Firebase Integration**: Performs batch queries (`Promise.all`) to fetch `clients`, `contracts`, `payments`, `users`, and `activities` collections on mount.
* **UX Structure**: Primary portal workspace featuring card components, grids, lists, spinners, responsive layouts, and interactive charts.
* **Safety Audits**:
  * > [!CAUTION]
  * > **PERFORMANCE & FIRESTORE BILLING RISK**: The component downloads **all documents** for 5 entire Firestore collections on mount (`Promise.all([getDocs(collection(...)), ...])`). As the database grows to thousands of items, this will trigger thousands of Firestore billing reads on every dashboard page load, causing severe memory bloat and application lag.
  * > **Refactoring recommendation**: Move statistical calculations to serverless Cron aggregates or utilize Firestore query limits/pagination instead of client-side reduce loops on the entire database.
* **Notes**: An exceptionally feature-rich dashboard with a highly detailed co-selling calculation formula that handles commissions accurately.

### [src/routes/dashboard/activities/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/activities/+page.svelte)
* **Purpose**: Activities log listing page that lets sales reps and managers search, view, and chart logged touchpoints with customers (calls, meetings, appointments, and administrative payment collection warnings).
* **Contents**:
  * Role authorization guards: Restricts access to `superadmin`, `commerciale`, `amministrazione`, or `direzione`.
  * Expandable Trend Chart:
    * Collapsible line chart section displaying activity frequencies. Persists expand state in `localStorage` (`subpage_graph_expanded`).
    * Configures granularity, metrics tabs, and end dates.
  * Filters pane:
    * Search query (matches notes, clientName, or loggedEmail) and activity type tabs.
    * Allows filtering data list by clicking specific periods in the line chart.
  * Data Representation:
    * Generates custom table columns dynamically. If logged-in user has the `commerciale` role, hides the "Eseguito Da" column to protect sales privacy.
    * Feeds filtered activities data to Svelte 5 generic `<Table>` component, using `cellSnippet` to render styled badges (`badge-tel` for calls, `badge-inc` for meetings, `badge-app` for appointments) and client info tags.
* **State Management**: Uses Svelte 5 `$state` runes for UI switches, filters, and search inputs. Uses `$derived.by` to dynamically calculate column arrays, chart trends, and list filtering.
* **Firebase Integration**: Fetches the entire `activities` collection on mount.
* **UX Structure**: Svelte page following the general dashboard theme. Integrates smooth fade-in animations on components load.
* **Safety Audits**:
  * > [!WARNING]
  * > **DATA SCOPE FILTERING RISK**: In `filteredActivities`, commercial sales reps are restricted client-side to only view their own touchpoints (`result = result.filter(a => a.loggedBy === $auth.uid)`). However, since the database fetching query `getDocs(collection(db, 'activities'))` retrieves the **entire** company activities collection, a malicious or curious sales agent could bypass the filter in Javascript console and view client logs they don't own.
  * > **Refactoring recommendation**: Enforce query constraints on the Firestore query level rather than checking IDs client-side, combined with Firestore collection security rules.
* **Notes**: The column toggling and chart expand state preservation make for an excellent user experience.

### [src/routes/dashboard/clients/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/+page.svelte)
* **Purpose**: Client registry catalog showing prospects and customers, providing data exports, creation forms with uniqueness checks, and expandable performance graphs.
* **Contents**:
  * Role authorization guards: Restricts access to `superadmin`, `commerciale`, `amministrazione`, or `direzione`.
  * Expandable Trend Chart:
    * Collapsible line chart section displaying client statistics. Persists expand state in `localStorage` (`subpage_graph_expanded`).
    * Configures granularity, metrics tabs (Nuove Anagrafiche, NNCF, Valore Venduto, Incassato), and end dates.
    * Allows list filtering based on the selected graph coordinate month.
  * Form creation layout:
    * Fields: Company Name, Fiscal ID, Email, Phone, Partita IVA, Codice Fiscale.
    * Uniqueness query: verifies if `fiscalId` already exists in `/clients` collection before writing to database.
    * Audit trail: when creating a customer, sets doc in `/clients/{client_id}` and automatically saves a state change snapshot record in `/client_history/{audit_id}`.
  * Data exports: Renders buttons to download active filtered client dataset as CSV/Excel files, or open print preview via client utility triggers.
  * Component implementation: Passes data to Svelte 5 generic `<Table>` component, using `cellSnippet` to render funnel status badges (prospect, contacted, proposal_sent, customer, churned).
* **State Management**: Binds form input fields to local `$state` variables. Uses `$derived.by` to filter and map active client arrays.
* **Firebase Integration**: Resolves parallel collections (`clients`, `contracts`, `payments`, `activities`) on boot. Performs checks on `fiscalId` via Firestore query constraints.
* **UX Structure**: Standard list table layout with slide-out client registration form view. Displays alert banners on success or database errors.
* **Safety Audits**:
  * > [!WARNING]
  * > **DATA SCOPE FILTERING RISK**: Just like activities, commercial reps are filtered client-side (`c.createdBy === myUid`) while the page downloads the **entire** company database of clients, contracts, payments, and activities on load. This is a severe information leak and performance issue.
  * > **Audit tracking**: Creation records are tracked securely in `client_history`.
* **Notes**: Excellent CSV/Excel export implementation. Client-side duplication verification on the Fiscal ID field prevents corrupt duplicate entries.

---

### [src/routes/dashboard/clients/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/[id]/+page.svelte)
* **Purpose**: Client detail dashboard page coordinating child tab views (profile details, activity tracking, and quote preventivatore builder) and saving modifications with audit diff logging.
* **Contents**:
  * Tab Selector: Coordinates switching between `"profile"`, `"activities"`, and `"quotes"` views.
  * Profile modifications:
    * Supports editing Company Name, Referent, Email, Phone, Funnel status, Fiscal ID, Partita IVA, Codice Fiscale.
    * Validates `fiscalId` uniqueness against the other clients' documents in Firestore.
    * If modifications are logged, compares values against the loaded `originalProfile` and saves a change diff dictionary in `/client_history`.
    * Access restriction: if active role is `direzione`, edits are disabled, enforcing original read-only data fields.
  * Activity logging:
    * Submits immediate touchpoint notes (calls, meetings, or demo appointments). Triggers transitions in customer funnel status from `prospect` to `contacted`.
    * Supports inline customer comment note attachments.
  * Quote builder preventivatore:
    * Adds products from catalog, sets manual prices sold, and quantity parameters.
    * Highlights price warnings if price sold drops below product minimum threshold.
    * Supports co-selling: salesman can select another representative `secondVendorUid` and assign a commission split percentage `secondVendorShare` (defaults to 30%).
    * Converts draft quote builder items to a `pending` approval contract.
* **State Management**: Uses Svelte 5 `$state` runes for form properties and loading flags. Uses `$derived` to calculate active quote totals.
* **Firebase Integration**: Fetches client document first. Fetches `products`, `quotes`, `activities`, `client_history`, `contracts`, and `users` collections in parallel on startup.
* **UX Structure**: Split tab dashboard with details view panels. Includes timeline glowing anchors.
* **Safety Audits**:
  * > [!CAUTION]
  * > **CRITICAL READ BILLING LEAK**: Downloads **all documents** for 6 separate collections in parallel (`quotes`, `activities`, `client_history`, `contracts`, etc.) and filters them in-memory by client UID. On a production system, this will download thousands of unrelated clients' files on every single client detail page click.
  * > **Refactoring recommendation**: Refactor parallel queries using Firestore `.where('clientId', '==', clientId)` filters instead of unconstrained `getDocs(collection(...))` calls.
* **Notes**: The history change tracking with old vs new diff values saved in `client_history` is a highly robust data governance design.

---

### [src/routes/dashboard/clients/[id]/components/ClientActivitiesTab.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/[id]/components/ClientActivitiesTab.svelte)
* **Purpose**: Sub-component tab rendering client log forms and a combined timeline history of notes and logged activities.
* **Contents**:
  * Props Interface: expects `activitiesList`, `clientNotes`, `clientCreatedAt`, `newlyCreatedId`, two-way `$bindable()` values (`activityNotesText`, `appointmentDateTime`), and action triggers.
  * Form views:
    * **Activity logger**: Displays note text box and log buttons. If user active role is `amministrazione`, renders recovery warnings button logs (Sollecito Telefonico, Sollecito Email, Sollecito PEC); otherwise renders standard commercial logs (Telefonata, Incontro, Appuntamento).
    * **Notes logger**: Form to log text comments.
    * Access restriction: If user active role is `direzione`, both logger forms are hidden.
  * Combined Timeline:
    * Merges `activitiesList` (dates, authors, types, notes) and `clientNotes` (JSON parsed comment strings) into a single unified timeline array sorted by date descending.
    * Leverages Svelte 5 `@const` declaration inside markup to compute the sorted array.
    * Highlights newly created timeline nodes using a CSS `.glow` animation wrapper.
* **State Management**: Uses Svelte 5 `$bindable()` for quick note textbox and appointment date selections.
* **Firebase Integration**: Indirectly connects to Firestore through parent callbacks.
* **UX Structure**: Timeline workflow featuring color-coded badges, timestamps, author email tags, and glowing animations.
* **Safety Audits**:
  * Accessibility: Form fields use appropriate HTML labels and descriptions.
* **Notes**: The local `@const` sorting pattern inside Svelte markup is highly efficient. The glowing CSS card effect provides excellent visual confirmation.

---

### [src/routes/dashboard/clients/[id]/components/ClientProfileTab.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/[id]/components/ClientProfileTab.svelte)
* **Purpose**: Sub-component tab rendering client profile data edit inputs and a visual audit changes log trail history.
* **Contents**:
  * Props Interface: expects two-way `$bindable()` client details fields, arrays (`usersList`, `historyList`), loading/role states, and parent update callback.
  * Form inputs:
    * Fields: Company Name, Referent, Email, Phone, Fiscal ID, funnel status select dropdown, Partita IVA, and Codice Fiscale.
    * Enforces `disabled` state on fields if loading or if user active role is `direzione` (which enforces read-only fields).
    * Reassign Consultant: Displays a dropdown selection list to reassign the client owner. This dropdown is restricted to `superadmin`, `amministrazione`, or `direzione` roles, preventing standard salesmen from reassigning customer cards.
  * Audit Trail:
    * Loops through `historyList` of edits.
    * For each modification log, displays the editor email, timestamp, and a list of delta fields.
    * Renders changed values side-by-side, displaying old value in a red strikethrough layout (`old-val`) and new value in green bold (`new-val`).
* **State Management**: Uses Svelte 5 `$bindable()` for all client properties.
* **Firebase Integration**: Indirectly connects to Firestore through parent callbacks.
* **UX Structure**: Standard details card layout, incorporating custom CSS styles for diffs, audit trails, and input grids.
* **Safety Audits**:
  * Role restriction on lead owner assignment is correctly enforced on the view level.
* **Notes**: The side-by-side strikethrough vs bold green representation of modified values provides a premium and extremely intuitive audit trail view.

---

### [src/routes/dashboard/clients/[id]/components/ClientQuotesTab.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/clients/[id]/components/ClientQuotesTab.svelte)
* **Purpose**: Sub-component tab rendering the preventivatore quote calculator, saved drafts history cards, and emitted contracts lists.
* **Contents**:
  * Props Interface: expects lists, bindable inputs for quote builder (selectedProductId, price, qty, items array, co-selling split values), totals, and callbacks.
  * Preventivatore Calculator Form:
    * Select product catalog dropdown.
    * Real-time minimum price threshold validation: displays an inline warning if price is edited below minimum catalog price, and flags the item with a red `SOTTO SOGLIA` warning banner.
    * Co-selling: selector dropdown to assign a secondary sales rep and specify their split percentage.
    * Actions: CTA buttons to save quote as draft draft or convert to contract immediately.
  * Saved Drafts list: Displays previously computed quote cards, allowing salesmen to convert them to active contracts.
  * Emitted Contracts registry: Lists all contract documents emitted for this client, displaying ID codes, creation dates, total pricing, status badges, price warning flags, and navigation links.
  * Access restriction: If active role is `direzione`, hide preventivatore builder forms and contract conversion actions.
* **State Management**: Connects inputs to parent using Svelte 5 `$bindable()`.
* **Firebase Integration**: N/A (handled via parent callbacks).
* **UX Structure**: Grid form controls, styled tables, warning badges, co-selling panels, and history lists.
* **Safety Audits**:
  * Form inputs use appropriate validation attributes.
* **Notes**: Robust implementation. The minimum price warning checks are visually striking, helping prevent human error in pricing.

---

### [src/routes/dashboard/contracts/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/+page.svelte)
* **Purpose**: Contracts catalog registry page displaying commercial deal listings, salesman commissions aggregations, and performance trend charts.
* **Contents**:
  * Role authorization guards: Restricts access to `superadmin`, `amministrazione`, `commerciale`, or `direzione`.
  * Commercial Rep KPIs:
    * Displays cards listing Provvigioni Maturate (Commissions earned on approved contracts) and Provvigioni Sospese (Commissions pending approval on pending contracts) taking co-selling splits into account.
  * Expandable Trend Chart:
    * Collapsible line chart graphing contract statistics. Persists expand state in `localStorage` (`subpage_graph_expanded`).
    * Configures granularity, metrics tabs (Valore Venduto, Provvigioni), and end dates.
    * Allows list filtering by clicking point nodes in the chart.
  * Filter Tabs switcher:
    * Renders tabs: Tutti (All), In Attesa (Pending), Approvati (Approved), and Provvigioni Consulenti (Consultants commissions list).
    * **Provvigioni Consulenti** tab: restricted to management/admin roles (`$activeRole !== 'commerciale'`). Compares qualification levels (junior vs senior formulas) and co-selling splits (primary vs secondary splits) to calculate active approved sales, comissions earned, and pending sales totals for each salesperson.
  * Data exports: Supports exporting contracts data to CSV/Excel formats or opening print previews.
  * Component implementation: Renders list items using Svelte 5 generic `<Table>` component, using `cellSnippet` to render styled approval status badges (with warning icons if items are sold below catalog minimum pricing).
* **State Management**: Uses Svelte 5 `$state` runes for UI selections and tab filters. Uses `$derived.by` to filter datasets and compute active consultant summaries.
* **Firebase Integration**: Fetches `users` and `contracts` collections in parallel on startup.
* **UX Structure**: Standard dashboard layout incorporating cards, metrics summaries, tables, warning badges, and exporting controls.
* **Safety Audits**:
  * > [!WARNING]
  * > **DATA SCOPE FILTERING RISK**: In-memory vendorUid filters are applied client-side to commercial sales reps, while the query fetches the **entire** contracts collection in bulk. Unprivileged salesmen could view other sales reps' contract prices and comissions by altering Javascript variables.
  * > **Refactoring recommendation**: Enforce Firestore query where constraints to limit retrieved records on database level.
* **Notes**: The management summary panel summarizing sales and comissions per consultant is an extremely useful feature for auditing commercial performance.

---

### [src/routes/dashboard/contracts/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/contracts/[id]/+page.svelte)
* **Purpose**: Contract detail dashboard page providing product profitability warning banners, co-selling split summaries, administrative validation controls, and active installment payment collection forms (with built-in Italian VAT tax calculators).
* **Contents**:
  * Role authorization guards: Restricts access to `superadmin`, `amministrazione`, `commerciale`, or `direzione`.
  * Under-minimum pricing warning box: Displays a bold red banner if any product list price is discounted below the minimum catalogue threshold, calculating profit margins and gap details.
  * Summary Cards:
    * **Info panel**: Details parties involved (client, salesman qualification) and approval states (with auditor logs).
    * **Totals panel**: Shows gross value, calculated linear commission, and co-selling splits (primary vs secondary splits).
    * **Products table**: Lists items, quantity, subtotal, and margin.
  * Administrative validations:
    * If contract is pending, admin/managers can click "Approva e Incassa" to validate the deal, save a full-price payment, set client to `customer` status, and trigger NNCF script.
  * Late-payment Recovery & Installment planner:
    * Lists payment installments. Highlights overdue items (`status === 'pending'` and past due dates) with a red alert and `SOLLECITARE CLIENTE!` prompt.
    * Allows admins to postpone installment dates (triggers a logged call reminder).
    * Allows admins to add new payment milestones.
    * Segna Incassato: opens a pop-up modal to register actual collections, with a "Scorpora IVA" button to automatically strip 22% Italian VAT (`actualAmount / 1.22`).
* **State Management**: Uses Svelte 5 `$state` runes for UI modal pop-ups and form input fields.
* **Firebase Integration**: Fetches contract document `/contracts/{id}`, then retrieves salesman profile `/users/{uid}`. Updates contracts, payments, clients, and activities collections.
* **UX Structure**: Standard detail panels layout, including co-selling split tables, color margin cells, and floating pop-up modals.
* **Safety Audits**:
  * Implements precise floating point decimal conversions for scorporo IVA (`parseFloat((actualAmount / 1.22).toFixed(2))`).
* **Notes**: The installment VAT-stripper utility is a highly practical business feature that streamlines local bookkeeping.

### [src/routes/dashboard/payments/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/payments/+page.svelte)
* **Purpose**: Payments ledger page displaying previous cash collections, reporting financial trends, and hosting new payment recording forms (with Scorpora IVA calculator utilities).
* **Contents**:
  * Role authorization guards: Restricts access to: `superadmin`, `amministrazione`, or `direzione`. Other roles are redirected to `/dashboard`.
  * Expandable Trend Chart:
    * Collapsible line chart section graphing payments received (`computedChartPoints`). Persists expand state in `localStorage` (`subpage_graph_expanded`).
    * Configures granularity, and allows list filtering based on the clicked point coordinate period.
  * Form registration layout:
    * Select client dropdown. Once selected, derives `clientContracts` options to choose from.
    * Select contract dropdown. Sets `amountInput` to the contract totalPrice automatically.
    * Scorpora IVA: Renders a button to divide selected amount by 1.22 to extract the taxable net amount on the fly.
    * CTA: Saves payment doc `/payments/{pay_id}`, sets contract status to `approved`, sets client status to `customer`, and runs NNCF recalculation script.
  * Component implementation: Renders lists using Svelte 5 generic `<Table>` component, using `cellSnippet` to render Net amounts, timestamps, contract IDs, and recorder emails.
  * Data exports: Supports exporting payments data to CSV/Excel formats or opening print previews.
* **State Management**: Uses Svelte 5 `$state` runes for UI switches, selected values, and loading. Uses `$derived` to calculate active client contracts.
* **Firebase Integration**: Fetches `payments`, `clients`, and `contracts` collections in parallel on startup.
* **UX Structure**: Standard dashboard layout incorporating cards, select inputs, tables, and exporting controls.
* **Safety Audits**:
  * > [!CAUTION]
  * > **PERFORMANCE & FIRESTORE BILLING RISK**: Downloads the **entire** payments, clients, and contracts collections on startup. If the company accumulates thousands of cash collections, this will trigger massive reads, slow down loading, and spike database bills.
  * > **Refactoring recommendation**: Move to pagination or serverless aggregated statistics.
* **Notes**: The VAT-stripper utility is extremely handy for bookkeeping.

### [src/routes/dashboard/products/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/products/+page.svelte)
* **Purpose**: Product catalogue catalogue page enabling managers to configure prices and set discount floor thresholds.
* **Contents**:
  * Role authorization guards: Restricts access to: `superadmin` or `amministrazione`. Other roles are redirected to `/dashboard`.
  * Product catalogue listing:
    * Displays products list in Svelte 5 generic `<Table>` component, using `cellSnippet` to render Name, list price, and minimum price (styled in red `min-price`).
    * Deletion: Clicking the trash button triggers `handleDeleteProduct(id)` with a confirm dialogue prompt.
  * Form registration layout:
    * Fields: Name, List Price, and Minimum Price (under which price warnings will trigger).
    * Validation: checks that `minPrice <= listPrice`.
    * CTA: Saves new document `/products/{prod_id}`.
* **State Management**: Uses Svelte 5 `$state` runes for UI switches, selected values, and loading.
* **Firebase Integration**: Fetches `products` collection on startup.
* **UX Structure**: Standard catalog table layout, using cards, form grids, and action buttons.
* **Safety Audits**:
  * Form fields use appropriate type and step validation attributes.
* **Notes**: Simple and robust catalogue administration view.

### [src/routes/dashboard/profile/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/profile/+page.svelte)
* **Purpose**: Personal user settings page allowing logged-in clerks to edit their profile details.
* **Contents**:
  * Sync states: Uses a Svelte 5 `$effect` to mirror auth store details (email, nome, cognome) to form bindings when the user session shifts.
  * Form inputs:
    * Displays user UID code and assigned account roles in read-only visual style.
    * Editable inputs: First Name, Last Name, and Email address.
    * Enables CTA button only when inputs differ from the auth store values.
  * Submissions: Dispatches profile updates via Cloud Functions (`updateProfile`), updates local auth store, and renders success messages.
* **State Management**: Uses Svelte 5 `$state` runes for text input values and `$effect` for mirroring store data.
* **Firebase Integration**: Connects to Cloud Functions HTTPS callable SDK.
* **UX Structure**: Centered single settings card containing input fields, disabled views, and status boxes.
* **Safety Audits**:
  * User UID and Role changes are correctly disabled on the client-side to enforce privilege separation.
* **Notes**: Clean and standard profile configuration card.

### [src/routes/dashboard/todo/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/todo/+page.svelte)
* **Purpose**: Role-based smart To-Do checklist page dynamically compiling pending tasks, contract validations, and late-payment alerts.
* **Contents**:
  * Role authorization guards: Requires a valid logged-in session, otherwise redirects to `/login`.
  * Dynamic Checklist generator:
    * Automatically compiles checklist items based on active user role and ownership:
      * **Pending Approvals (`pending_approval`)**: High urgency. Contracts in `pending` status. Restricted to `superadmin`/`amministrazione`/`direzione`.
      * **Overdue Payments (`overdue_payment`)**: High urgency. Installments inside pending contracts with `dueDate < today`.
      * **Prospects Follow-up (`prospect_followup`)**: Medium urgency. Client cards in `prospect` funnel status or containing zero communications. Owner rep only.
      * **Proposal Sent Follow-up (`quote_followup`)**: Medium urgency. Client cards in `proposal_sent` status. Owner rep only.
      * **Future Planned Payments (`future_payment`)**: Low urgency. Installments with `dueDate >= today`.
    * Sorting: Groups checklist cards by urgency descending (High > Medium > Low), then by due date ascending.
  * Checklist CTAs and Actions:
    * Postpone Installment: Admin/amministrazione can delay installment due dates.
    * Registra Incasso: Opens modal to register actual collections, with a "Scorpora IVA" button to automatically strip 22% Italian VAT (`actualAmount / 1.22`).
    * Approva e Valida: Admin/amministrazione can approve pending contract directly from checklist card.
    * Navigation buttons: Leads commercial reps to corresponding client details sub-tabs.
* **State Management**: Uses Svelte 5 `$state` runes for modal pop-ups, selections, and values. Uses Svelte 5 `$derived.by` to generate and sort the todo items array dynamically.
* **Firebase Integration**: Fetches `clients`, `contracts`, `payments`, `activities`, and `users` collections in parallel on startup.
* **UX Structure**: Timeline workflow featuring color-coded urgency badges, description snippets, date tags, and control modals.
* **Safety Audits**:
  * > [!CAUTION]
  * > **PERFORMANCE & FIRESTORE BILLING RISK**: Downloads the **entire** database content (5 separate collections in parallel) on page load, filtering everything client-side. Under scaled business loads, this will download thousands of documents, dragging performance and causing high Firebase read expenses.
  * > **Refactoring recommendation**: Refactor using Firestore server-side queries.
* **Notes**: The checklist generation rules are extremely elegant, providing a centralized hub where administrators and commercial reps can process all business actions.

### [src/routes/dashboard/users/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/+page.svelte)
* **Purpose**: System users directory and creation page restricted to the superadmin role.
* **Contents**:
  * Role authorization guards: Restricts access to: `superadmin` only. Other roles are redirected to `/dashboard`.
  * Users pagination directory listing:
    * Displays registered users in Svelte 5 generic `<Table>` component, using `cellSnippet` to render Name, Surname, Email, and assigned roles (rendered as role tags).
    * Connects to generic `<Pagination>` to split lists.
  * Form registration layout:
    * Fields: First Name, Last Name, Email, Consultant qualification (junior/senior), and `RoleSelector` checkbox list.
    * Validation:
      * Renders validation alert if email already exists in users list.
      * Verifies at least one role is checked.
    * CTA: Saves new user profile document `/users/{uid}`.
* **State Management**: Uses Svelte 5 `$state` runes for text input values and page numbers. Uses Svelte 5 `$derived` for slicing users list into active pages.
* **Firebase Integration**: Fetches `users` collection on load. Updates documents inside `/users`.
* **UX Structure**: Standard directory layout featuring search toggles, form grids, pagination rows, and styled role badges.
* **Safety Audits**:
  * Input forms use appropriate type, required, and disabled bindings.
* **Notes**: Simple and robust user catalog and setup dashboard.

### [src/routes/dashboard/users/[id]/+page.svelte](file:///home/vincenzo/Code/gestoray/src/routes/dashboard/users/[id]/+page.svelte)
* **Purpose**: User detail and role permissions config dashboard restricted to the superadmin role.
* **Contents**:
  * Role authorization guards: Restricts access to: `superadmin` only. Other roles are redirected to `/dashboard`.
  * Detail fields:
    * Displays target user's UID and creation date in read-only visual style.
    * Form inputs: First Name, Last Name, Email, and Consultant qualification dropdown (defines commercial commission rates).
    * `RoleSelector` checklist allowing superadmins to enable/disable specific system privileges.
  * Submissions: Dispatches updates via Cloud Functions (`updateUser`) to safely mutate authentication records and database values. Renders status boxes.
* **State Management**: Uses Svelte 5 `$state` runes for text input values and loading.
* **Firebase Integration**: Fetches target user document `/users/{id}` on startup. Connects to HTTPS Cloud Functions SDK.
* **UX Structure**: Standard settings card layout featuring back links, form grids, selector items, and action rows.
* **Safety Audits**:
  * User UID and creation timestamp are correctly disabled to prevent manual alteration.
* **Notes**: Safe and robust role and permission configuration module.

---
