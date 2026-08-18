import { goto } from '$app/navigation';

export interface ContextParams {
  clientId?: string;
  placeId?: string;
  projectId?: string;
  activityId?: string;
  vehicleId?: string;
  teamId?: string;
  returnUrl?: string;
  [key: string]: string | undefined;
}

/**
 * NavigationService
 * Centralized Navigation Context Engine for Gestoray ERP.
 * 
 * Guarantees 100% context preservation when creating, editing, viewing, or returning from items:
 * - If user originates from a Cantiere/Place, submit/back/edit returns to that Place.
 * - If user originates from a Cliente, submit/back/edit returns to that Cliente.
 * - Supports explicit `returnUrl` parameter or fallback context IDs.
 */
export class NavigationService {

  /**
   * Builds an URL to an `add` or `edit` page while injecting `returnUrl` and context IDs.
   */
  static buildAddUrl(basePath: string, params: ContextParams = {}, currentPath?: string): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      }
    });

    if (!searchParams.has('returnUrl') && currentPath) {
      searchParams.set('returnUrl', currentPath);
    }

    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  /**
   * Preserves current navigation context (returnUrl, placeId, clientId, projectId) on target path links.
   * Useful when navigating from Detail page to Edit page or sub-action page.
   */
  static preserveParams(targetPath: string, searchParams: URLSearchParams | ContextParams): string {
    const currentQuery = new URLSearchParams();

    if (searchParams instanceof URLSearchParams) {
      searchParams.forEach((val, key) => {
        if (['returnUrl', 'placeId', 'clientId', 'projectId', 'activityId', 'vehicleId', 'teamId'].includes(key)) {
          currentQuery.set(key, val);
        }
      });
    } else {
      Object.entries(searchParams).forEach(([key, val]) => {
        if (val && ['returnUrl', 'placeId', 'clientId', 'projectId', 'activityId', 'vehicleId', 'teamId'].includes(key)) {
          currentQuery.set(key, val);
        }
      });
    }

    const queryString = currentQuery.toString();
    if (!queryString) return targetPath;

    return targetPath.includes('?') ? `${targetPath}&${queryString}` : `${targetPath}?${queryString}`;
  }

  /**
   * Resolves the target URL after a successful form submission (`handleSubmit`) or clicking "Torna indietro".
   * Evaluates `returnUrl` first, then context IDs (`placeId`, `clientId`, `projectId`),
   * and falls back to `defaultTargetUrl`.
   */
  static getReturnUrl(searchParams: URLSearchParams | ContextParams, defaultTargetUrl: string): string {
    let returnUrl: string | undefined;
    let placeId: string | undefined;
    let clientId: string | undefined;
    let projectId: string | undefined;

    if (searchParams instanceof URLSearchParams) {
      returnUrl = searchParams.get('returnUrl') || undefined;
      placeId = searchParams.get('placeId') || undefined;
      clientId = searchParams.get('clientId') || undefined;
      projectId = searchParams.get('projectId') || undefined;
    } else {
      returnUrl = searchParams.returnUrl;
      placeId = searchParams.placeId;
      clientId = searchParams.clientId;
      projectId = searchParams.projectId;
    }

    if (returnUrl) {
      try {
        const decoded = decodeURIComponent(returnUrl);
        if (decoded.startsWith('/dashboard')) {
          return decoded;
        }
      } catch (e) {
        // Ignore malformed returnUrl
      }
    }

    if (placeId) {
      return `/dashboard/places/${placeId}`;
    }

    if (clientId) {
      return `/dashboard/clients/${clientId}`;
    }

    if (projectId) {
      return `/dashboard/projects/${projectId}`;
    }

    return defaultTargetUrl;
  }

  /**
   * Generates a context-aware label for the top back button.
   * e.g. "Torna al Cantiere", "Torna al Cliente", "Torna Indietro", or fallback.
   */
  static getBackLabel(searchParams: URLSearchParams | ContextParams, fallbackLabel: string): string {
    let returnUrl: string | undefined;
    let placeId: string | undefined;
    let clientId: string | undefined;
    let projectId: string | undefined;

    if (searchParams instanceof URLSearchParams) {
      returnUrl = searchParams.get('returnUrl') || undefined;
      placeId = searchParams.get('placeId') || undefined;
      clientId = searchParams.get('clientId') || undefined;
      projectId = searchParams.get('projectId') || undefined;
    } else {
      returnUrl = searchParams.returnUrl;
      placeId = searchParams.placeId;
      clientId = searchParams.clientId;
      projectId = searchParams.projectId;
    }

    if (placeId) return 'Torna al Cantiere';
    if (clientId) return 'Torna al Cliente';
    if (projectId) return 'Torna alla Commessa';
    if (returnUrl) return 'Torna Indietro';

    return fallbackLabel;
  }

  /**
   * Executes a smart redirect after form submission.
   */
  static async submitSuccessReturn(searchParams: URLSearchParams | ContextParams, defaultTargetUrl: string): Promise<void> {
    const targetUrl = this.getReturnUrl(searchParams, defaultTargetUrl);
    await goto(targetUrl);
  }

  /**
   * Executes a smart "Torna Indietro" action for header back buttons.
   */
  static async navigateBack(searchParams: URLSearchParams | ContextParams, fallbackUrl: string): Promise<void> {
    const targetUrl = this.getReturnUrl(searchParams, fallbackUrl);
    await goto(targetUrl);
  }

  /**
   * Executes a smart cancel / back action for form cancel and back buttons.
   * Alias for navigateBack.
   */
  static async cancelAndReturn(searchParams: URLSearchParams | ContextParams, fallbackUrl: string): Promise<void> {
    return this.navigateBack(searchParams, fallbackUrl);
  }

  /**
   * Executes the global history back action.
   */
  static async goBack(): Promise<void> {
    const { executeGlobalBack } = await import('$lib/stores/navigationHistory');
    await executeGlobalBack();
  }
}

export {
  navigationStackStore,
  canGoBackStore,
  recordNavigation,
  executeGlobalBack
} from '$lib/stores/navigationHistory';

