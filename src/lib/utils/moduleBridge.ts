/**
 * Safe Dynamic Plugin Service Loader for the application.
 * Prevents Vite import-analysis build-time/dev-time failures when optional module services are uninstalled.
 */
export async function loadOptionalService(serviceName: string): Promise<any> {
  try {
    if (serviceName === 'activityTypesService') {
      const servicePath = '/src/lib/services/activityTypesService.ts';
      // @ts-ignore
      return await import(/* @vite-ignore */ servicePath);
    }
    const servicePath = `/src/lib/services/${serviceName}.ts`;
    // @ts-ignore
    const mod = await import(/* @vite-ignore */ servicePath);
    return mod;
  } catch (err) {
    return null;
  }
}
