import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { appDataDir } from '../system/paths.js';
import type { BrowserName } from '../protocol/types.js';

export interface BrowserPathSettings {
  chrome?: string;
  edge?: string;
  language?: LanguagePreference;
}

export type LanguagePreference = 'system' | 'en' | 'zh-CN';

const SETTINGS_PATH = resolve(appDataDir(), 'browser-settings.json');

export async function loadBrowserPathSettings(): Promise<BrowserPathSettings> {
  try {
    const content = await readFile(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(content) as BrowserPathSettings;
    return {
      chrome: normalizePath(parsed.chrome),
      edge: normalizePath(parsed.edge),
      language: normalizeLanguage(parsed.language)
    };
  } catch {
    return {};
  }
}

export async function saveLanguagePreference(language: LanguagePreference): Promise<BrowserPathSettings> {
  const current = await loadBrowserPathSettings();
  current.language = language;
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
  return current;
}

export async function saveBrowserPath(browser: BrowserName, path: string): Promise<BrowserPathSettings> {
  const current = await loadBrowserPathSettings();
  current[browser] = normalizePath(path);
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
  return current;
}

export async function clearBrowserPath(browser: BrowserName): Promise<BrowserPathSettings> {
  const current = await loadBrowserPathSettings();
  delete current[browser];
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
  return current;
}

function normalizePath(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeLanguage(value: unknown): LanguagePreference {
  return value === 'en' || value === 'zh-CN' || value === 'system' ? value : 'system';
}
