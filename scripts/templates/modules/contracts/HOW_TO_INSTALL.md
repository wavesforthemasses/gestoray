# 📦 Guida di Installazione Manuale: Modulo Contratti (`contracts`)

Questa guida spiega come installare manualmente il modulo **Contratti** (Frontend + Backend Cloud Functions) in qualsiasi codebase basata sul Core Framework.

---

## 📋 Passaggi di Installazione

### 1. Copia dei File Frontend
Copia il contenuto della cartella `files/` nella tua applicazione in:
```text
src/routes/dashboard/contracts/
```

### 2. Copia delle Cloud Functions di Backend
Copia i file contenuti in `functions/` nella cartella backend della tua applicazione:
- Copia `functions/triggers/*` in `functions/src/triggers/`

---

### 3. Esporta i Trigger Backend (`functions/index.ts`)
Apri il file `functions/index.ts` ed incolla le seguenti righe di export:

```typescript
export { onContractCreated } from './src/triggers/onContractCreated';
export { onContractUpdated } from './src/triggers/onContractUpdated';
export { onInstallmentWrite } from './src/triggers/onInstallmentWrite';
```

---

### 4. Aggiunta alla Sidebar Navigation (`src/lib/stores/menu.ts`)
Apri `src/lib/stores/menu.ts` ed aggiungi la seguente voce nell'array `DEFAULT_MENU_CONFIG`:

```typescript
{ id: 'contracts', label: 'Gestione Contratti', icon: 'FileText', path: '/dashboard/contracts', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
```

---

### 5. Configurazione delle Regole Firestore (`firestore.rules`)
Apri `firestore.rules` ed incolla il seguente blocco:

```firestore
// CONTRACTS
match /contracts/{docId} {
  allow read: if isAuth();
  allow write: if isAdmin();
}
```

---

### 6. Verifica
1. Esegui il controllo dei tipi: `npm run check`
2. Avvia la dev app: `npm run dev:emulators`
3. Troverai il modulo Contratti attivo sia nel Frontend che nel Backend!
