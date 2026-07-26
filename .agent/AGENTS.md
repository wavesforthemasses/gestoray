# Gestoray Project-Scoped Rules

## UI & Iconography Design Standards
- **MANDATORY LUCIDE ICONS**: Always use vector icons from `@lucide/svelte` for UI buttons, badges, navigation headers, empty state placeholders, status indicators, and card metrics.
- **NO RAW EMOJIS FOR UI ICONS**: Never use raw OS text emojis (such as 📋, 🔄, 📌, 🛠️, 🎫, 📄, 🌐, ➕, ✏️, 🗑️, 📱, 🖨️) as UI icons. Emojis render inconsistently across operating systems (Linux, macOS, Windows, Android, iOS), lack vector crispness, and cannot inherit dynamic CSS theme palette colors (`currentColor` / `--color-primary`).

## Modular Feature Development & Template-First Workflow
- **MODULAR TEMPLATE FIRST**: For modular features (`products`, `activities`, `contracts`, `interventi`, `tickets`), changes MUST be authored in `scripts/templates/modules/<module_name>/` first.
- **INSTALLATION VERIFICATION**: Always verify changes by testing uninstallation (`npm run module:uninstall -- --name <module>`) and clean installation (`npm run module:install -- --name <module>`), ensuring the module installs, registers, and runs perfectly from template sources without requiring manual post-install fixes.
