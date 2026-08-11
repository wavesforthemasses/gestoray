export class ChartEngineService {
  /**
   * Resolves whether the chart module is installed and active in the system.
   */
  static isChartInstalled(menuConfig: any[]): boolean {
    return Array.isArray(menuConfig) && menuConfig.some((m: any) => m.id === 'chart');
  }

  /**
   * Evaluates whether a chart should be rendered for a specific module or page context.
   */
  static shouldRenderChart(
    menuConfig: any[], 
    moduleAnalyticsSettings?: { listingChart?: { enabled: boolean } }
  ): boolean {
    if (!this.isChartInstalled(menuConfig)) {
      return false;
    }
    if (moduleAnalyticsSettings?.listingChart?.enabled === false) {
      return false;
    }
    return true;
  }
}
