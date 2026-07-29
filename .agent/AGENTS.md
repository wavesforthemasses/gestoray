# Gestoray Project-Scoped Rules

## UI & Iconography Design Standards
- **MANDATORY LUCIDE ICONS**: Always use vector icons from `@lucide/svelte` for UI buttons, badges, navigation headers, empty state placeholders, status indicators, and card metrics.
- **NO RAW EMOJIS FOR UI ICONS**: Never use raw OS text emojis (such as 📋, 🔄, 📌, 🛠️, 🎫, 📄, 🌐, ➕, ✏️, 🗑️, 📱, 🖨️) as UI icons. Emojis render inconsistently across operating systems (Linux, macOS, Windows, Android, iOS), lack vector crispness, and cannot inherit dynamic CSS theme palette colors (`currentColor` / `--color-primary`).

## Modular Feature Development & Template-First Workflow
- **MODULAR TEMPLATE FIRST**: For modular features (`products`, `activities`, `contracts`, `interventi`, `tickets`), changes MUST be authored in `scripts/templates/modules/<module_name>/` first.
- **INSTALLATION VERIFICATION**: Always verify changes by testing uninstallation (`npm run module:uninstall -- --name <module>`) and clean installation (`npm run module:install -- --name <module>`), ensuring the module installs, registers, and runs perfectly from template sources without requiring manual post-install fixes.

## Architectural Discipline & Dynamic Bridges
- **MANDATORY LESSONS REVIEW**: Before executing any task or editing code, ALWAYS consult `decisions_and_lessons.md` to ensure complete adherence to architectural principles and prevent regression.
- **DYNAMIC PLUGIN BRIDGES**: Never statically import optional module services in Core or other modules. Always use dynamic conditional imports (`if ($menuConfigStore.some(...)) { const { Service } = await import('...'); }`) to guarantee 100% Core stability when optional modules are uninstalled.

