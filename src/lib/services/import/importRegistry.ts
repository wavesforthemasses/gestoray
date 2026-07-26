import type { ImportModuleSpec } from '$lib/types/importTypes';

/**
 * Central Decoupled Registry for Import Module Adapters
 */
export class ImportRegistry {
  private static specs: Map<string, ImportModuleSpec> = new Map();

  /**
   * Registers a module adapter spec.
   */
  static register(spec: ImportModuleSpec): void {
    if (!spec || !spec.entityType) {
      console.warn('[ImportRegistry] Cannot register invalid spec');
      return;
    }
    this.specs.set(spec.entityType, spec);
  }

  /**
   * Unregisters a module adapter spec (used when modules are uninstalled).
   */
  static unregister(entityType: string): void {
    this.specs.delete(entityType);
  }

  /**
   * Retrieves a spec by entityType.
   */
  static getSpec(entityType: string): ImportModuleSpec | undefined {
    return this.specs.get(entityType);
  }

  /**
   * Returns list of all currently registered module specs.
   */
  static getAllSpecs(): ImportModuleSpec[] {
    return Array.from(this.specs.values());
  }

  /**
   * Checks if prerequisites are met for a given entityType.
   * Returns missing prerequisite entity types if any.
   */
  static checkPrerequisites(
    entityType: string,
    existingCounts: Record<string, number>
  ): { ok: boolean; missing: string[] } {
    const spec = this.getSpec(entityType);
    if (!spec || !spec.prerequisites || spec.prerequisites.length === 0) {
      return { ok: true, missing: [] };
    }

    const missing: string[] = [];
    for (const req of spec.prerequisites) {
      const count = existingCounts[req] || 0;
      if (count === 0) {
        const reqSpec = this.getSpec(req);
        missing.push(reqSpec ? reqSpec.label : req);
      }
    }

    return {
      ok: missing.length === 0,
      missing
    };
  }
}
