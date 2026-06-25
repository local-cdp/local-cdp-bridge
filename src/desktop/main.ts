import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import { fileURLToPath } from 'node:url';
import { startHttpServer, type BridgeHttpServer } from '../server/http-server.js';
import { detectBrowsers, launchBrowser, launchDefaultBrowser } from '../browser/launcher.js';
import { clearBrowserPath, loadBrowserPathSettings, saveBrowserPath, saveLanguagePreference } from '../browser/settings.js';
import { acceptConsent, hasCurrentConsent, TERMS_VERSION } from '../security/consent.js';
import { grantPermission, listPermissions, revokePermission } from '../security/permissions.js';
import type { BridgeMethod } from '../protocol/types.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: BridgeHttpServer | null = null;
let externalServerPort: number | null = null;
let pendingAuthorization:
  | {
      origin: string;
      displayName?: string;
      allowedOrigins: string[];
      capabilities?: BridgeMethod[];
      requestedAt: string;
    }
  | null = null;

const APP_VERSION = app.getVersion();
const DEFAULT_START_URL = 'https://t.gooant.asia/publisher';

type UpdateState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateStatus {
  state: UpdateState;
  message: string;
  version?: string;
  progress?: number;
  error?: string;
}

let updateStatus: UpdateStatus = { state: 'idle', message: 'Updater is idle.' };

protocol.registerSchemesAsPrivileged([{ scheme: 'local-cdp-bridge', privileges: { standard: true } }]);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

function createWindow(): BrowserWindow {
  const appIcon = loadAppIcon();
  const window = new BrowserWindow({
    width: 820,
    height: 520,
    minWidth: 760,
    minHeight: 480,
    title: 'Browser Bridge',
    icon: appIcon,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.setMenuBarVisibility(false);
  window.loadFile(fileURLToPath(new URL('./renderer/agreement.html', import.meta.url)));
  window.on('closed', () => {
    mainWindow = null;
  });

  return window;
}

function showWindow(): void {
  if (!mainWindow) mainWindow = createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  const icon = loadTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Browser Bridge');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Browser Bridge', click: showWindow },
      { type: 'separator' },
      { label: 'Launch Chrome', click: () => mainWindow?.webContents.send('bridge:launch-browser', 'chrome') },
      { label: 'Launch Edge', click: () => mainWindow?.webContents.send('bridge:launch-browser', 'edge') },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
}

function loadAppIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(fileURLToPath(new URL('../../assets/icon.ico', import.meta.url)));
  return icon.isEmpty() ? createAppIcon() : icon;
}

function loadTrayIcon(): Electron.NativeImage {
  if (process.platform !== 'darwin') return loadAppIcon();
  const icon = createMacTemplateTrayIcon();
  icon.setTemplateImage(true);
  return icon;
}

function createMacTemplateTrayIcon(): Electron.NativeImage {
  const size = 18;
  const scaleFactor = 2;
  const pixelSize = size * scaleFactor;
  const buffer = Buffer.alloc(pixelSize * pixelSize * 4);
  const fill = (x: number, y: number, w: number, h: number, alpha = 255) => {
    for (let row = y * scaleFactor; row < (y + h) * scaleFactor; row += 1) {
      for (let col = x * scaleFactor; col < (x + w) * scaleFactor; col += 1) {
        const index = (row * pixelSize + col) * 4;
        buffer[index] = 0;
        buffer[index + 1] = 0;
        buffer[index + 2] = 0;
        buffer[index + 3] = alpha;
      }
    }
  };
  fill(4, 3, 3, 12);
  fill(7, 3, 5, 2);
  fill(7, 8, 6, 2);
  fill(7, 13, 5, 2);
  fill(12, 5, 2, 3);
  fill(13, 10, 2, 3);
  return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor });
}

function createAppIcon(): Electron.NativeImage {
  const size = 32;
  const buffer = Buffer.alloc(size * size * 4);
  const radius = 7;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const alpha = roundedRectAlpha(x, y, size, radius);
      const t = (x + y) / (size * 2);
      buffer[index] = Math.round(232 - 18 * t);
      buffer[index + 1] = Math.round(122 + 64 * t);
      buffer[index + 2] = Math.round(31 + 24 * t);
      buffer[index + 3] = alpha;
    }
  }
  drawTrayGlyph(buffer, size);
  return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: 1 });
}

function roundedRectAlpha(x: number, y: number, size: number, radius: number): number {
  const dx = x < radius ? radius - x : x >= size - radius ? x - (size - radius - 1) : 0;
  const dy = y < radius ? radius - y : y >= size - radius ? y - (size - radius - 1) : 0;
  return dx * dx + dy * dy <= radius * radius ? 255 : 0;
}

function drawTrayGlyph(buffer: Buffer, size: number): void {
  const fill = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) {
        const index = (row * size + col) * 4;
        buffer[index] = 255;
        buffer[index + 1] = 255;
        buffer[index + 2] = 255;
        buffer[index + 3] = 245;
      }
    }
  };
  fill(9, 8, 4, 16);
  fill(13, 8, 7, 3);
  fill(13, 15, 8, 3);
  fill(13, 21, 7, 3);
  fill(20, 10, 3, 5);
  fill(21, 18, 3, 4);
}

