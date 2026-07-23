# 📦 Guida di Installazione Manuale: Modulo Incassi (`payments`)

Questa guida spiega come installare manualmente il modulo **Incassi e Pagamenti** (Frontend + Backend Cloud Functions) in qualsiasi codebase basata sul Core Framework.

---

## 📋 Passaggi di Installazione

### 1. Copia dei File Frontend
Copia il contenuto della cartella `files/` nella tua applicazione in:
```text
src/routes/dashboard/payments/
```

### 2. Copia delle Cloud Functions di Backend
Copia i file contenuti in `functions/` nella cartella backend della tua applicazione:
- Copia `functions/triggers/*` in `functions/src/triggers/`

---

### 3. Esporta i Trigger Backend (`functions/index.ts`)
Apri il file `functions/index.ts` ed incolla le seguenti righe di export:

```typescript
export { onPaymentCreated } from './src/triggers/onPaymentCreated';
export { onContractsPaidCreated } from './src/triggers/onContractsPaidCreated';
```

---

### 4. Aggiunta alla Sidebar Navigation (`src/lib/stores/menu.ts`)
Apri `src/lib/stores/menu.ts` ed aggiungi la seguente voce nell'array `DEFAULT_MENU_CONFIG`:

```typescript
{ id: 'payments', label: 'Gestione Incassi', icon: 'Wallet', path: '/dashboard/payments', rolesView: ['superadmin', 'direzione', 'amministrazione'] },
```

---

### 5. Configurazione delle Regole Firestore (`firestore.rules`)
Apri `firestore.rules` ed incolla il seguente blocco:

```firestore
// PAYMENTS
match /payments/{docId} {
  allow read: if isAuth();
  allow write: if isAdmin();
}
```

---

### 6. Verifica
1. Esegui il controllo dei tipi: `npm run check`
2. Avvia la dev app: `npm run dev:emulators`
3. Troverai il modulo Incassi attivo sia nel Frontend che nel Backend!
