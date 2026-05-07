import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export function appDataDir(): string {
  if (platform() === 'win32') {
    return process.env.APPDATA
      ? join(process.env.APPDATA, 'local-cdp-bridge')
      : join(homedir(), 'AppData', 'Roaming', 'local-cdp-bridge');
  }

  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'local-cdp-bridge');
  }

  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'local-cdp-bridge');
}

export function browserProfileDir(browser: 'chrome' | 'edge'): string {
  return join(appDataDir(), 'browser-profiles', browser);
}
