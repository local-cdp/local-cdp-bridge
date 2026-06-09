import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { appDataDir } from '../system/paths.js';
import type { BridgeMethod } from '../protocol/types.js';

export interface OriginPermission {
  origin: string;
  allowedOrigins: string[];
  capabilities: BridgeMethod[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionsFile {
  origins: OriginPermission[];
}

const DEFAULT_CAPABILITIES: BridgeMethod[] = [
  'browser.status',
  'browser.launchDefault',
  'browser.ensureReady',
  'browser.close',
  'pages.list',
  'pages.open',
  'pages.focus',
  'pages.focusByUrl',
  'pages.reload',
  'pages.screenshot',
  'dom.text',
  'dom.attribute',
  'dom.list',
  'dom.click',
  'dom.fill',
  'dom.press',
  'dom.scroll',
  'dom.scrollState',
  'network.fetch',
  'network.waitResponse',
  'files.upload',
  'files.chooseAndUpload',
  'files.uploadData'
];

export function permissionsFile(): string {
  return join(appDataDir(), 'permissions.json');
}

export async function readPermissions(): Promise<PermissionsFile> {
  try {
    return JSON.parse(await readFile(permissionsFile(), 'utf8')) as PermissionsFile;
  } catch {
    return { origins: [] };
  }
}

export async function listPermissions(): Promise<OriginPermission[]> {
  return (await readPermissions()).origins;
}

export async function getPermission(origin: string): Promise<OriginPermission | null> {
  return (await readPermissions()).origins.find((item) => item.origin === origin) ?? null;
}

export async function grantPermission(input: {
  origin: string;
  allowedOrigins?: string[];
  capabilities?: BridgeMethod[];
}): Promise<OriginPermission> {
  const now = new Date().toISOString();
  const file = await readPermissions();
  const existing = file.origins.find((item) => item.origin === input.origin);
  const permission: OriginPermission = {
    origin: input.origin,
    allowedOrigins: input.allowedOrigins?.length ? input.allowedOrigins : [input.origin],
    capabilities: input.capabilities?.length ? input.capabilities : DEFAULT_CAPABILITIES,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  file.origins = [...file.origins.filter((item) => item.origin !== input.origin), permission].sort((a, b) =>
    a.origin.localeCompare(b.origin)
  );
  await writePermissions(file);
  return permission;
}

export async function revokePermission(origin: string): Promise<void> {
  const file = await readPermissions();
  file.origins = file.origins.filter((item) => item.origin !== origin);
  await writePermissions(file);
}

async function writePermissions(file: PermissionsFile): Promise<void> {
  const target = permissionsFile();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}
