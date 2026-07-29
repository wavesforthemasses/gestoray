/**
 * Safe Dynamic Plugin Service Loader for Gestoray.
 * Prevents Vite import-analysis build-time/dev-time failures when optional module services are uninstalled.
 */
export async function loadOptionalService(serviceName: string): Promise<any> {
  try {
    const servicePath = `$lib/services/${serviceName}`;
    // Using a variable specifier with @vite-ignore prevents Vite from statically resolving absent files at bundle time
    // @ts-ignore
    const mod = await import(/* @vite-ignore */ servicePath);
    return mod;
  } catch (err) {
    return null;
  }
}
