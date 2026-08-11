---
name: Chrome CDP Live Screenshot & Navigation Architect
description: Skill for connecting to a live running Google Chrome browser over CDP port 9222, navigating URLs, capturing full-page stitched screenshots, and generating debug metadata JSON. Use this skill whenever taking visual snapshots of pages, testing UI layouts, or capturing live browser evidence.
---

# Chrome CDP Live Screenshot & Navigation Architect

Questa Skill fornisce le istruzioni e gli strumenti per connettersi ad un'istanza di Google Chrome avviata in remoto con porta di debug CDP `9222`, consentendo di:
1. **Navigare** verso qualsiasi rotta dell'applicazione (es. `http://localhost:5173/dashboard/settings/chart`).
2. **Attendere il rendering completo** e l'idratazione reattiva delle componenti Svelte.
3. **Catturare uno Screenshot Full-Page** a pagina intera con scrolling automatico.
4. **Generare un File JSON di Metadata di Debug** con timestamp ISO, URL esatto, titolo della pagina, dimensioni del viewport e dimensioni totali dello scroll.

---

## 🚀 Istruzioni d'Uso

### 1. Avvio di Chrome con Porta CDP 9222 (se non già attivo)
Se Chrome non è ancora avviato con la porta di debug abilitata, eseguire:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=$HOME/.chrome-debug-profile &
```

### 2. Esecuzione dello Script di Navigation & Screenshot

Per navigare ad una rotta specifica e scattare uno screenshot full-page:

```bash
node scripts/screenshot-live.js --url http://localhost:5173/dashboard/settings/chart --wait 2000
```

#### Opzioni Supportate dalla CLI:
- `--url <url>`: URL a cui navigare prima dello screenshot (es. `http://localhost:5173/dashboard/clients`).
- `--wait <ms>`: Tempo di attesa in millisecondi dopo il caricamento per consentire il rendering completo (default: `2000`).
- `--name <nome>`: Nome personalizzato del file di output (es. `chart_settings`).
- `--no-full`: Cattura solo il viewport anziché la pagina intera a scorrimento completo.
- `--cdp <cdp_url>`: URL della porta CDP (default: `http://localhost:9222`).

---

## 📁 Struttura dei File Generati

Gli screenshot ed i relativi metadata vengono salvati automaticamente nella directory `screenshots/`:

1. **Immagine PNG**:
   - `screenshots/screenshot_YYYY-MM-DDTHH-mm-ss.png`
2. **Metadata JSON di Debug**:
   - `screenshots/screenshot_YYYY-MM-DDTHH-mm-ss.json`

### Esempio di Metadata JSON Generato:

```json
{
  "timestamp": "2026-08-10T18:12:30.123Z",
  "url": "http://localhost:5173/dashboard/settings/chart",
  "title": "Impostazioni Centralizzate Grafici & BI | Gestoray ERP",
  "screenshotFile": "/home/vincenzo/Code/gestoray/screenshots/screenshot_2026-08-10T18-12-30.png",
  "dimensions": {
    "viewport": { "width": 1280, "height": 800 },
    "scrollDimensions": { "width": 1280, "height": 1850, "devicePixelRatio": 1 }
  },
  "options": {
    "waitMs": 2000,
    "fullPage": true
  }
}
```