async function ensureServer(): Promise<void> {
  if (server || externalServerPort) return;
  const candidatePorts = [17321, 17322, 17323, 17324, 17329];
  let lastError: unknown = null;
  for (const port of candidatePorts) {
    try {
      server = await startHttpServer({
        port,
        cdpUrl: 'http://127.0.0.1:9222',
        onAuthorizationRequest: handleAuthorizationRequest,
        onLaunchDefaultBrowser: launchDefaultDebugBrowser
      });
      return;
    } catch (error) {
      lastError = error;
      if (isPortInUseError(error) && (await isExistingBridgeServer(port))) {
        externalServerPort = port;
        return;
      }
      if (!isPortInUseError(error)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No available local bridge port.');
}

function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('local-cdp-bridge', process.execPath, [process.argv[1]]);
    return;
  }
  app.setAsDefaultProtocolClient('local-cdp-bridge');
}

function registerIpc(): void {
  ipcMain.handle('bridge:get-status', () => getAppStatus());
  ipcMain.handle('bridge:accept-terms', () => acceptTerms());
  ipcMain.handle('bridge:launch-browser', (_event, browser: 'chrome' | 'edge') => launchDebugBrowser({ browser }));
  ipcMain.handle('bridge:save-browser-path', (_event, browser: 'chrome' | 'edge', path: string) =>
    saveBrowserPath(browser, path)
  );
  ipcMain.handle('bridge:clear-browser-path', (_event, browser: 'chrome' | 'edge') => clearBrowserPath(browser));
  ipcMain.handle('bridge:choose-browser-path', (_event, browser: 'chrome' | 'edge') => chooseBrowserPath(browser));
  ipcMain.handle('bridge:save-language', (_event, language: 'system' | 'en' | 'zh-CN') =>
    saveLanguagePreference(language)
  );
  ipcMain.handle('bridge:open-external', (_event, url: string) => openExternal(url));
  ipcMain.handle('bridge:check-for-updates', () => checkForUpdates());
  ipcMain.handle('bridge:install-update', () => installUpdate());
  ipcMain.handle('bridge:approve-pending-origin', () => approvePendingOrigin());
  ipcMain.handle('bridge:deny-pending-origin', () => denyPendingOrigin());
  ipcMain.handle('bridge:revoke-origin', (_event, origin: string) => revokePermission(origin));
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  Menu.setApplicationMenu(null);
  registerProtocol();
  registerIpc();
  await ensureServer();
  createTray();
  showWindow();
  configureAutoUpdates();
  setTimeout(() => {
    void checkForUpdates({ automatic: true });
  }, 3000);
});

app.on('activate', showWindow);

app.on('second-instance', (_event, argv) => {
  showWindow();
  const protocolUrl = argv.find((value) => value.startsWith('local-cdp-bridge://'));
  if (protocolUrl) {
    mainWindow?.webContents.send('bridge:protocol-url', protocolUrl);
    void handleProtocolUrl(protocolUrl);
  }
});

app.on('window-all-closed', (event: Event) => {
  event.preventDefault();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  showWindow();
  mainWindow?.webContents.send('bridge:protocol-url', url);
  void handleProtocolUrl(url);
});

app.on('before-quit', async () => {
  await server?.close().catch(() => {});
});

export async function getAppStatus() {
  return {
    version: APP_VERSION,
    termsVersion: TERMS_VERSION,
    consentAccepted: await hasCurrentConsent(),
    serverPort: server?.port ?? externalServerPort,
    browsers: await detectBrowsers(),
    browserPaths: await loadBrowserPathSettings(),
    systemLocale: app.getLocale() || 'en',
    permissions: await listPermissions(),
    pendingAuthorization,
    update: updateStatus
  };
}

export async function acceptTerms() {
  return acceptConsent(APP_VERSION);
}

export async function launchDebugBrowser(options: {
  browser: 'chrome' | 'edge';
  cdpPort?: number;
  profileDir?: string;
  startUrl?: string;
  browserPath?: string;
}) {
  if (!(await hasCurrentConsent())) {
    throw new Error('User agreement must be accepted before launching a browser.');
  }
  return launchBrowser({
    browser: options.browser,
    cdpPort: options.cdpPort,
    profileDir: options.profileDir,
    browserPath: options.browserPath ?? (await loadBrowserPathSettings())[options.browser],
    startUrl: options.startUrl ?? DEFAULT_START_URL
  });
}

export async function launchDefaultDebugBrowser(options: {
  cdpPort?: number;
  profileDir?: string;
  startUrl?: string;
  browserPath?: string;
} = {}) {
  if (!(await hasCurrentConsent())) {
    throw new Error('User agreement must be accepted before launching a browser.');
  }
  return launchDefaultBrowser({
    cdpPort: options.cdpPort,
    profileDir: options.profileDir,
    browserPath: options.browserPath,
    startUrl: options.startUrl ?? DEFAULT_START_URL
  });
}

