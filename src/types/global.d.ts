export {};

declare global {
  interface Window {
    bridgeDesktop: {
      getStatus(): Promise<{
        version: string;
        termsVersion: string;
        consentAccepted: boolean;
        serverPort: number | null;
        browsers: Array<{ browser: 'chrome' | 'edge'; path: string }>;
        browserPaths: { chrome?: string; edge?: string; language?: 'system' | 'en' | 'zh-CN' };
        systemLocale: string;
        permissions: Array<{ origin: string; allowedOrigins: string[]; capabilities: string[] }>;
        pendingAuthorization: {
          origin: string;
          displayName?: string;
          allowedOrigins: string[];
          capabilities?: string[];
          requestedAt: string;
        } | null;
      }>;
      acceptTerms(): Promise<unknown>;
      launchBrowser(browser: 'chrome' | 'edge'): Promise<{ cdpUrl: string; pid?: number }>;
      saveBrowserPath(browser: 'chrome' | 'edge', path: string): Promise<unknown>;
      clearBrowserPath(browser: 'chrome' | 'edge'): Promise<unknown>;
      chooseBrowserPath(browser: 'chrome' | 'edge'): Promise<string | null>;
      saveLanguage(language: 'system' | 'en' | 'zh-CN'): Promise<unknown>;
      approvePendingOrigin(): Promise<unknown>;
      denyPendingOrigin(): Promise<unknown>;
      revokeOrigin(origin: string): Promise<unknown>;
      openExternal(url: string): Promise<void>;
      onProtocolUrl(handler: (url: string) => void): void;
      onLaunchBrowser(handler: (browser: 'chrome' | 'edge') => void): void;
      onAuthorizationRequested(
        handler: (request: {
          origin: string;
          displayName?: string;
          allowedOrigins: string[];
          capabilities?: string[];
          requestedAt: string;
        }) => void
      ): void;
      onAuthorizationUpdated(handler: () => void): void;
    };
  }
}
