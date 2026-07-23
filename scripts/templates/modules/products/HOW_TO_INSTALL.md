# 📦 Guida di Installazione Manuale: Modulo Prodotti (`products`)

Questa guida spiega come installare manualmente il modulo **Catalogo Prodotti** in qualsiasi codebase SvelteKit / Firebase basata sul Core Framework.

---

## 📋 Passaggi di Installazione

### 1. Copia dei File Fisici
Copia il contenuto della cartella `files/` nella tua applicazione in:
```text
src/routes/dashboard/products/
```

I file inclusi sono:
- `+page.svelte` (Pagina Catalogo Prodotti)
- `products.service.ts` (Servizio Firebase Firestore)
- `products.spec.ts` (Test End-to-End Playwright)
- `components/` (Form e Tabelle Prodotti)

---

### 2. Aggiunta alla Sidebar Navigation (`src/lib/stores/menu.ts`)
Apri il file `src/lib/stores/menu.ts` ed aggiungi la seguente voce all'interno dell'array `DEFAULT_MENU_CONFIG`:

```typescript
{ id: 'products', label: 'Catalogo Prodotti', icon: 'Tag', path: '/dashboard/products', rolesView: ['superadmin', 'amministrazione'] },
```

---

### 3. Configurazione delle Regole Firestore (`firestore.rules`)
Apri il file `firestore.rules` ed incolla il seguente blocco di regole:

```firestore
// PRODUCTS
match /products/{docId} {
  allow read: if isAuth();
  allow write: if isAdmin();
}
```

---

### 4. Verifica
1. Esegui il controllo dei tipi: `npm run check`
2. Avvia la dev app: `npm run dev:emulators`
3. Troverai la nuova voce **Catalogo Prodotti** nella sidebar!