export async function openExternal(url: string) {
  await shell.openExternal(url);
}

async function chooseBrowserPath(browser: 'chrome' | 'edge'): Promise<string | null> {
  const options = {
    title: `Select ${browser === 'chrome' ? 'Chrome' : 'Edge'} executable`,
    properties: ['openFile'],
    filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : undefined
  } as Electron.OpenDialogOptions;
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  return result.canceled ? null : result.filePaths[0] ?? null;
}

async function handleProtocolUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  const route = url.hostname || url.pathname.replace(/^\/+/, '') || 'open';
  if (route === 'open' || route === 'status') {
    showWindow();
    return;
  }
  if (route === 'start-browser') {
    const browser = url.searchParams.get('browser');
    if (browser !== 'chrome' && browser !== 'edge') throw new Error('browser must be chrome or edge');
    await launchDebugBrowser({
      browser,
      cdpPort: numberParam(url, 'cdpPort'),
      profileDir: url.searchParams.get('profileDir') ?? undefined,
      startUrl: url.searchParams.get('startUrl') ?? DEFAULT_START_URL
    });
    return;
  }
  if (route === 'connect') {
    const origin = url.searchParams.get('origin');
    if (origin) await requestAuthorization({ origin, allowedOrigins: [origin] });
    showWindow();
  }
}

function configureAutoUpdates(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({ state: 'checking', message: 'Checking for updates.' });
  });
  autoUpdater.on('update-available', (info) => {
    setUpdateStatus({
      state: 'available',
      message: `Update ${info.version} is available. Downloading...`,
      version: info.version
    });
  });
  autoUpdater.on('update-not-available', (info) => {
    setUpdateStatus({
      state: 'not-available',
      message: `Browser Bridge ${info.version || APP_VERSION} is up to date.`,
      version: info.version || APP_VERSION
    });
  });
  autoUpdater.on('download-progress', (progress) => {
    setUpdateStatus({
      state: 'downloading',
      message: `Downloading update ${Math.round(progress.percent)}%.`,
      progress: progress.percent
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus({
      state: 'downloaded',
      message: `Update ${info.version} is ready to install.`,
      version: info.version
    });
  });
  autoUpdater.on('error', (error) => {
    setUpdateStatus({
      state: 'error',
      message: 'Update check failed.',
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

async function checkForUpdates(options: { automatic?: boolean } = {}): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    setUpdateStatus({
      state: 'not-available',
      message: options.automatic ? 'Automatic updates are disabled in development.' : 'Updates require an installed app build.',
      version: APP_VERSION
    });
    return updateStatus;
  }
  try {
    await autoUpdater.checkForUpdates();
    return updateStatus;
  } catch (error) {
    setUpdateStatus({
      state: 'error',
      message: 'Update check failed.',
      error: error instanceof Error ? error.message : String(error)
    });
    return updateStatus;
  }
}

function installUpdate(): void {
  if (updateStatus.state !== 'downloaded') return;
  autoUpdater.quitAndInstall(false, true);
}

function setUpdateStatus(status: UpdateStatus): void {
  updateStatus = status;
  mainWindow?.webContents.send('bridge:update-status', updateStatus);
}

async function handleAuthorizationRequest(request: {
  origin: string;
  displayName?: string;
  allowedOrigins: string[];
  capabilities?: BridgeMethod[];
}): Promise<void> {
  await requestAuthorization(request);
}

async function requestAuthorization(request: {
  origin: string;
  displayName?: string;
  allowedOrigins: string[];
  capabilities?: BridgeMethod[];
}): Promise<void> {
  pendingAuthorization = {
    origin: request.origin,
    displayName: request.displayName,
    allowedOrigins: request.allowedOrigins,
    capabilities: request.capabilities,
    requestedAt: new Date().toISOString()
  };
  showWindow();
  mainWindow?.webContents.send('bridge:authorization-requested', pendingAuthorization);
}

async function approvePendingOrigin() {
  if (!pendingAuthorization) return null;
  const permission = await grantPermission({
    origin: pendingAuthorization.origin,
    allowedOrigins: pendingAuthorization.allowedOrigins,
    capabilities: pendingAuthorization.capabilities
  });
  pendingAuthorization = null;
  mainWindow?.webContents.send('bridge:authorization-updated');
  return permission;
}

function denyPendingOrigin(): void {
  pendingAuthorization = null;
  mainWindow?.webContents.send('bridge:authorization-updated');
}

function numberParam(url: URL, key: string): number | undefined {
  const value = url.searchParams.get(key);
  return value ? Number(value) : undefined;
}

function isPortInUseError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE';
}

async function isExistingBridgeServer(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: unknown; name?: unknown };
    return payload.ok === true && payload.name === 'local-cdp-bridge';
  } catch {
    return false;
  }
}
