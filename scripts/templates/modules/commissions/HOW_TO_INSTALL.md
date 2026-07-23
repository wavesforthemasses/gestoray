# 📦 Guida di Installazione Manuale: Modulo Provvigioni (`commissions`)

Questa guida spiega come installare manualmente il modulo **Provvigioni Agenti** (Frontend + Backend Cloud Functions) in qualsiasi codebase basata sul Core Framework.

---

## 📋 Passaggi di Installazione

### 1. Copia dei File Frontend
- Copia `files/` in `src/routes/dashboard/commissions/`
- Copia `extra_routes/my-commissions/` in `src/routes/dashboard/my-commissions/`
- Copia `extra_routes/settings_commissions/` in `src/routes/dashboard/settings/commissions/`

### 2. Copia delle Cloud Functions di Backend
- Copia `functions/commissions.ts` in `functions/src/commissions.ts`
- Copia `functions/triggers/retryFailedSyncs.ts` in `functions/src/triggers/retryFailedSyncs.ts`

---

### 3. Esporta le Funzioni Backend (`functions/index.ts`)
Apri il file `functions/index.ts` ed incolla le seguenti righe di export:

```typescript
export { generateCommissionsCalculation } from './src/commissions';
export { retryFailedSyncs } from './src/triggers/retryFailedSyncs';
```

---

### 4. Aggiunta alla Sidebar Navigation (`src/lib/stores/menu.ts`)
Apri `src/lib/stores/menu.ts` ed aggiungi le seguenti voci nell'array `DEFAULT_MENU_CONFIG`:

```typescript
{ id: 'my-commissions', label: 'Le Mie Provvigioni', icon: 'Award', path: '/dashboard/my-commissions', rolesView: ['commerciale'] },
{ id: 'commissions', label: 'Gestione Provvigioni', icon: 'Award', path: '/dashboard/commissions', rolesView: ['superadmin', 'direzione', 'amministrazione'] },
```

---

### 5. Configurazione delle Regole Firestore (`firestore.rules`)
Apri `firestore.rules` ed incolla il seguente blocco:

```firestore
// COMMISSIONS
match /commissions/{docId} {
  allow read: if isAuth();
  allow write: if isAdmin();
}
```

---

### 6. Verifica
1. Esegui il controllo dei tipi: `npm run check`
2. Avvia la dev app: `npm run dev:emulators`
3. Troverai il modulo Provvigioni attivo sia nel Frontend che nel Backend!
