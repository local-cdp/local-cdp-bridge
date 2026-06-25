const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeDesktop', {
  getStatus: () => ipcRenderer.invoke('bridge:get-status'),
  acceptTerms: () => ipcRenderer.invoke('bridge:accept-terms'),
  launchBrowser: (browser) => ipcRenderer.invoke('bridge:launch-browser', browser),
  saveBrowserPath: (browser, path) => ipcRenderer.invoke('bridge:save-browser-path', browser, path),
  clearBrowserPath: (browser) => ipcRenderer.invoke('bridge:clear-browser-path', browser),
  chooseBrowserPath: (browser) => ipcRenderer.invoke('bridge:choose-browser-path', browser),
  saveLanguage: (language) => ipcRenderer.invoke('bridge:save-language', language),
  approvePendingOrigin: () => ipcRenderer.invoke('bridge:approve-pending-origin'),
  denyPendingOrigin: () => ipcRenderer.invoke('bridge:deny-pending-origin'),
  revokeOrigin: (origin) => ipcRenderer.invoke('bridge:revoke-origin', origin),
  openExternal: (url) => ipcRenderer.invoke('bridge:open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('bridge:check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('bridge:install-update'),
  onProtocolUrl: (handler) => {
    ipcRenderer.on('bridge:protocol-url', (_event, url) => handler(url));
  },
  onLaunchBrowser: (handler) => {
    ipcRenderer.on('bridge:launch-browser', (_event, browser) => handler(browser));
  },
  onAuthorizationRequested: (handler) => {
    ipcRenderer.on('bridge:authorization-requested', (_event, request) => handler(request));
  },
  onAuthorizationUpdated: (handler) => {
    ipcRenderer.on('bridge:authorization-updated', () => handler());
  },
  onUpdateStatus: (handler) => {
    ipcRenderer.on('bridge:update-status', (_event, status) => handler(status));
  }
});
