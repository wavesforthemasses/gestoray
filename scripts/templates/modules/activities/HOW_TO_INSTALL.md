# 📦 Guida di Installazione Manuale: Modulo Attività (`activities`)

Questa guida spiega come installare manualmente il modulo **Attività & Log Interazioni** (Frontend + Backend Cloud Functions) in qualsiasi codebase basata sul Core Framework.

---

## 📋 Passaggi di Installazione

### 1. Copia dei File Frontend
- Copia `files/` in `src/routes/dashboard/activities/`
- Copia `extra_routes/settings_activities/` in `src/routes/dashboard/settings/activities/`

### 2. Copia delle Cloud Functions di Backend
- Copia `functions/triggers/onActivityCreated.ts` in `functions/src/triggers/onActivityCreated.ts`

---

### 3. Esporta il Trigger Backend (`functions/index.ts`)
Apri il file `functions/index.ts` ed incolla la seguente riga di export:

```typescript
export { onActivityCreated } from './src/triggers/onActivityCreated';
```

---

### 4. Aggiunta alla Sidebar Navigation (`src/lib/stores/menu.ts`)
Apri `src/lib/stores/menu.ts` ed aggiungi la seguente voce nell'array `DEFAULT_MENU_CONFIG`:

```typescript
{ id: 'activities', label: 'Gestione Attività', icon: 'ClipboardList', path: '/dashboard/activities', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
```

---

### 5. Configurazione delle Regole Firestore (`firestore.rules`)
Apri `firestore.rules` ed incolla il seguente blocco:

```firestore
// ACTIVITIES
match /activities/{docId} {
  allow read: if isAuth();
  allow write: if isAuth();
}
match /activity_types/{docId} {
  allow read: if isAuth();
  allow write: if isAdmin();
}
```

---

### 6. Verifica
1. Esegui il controllo dei tipi: `npm run check`
2. Avvia la dev app: `npm run dev:emulators`
3. Troverai il modulo Attività attivo sia nel Frontend che nel Backend!
