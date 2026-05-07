import { access, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import http from 'node:http';
import { browserProfileDir } from '../system/paths.js';
import type { BrowserLaunchOptions, BrowserName } from '../protocol/types.js';
import { loadBrowserPathSettings } from './settings.js';

export interface BrowserCandidate {
  browser: BrowserName;
  path: string;
}

const WINDOWS_CANDIDATES: BrowserCandidate[] = [
  { browser: 'chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { browser: 'chrome', path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
  { browser: 'edge', path: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { browser: 'edge', path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' }
];

const MAC_CANDIDATES: BrowserCandidate[] = [
  { browser: 'chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  { browser: 'edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' }
];

export async function detectBrowsers(): Promise<BrowserCandidate[]> {
  const candidates = platform() === 'win32' ? WINDOWS_CANDIDATES : platform() === 'darwin' ? MAC_CANDIDATES : [];
  const found: BrowserCandidate[] = [];
  const settings = await loadBrowserPathSettings();

  for (const browser of ['chrome', 'edge'] as const) {
    const path = settings[browser];
    if (path && (await exists(path))) found.push({ browser, path });
  }

  for (const candidate of candidates) {
    if (found.some((item) => item.browser === candidate.browser)) continue;
    if (await exists(candidate.path)) found.push(candidate);
  }

  return found;
}

export async function launchBrowser(options: BrowserLaunchOptions): Promise<{ cdpUrl: string; pid?: number }> {
  const candidate = options.browserPath
    ? { browser: options.browser, path: options.browserPath }
    : (await detectBrowsers()).find((item) => item.browser === options.browser);
  if (!candidate) throw new Error(`Unable to find ${options.browser}.`);
  if (!(await exists(candidate.path))) throw new Error(`${options.browser} path does not exist: ${candidate.path}`);

  const cdpPort = options.cdpPort ?? 9222;
  if (await isCdpReady(cdpPort)) {
    if (options.startUrl && options.startUrl !== 'about:blank') await openCdpPage(cdpPort, options.startUrl);
    return { cdpUrl: `http://127.0.0.1:${cdpPort}` };
  }
  const profileDir = options.profileDir ?? browserProfileDir(options.browser);
  await mkdir(profileDir, { recursive: true });

  const child = spawn(
    candidate.path,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      options.startUrl ?? 'about:blank'
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  return { cdpUrl: `http://127.0.0.1:${cdpPort}`, pid: child.pid };
}

async function openCdpPage(port: number, url: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method: 'PUT', path: `/json/new?${encodeURIComponent(url)}`, timeout: 1000 },
      (res) => {
        res.resume();
        resolve();
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.on('error', () => resolve());
    req.end();
  });
}

async function isCdpReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/json/version', timeout: 500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
